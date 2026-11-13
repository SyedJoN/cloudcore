import path from "path";
import Directory from "../models/directory.model.js";
import File from "../models/file.model.js";
import { fgaClient } from "../services/openFGAService.js";
import { ClientWriteRequestOnMissingDeletes } from "@openfga/sdk";
import {
  sendOwnershipTransferEmail,
  sendLinkEmail,
  sendRequestAccessEmail,
  sendOwnershipTransferResultEmail,
} from "../services/sendMailService.js";
import User from "../models/user.model.js";
import { sanitizeText } from "../utils/sanitizeText.js";
import { updateParentDirSize } from "../utils/updateDirSize.js";
import { formatSize } from "../utils/formatSize.js";
import { getDirectoryPath } from "../utils/updatePath.js";
import { deleteFileArray } from "../services/s3/deleteArray.js";
import Ownership from "../models/ownership.model.js";
import {
  getOwnerRoots,
  getOwnershipModel,
  transferFgaOwnership,
  updateDirectoryChildren,
  updateOwnershipStatus,
  updateOwnerStorage,
  updateResourceOwnership,
} from "../utils/ownershipHelpers.js";
import { ZipArchive } from "archiver";
import { getFile } from "../services/s3/getFile.js";
import Subscription from "../models/subscription.model.js";
import { getFileSize } from "../services/s3/getFileSize.js";
import { sanitizeFilename } from "../utils/sanitizeFileName.js";
import { getSignedUploadUrl } from "../services/s3/upload.js";
import { resolveObjectPermissions } from "../utils/permissions/resolveObjectPermissions.js";
import { mergePermission } from "../utils/permissions/mergePermission.js";
import { getAncestorDirectories } from "../utils/permissions/getAncestorDirectories.js";
import { getIdString } from "../utils/permissions/getIdString.js";
import { ROLE_PRIORITY } from "../utils/permissions/getRolePriority.js";
import { getCapabilities } from "../utils/permissions/getCapabilities.js";
import copyS3File from "../services/s3/copy.js";
import { getDriveClient } from "../services/googleDriveClient.js";
import SharedAccess from "../models/sharedAccess.model.js";
import FileActivity from "../models/fileActivity.model.js";
import { getFgaObject } from "../utils/getFgaObject.js";
import mongoose from "mongoose";
import { recordView } from "./file.controller.js";

async function getSharedWithMeTime({ itemId, itemType, userId }) {
  if (!itemId || !userId) return null;

  const record = await SharedAccess.findOne({ itemId, itemType, userId })
    .select("sharedWithMeTime")
    .lean();

  return record?.sharedWithMeTime || null;
}

const resolveRole = async (item, type, userId, parentDir, isShared = false) => {
  const object = getFgaObject(type, item._id);

  const permissionMap = new Map();

  const directPermissions = await resolveObjectPermissions(object);

  for (const { user, relation } of directPermissions) {
    mergePermission({
      permissionMap,
      user,
      relation,
      source: "direct",
      isShared,
    });
  }

  let inheritedPublicRole = null;
  let inheritedPublicFrom = null;

  if (parentDir?._id) {
    const ancestors = await getAncestorDirectories(parentDir);

    for (const ancestor of ancestors) {
      const inheritedPermissions = await resolveObjectPermissions(
        `folder:${ancestor._id}`,
      );

      for (const { user, relation } of inheritedPermissions) {
        const inheritedRelation = relation === "owner" ? "writer" : relation;

        mergePermission({
          permissionMap,
          user,
          relation: inheritedRelation,
          source: "parent",
          inheritedFrom: ancestor,
          isShared,
        });
      }

      if (ancestor?.isPublic) {
        const ancestorPublicRole = ancestor.publicRole || "reader";

        const ancestorPriority = ROLE_PRIORITY[ancestorPublicRole] || 0;

        const currentInheritedPriority = inheritedPublicRole
          ? ROLE_PRIORITY[inheritedPublicRole] || 0
          : 0;

        if (ancestorPriority > currentInheritedPriority) {
          inheritedPublicRole = ancestorPublicRole;
          inheritedPublicFrom = ancestor;
        }
      }
    }
  }

  const directPublicRole = item?.isPublic ? item?.publicRole || "reader" : null;

  const directPublicPriority = directPublicRole
    ? ROLE_PRIORITY[directPublicRole] || 0
    : 0;

  const inheritedPublicPriority = inheritedPublicRole
    ? ROLE_PRIORITY[inheritedPublicRole] || 0
    : 0;

  const effectivePublicRole =
    directPublicPriority >= inheritedPublicPriority
      ? directPublicRole
      : inheritedPublicRole;

  const hasDirectPublicPermission = Boolean(directPublicRole);

  const hasInheritedPublicPermission = Boolean(inheritedPublicRole);

  const isPublic = Boolean(effectivePublicRole);

  let publicSource = null;

  if (effectivePublicRole) {
    if (directPublicPriority >= inheritedPublicPriority && directPublicRole) {
      publicSource = "direct";
    } else {
      publicSource = "parent";
    }
  }

  const permissions = Array.from(permissionMap.values());

  const owners = permissions
    .filter((permission) => permission.directRole === "owner")
    .map((permission) => ({
      displayName: permission.displayName,
      kind: "drive#user",
      me: permission.id?.toString() === userId?.toString(),
      permissionId: permission.id,
      emailAddress: permission.emailAddress,
      photoLink: permission.photoLink,
    }));

  const currentUserId = getIdString(userId);

  const currentUserPermission = currentUserId
    ? permissionMap.get(currentUserId)
    : null;

  const directRole = currentUserPermission?.directRole || null;

  const inheritedRole = currentUserPermission?.inheritedRole || null;

  const directPriority = directRole ? ROLE_PRIORITY[directRole] || 0 : 0;

  const inheritedPriority = inheritedRole
    ? ROLE_PRIORITY[inheritedRole] || 0
    : 0;

  const publicPriority = effectivePublicRole
    ? ROLE_PRIORITY[effectivePublicRole] || 0
    : 0;

  const highestPriority = Math.max(
    directPriority,
    inheritedPriority,
    publicPriority,
  );

  let currentRole = null;
  let roleSource = null;

  if (highestPriority > 0) {
    if (publicPriority === highestPriority && effectivePublicRole) {
      currentRole = effectivePublicRole;
      roleSource = "public";
    } else if (directPriority >= inheritedPriority && directRole) {
      currentRole = directRole;
      roleSource = "direct";
    } else if (inheritedRole) {
      currentRole = inheritedRole;
      roleSource = "inherited";
    }
  }

  const isPublicEffective = Boolean(
    effectivePublicRole && publicPriority === highestPriority,
  );

  const parentId = getIdString(parentDir?.parentDirId);

  const isRootDirectory = Boolean(parentDir?._id) && !parentId;

  const isRootLevelFile = type === "file" && isRootDirectory;

  const currentUserCapabilities = getCapabilities(
    currentRole,
    type,
    isRootLevelFile,
  );

  const [viewActivity, modifiedActivity] = await Promise.all([
    FileActivity.findOne({
      file: item._id,
      user: userId,
      type: "view",
    }).lean(),

    FileActivity.findOne({
      file: item._id,
      user: userId,
      type: {
        $in: ["rename", "move"],
      },
    })
      .sort({
        occuredAt: -1,
      })
      .lean(),
  ]);

  const viewedByMeTime = viewActivity?.occuredAt || null;

  const modifiedByMeTime = modifiedActivity?.occuredAt || null;

  let sharedWithMeTime = null;

  if (roleSource === "direct") {
    sharedWithMeTime = await getSharedWithMeTime({
      itemId: item._id,
      itemType: type,
      userId: currentUserId,
    });
  } else if (
    roleSource === "inherited" &&
    currentUserPermission?.inheritedFrom?.id
  ) {
    sharedWithMeTime = await getSharedWithMeTime({
      itemId: currentUserPermission.inheritedFrom.id,
      itemType: "folder",
      userId: currentUserId,
    });
  }

  let publicCapabilities = null;

  if (isPublic) {
    publicCapabilities = getCapabilities(
      effectivePublicRole,
      type,
      isRootLevelFile,
    );

    const permissionDetails = [];

    if (directPublicRole) {
      permissionDetails.push({
        permissionType: "file",
        role: directPublicRole,
        inherited: false,
        inheritedFrom: null,
      });
    }

    if (inheritedPublicRole) {
      permissionDetails.push({
        permissionType: "folder",
        role: inheritedPublicRole,
        inherited: true,
        inheritedFrom: inheritedPublicFrom
          ? {
              id: getIdString(inheritedPublicFrom._id),
              name: inheritedPublicFrom.name,
              type: "folder",
            }
          : null,
      });
    }

    permissions.push({
      id: "anyoneWithLink",
      type: "anyone",

      role: effectivePublicRole,

      inherited: publicSource === "parent",

      source: publicSource,

      permissionDetails,

      inheritedFrom: inheritedPublicFrom
        ? {
            id: getIdString(inheritedPublicFrom._id),
            name: inheritedPublicFrom.name,
            type: "folder",
          }
        : null,

      hasDirectPermission: hasDirectPublicPermission,

      hasInheritedPermission: hasInheritedPublicPermission,
    });
  }

  const ownership = await Ownership.findOne({
    itemId: item?._id,
  })
    .sort({
      createdAt: -1,
    })
    .lean();

  const ownerId = ownership?.toUser ? getIdString(ownership.toUser) : null;

  const updatedPermissions = permissions.map((permission) => {
    const permissionId = getIdString(permission.id);

    if (ownership?.status === "pending" && permissionId === ownerId) {
      return {
        ...permission,
        pendingOwner: true,
      };
    }

    return permission;
  });

  return {
    capabilities: isPublicEffective
      ? publicCapabilities
      : currentUserCapabilities,

    permissions: updatedPermissions,

    owners,

    isRootLevelFile,
    isRootDirectory,

    sharedWithMeTime,

    viewedByMeTime,

    modifiedByMeTime,
  };
};

async function listSharedObjects(type, userId) {
  const [readResult, writeResult] = await Promise.all([
    fgaClient.listObjects({
      user: `user:${userId}`,
      relation: "shared_reader",
      type,
    }),
    fgaClient.listObjects({
      user: `user:${userId}`,
      relation: "shared_writer",
      type,
    }),
  ]);

  const combined = [...readResult.objects, ...writeResult.objects];

  return [...new Set(combined)].map((o) => o.split(":").pop()).filter(Boolean);
}

export async function listObjects(type, userId) {
  const canRead = await fgaClient.listObjects({
    user: getFgaObject("user", userId),
    relation: "can_read",
    type,
  });

  return canRead.objects.map((o) => o.split(":").pop()).filter(Boolean);
}

export const getDirectory = async (req, res, next) => {
  try {
    const _id = req.params.id || req.user?.parentDirId;
    const userId = req.user?._id;

    const rootDir = await Directory.findOne({ userId })
      .populate("path", "name")
      .lean();

    const parentDir = await Directory.findOne({ _id })
      .populate("path", "name")
      .lean();

    if (!parentDir)
      return res.status(404).json({ message: "Directory not found" });

    const isPublic = parentDir.isPublic;

    // fetching children
    if (isPublic) {
      const [files, directories] = await Promise.all([
        File.find({
          parentDirId: parentDir._id,
          isDeleted: false,
        })
          .populate("userId", "name email avatar")
          .populate("path", "name")
          .populate("parentDirId")
          .populate("lastModifyingUser")
          .lean(),

        Directory.find({
          parentDirId: parentDir._id,
          isDeleted: false,
        })
          .populate("userId", "name email avatar")
          .populate("path", "name")
          .populate("parentDirId")
          .populate("lastModifyingUser")
          .lean(),
      ]);

      if (
        userId &&
        parentDir &&
        parentDir.userId.toString() !== userId.toString()
      ) {
        const relation = parentDir.publicRole || "reader";

        await fgaClient.write(
          {
            writes: [
              {
                user: `user:${userId}`,
                relation:
                  relation === "reader" ? "shared_reader" : "shared_writer",
                object: getFgaObject("folder", parentDir._id),
              },
            ],
          },
          {
            transaction: {
              disable: true,
            },
          },
        );
      }

      const { files: _, directories: __, ...parentDirData } = parentDir;

      const actualParent = parentDir.parentDirId
        ? await Directory.findById(parentDir.parentDirId)
            .select("_id name parentDirId isPublic publicRole")
            .lean()
        : null;

      const [filesWithRoles, directoriesWithRoles] = await Promise.all([
        Promise.all(
          files.map(async (f) => {
            const {
              owners,
              capabilities,
              permissions,
              viewedByMeTime,
              modifiedByMeTime,
            } = await resolveRole(f, "file", userId, parentDir);

            const isMine = String(f.userId?._id ?? f.userId) === String(userId);

            return {
              ...f,
              owners,
              capabilities,
              permissions,
              viewedByMeTime,
              modifiedByMeTime,
              locationLabel: !isMine ? "Shared with me" : "",
              rootType: isMine ? "mine" : "shared",
            };
          }),
        ),

        Promise.all(
          directories.map(async (d) => {
            const { owners, capabilities, permissions } = await resolveRole(
              d,
              "folder",
              userId,
              parentDir,
            );

            const isMine = String(d.userId?._id ?? d.userId) === String(userId);

            return {
              ...d,
              owners,
              capabilities,
              permissions,
              locationLabel: !isMine ? "Shared with me" : "",
              rootType: isMine ? "mine" : "shared",
            };
          }),
        ),
      ]);

      const permissions = await resolveRole(
        parentDir,
        "folder",
        userId,
        actualParent,
      );

      const parentDirWithRole = {
        ...parentDirData,
        ...permissions,
      };

      return res.status(200).json({
        ...parentDirWithRole,
        files: filesWithRoles,
        directories: directoriesWithRoles,
        totalUsage: rootDir?.size,
      });
    }

    if (!userId)
      return res.status(403).json({
        message: "Access denied",
        requiresAuth: true,
        userId: req.user?._id,
      });

    // checking if user can view this currentDirectory
    const canRead = await fgaClient.check({
      user: getFgaObject("user", userId),
      relation: "can_read",
      object: getFgaObject("folder", parentDir._id),
    });

    if (!canRead.allowed)
      return res.status(403).json({
        message: "Access denied",
        requiresAuth: false,
        name: parentDir.name,
      });

    const [allowedFileIds, allowedFolderIds] = await Promise.all([
      listObjects("file", userId),
      listObjects("folder", userId),
    ]);

    const [files, directories] = await Promise.all([
      File.find({
        _id: { $in: allowedFileIds },
        parentDirId: parentDir._id,
        isDeleted: false,
      })
        .populate("userId", "name email avatar")
        .populate("path", "name")
        .populate("parentDirId")
        .populate("lastModifyingUser")
        .lean(),

      Directory.find({
        _id: { $in: allowedFolderIds },
        parentDirId: parentDir._id,
        isDeleted: false,
      })
        .populate("userId", "name email avatar")
        .populate("parentDirId")
        .populate("path", "name")
        .populate("lastModifyingUser")
        .lean(),
    ]);

    const filesWithRoles = await Promise.all(
      files.map(async (file) => {
        const {
          owners,
          capabilities,
          permissions,
          viewedByMeTime,
          modifiedByMeTime,
        } = await resolveRole(file, "file", userId, parentDir);

        const isMine =
          String(file.userId?._id ?? file.userId) === String(userId);

        return {
          ...file,
          owners,
          capabilities,
          permissions,
          viewedByMeTime,
          modifiedByMeTime,
          locationLabel: !isMine ? "Shared with me" : "",
          rootType: isMine ? "mine" : "shared",
        };
      }),
    );

    const directoriesWithRoles = await Promise.all(
      directories.map(async (dir) => {
        const { owners, capabilities, permissions } = await resolveRole(
          dir,
          "folder",
          userId,
          parentDir,
        );

        const isMine = String(dir.userId?._id ?? dir.userId) === String(userId);

        return {
          ...dir,
          owners,
          capabilities,
          permissions,
          locationLabel: !isMine ? "Shared with me" : "",
          rootType: isMine ? "mine" : "shared",
        };
      }),
    );

    const { owners, capabilities, permissions } = await resolveRole(
      parentDir,
      "folder",
      userId,
      parentDir,
    );

    const parentDirectoryWithRoles = {
      ...parentDir,
      owners,
      capabilities,
      permissions,
    };

    if (req.params.id) {
      recordView(userId, parentDir._id, "folder").catch(console.error);
    }

    return res.status(200).json({
      ...parentDirectoryWithRoles,
      files: filesWithRoles,
      directories: directoriesWithRoles,
      totalUsage: rootDir?.size,
    });
  } catch (error) {
    next(error);
  }
};

export const getTrashItems = async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = req.user?._id;

    if (!userId) return res.status(403).json({ message: "Access denied" });
    const parentDir = await Directory.findOne({ id })
      .populate("path", "name")
      .lean();
    if (id) {
      const dir = await Directory.findById(id).populate("path", "name").lean();
      // inside a deleted currentDirectory show its undeleted children
      const [files, directories] = await Promise.all([
        File.find({ userId, parentDirId: id, isDeleted: true })
          .populate("userId", "name email avatar")
          .populate("path", "name")
          .lean(),
        Directory.find({ userId, parentDirId: id, isDeleted: true })
          .populate("userId", "name email avatar")
          .populate("path", "name")
          .lean(),
      ]);
      return res.status(200).json({ ...dir, files, directories });
    }

    // Show only top level deleted items
    const [files, directories] = await Promise.all([
      File.find({ userId, isDeleted: true })
        .populate("userId", "name email avatar")
        .populate("path", "name")
        .lean(),
      Directory.find({ userId, isDeleted: true })
        .populate("userId", "name email avatar")
        .populate("path", "name")
        .lean(),
    ]);

    const deletedDirIds = new Set(directories.map((d) => d._id.toString()));

    const topLevelFiles = files.filter(
      (f) => !deletedDirIds.has(f.parentDirId?.toString()),
    );

    const topLevelDirs = directories.filter(
      (d) => !deletedDirIds.has(d.parentDirId?.toString()),
    );

    const topLevelFilesWithResolvedRoles = await Promise.all(
      topLevelFiles.map(async (file) => {
        const { owners, capabilities, permissions } = await resolveRole(
          file,
          "file",
          userId,
          file.parentDirId,
        );
        return {
          ...file,
          owners,
          capabilities,
          permissions,
        };
      }),
    );

    const topLevelDirsWithResolvedRoles = await Promise.all(
      topLevelDirs.map(async (dir) => {
        const { owners, capabilities, permissions } = await resolveRole(
          dir,
          "folder",
          userId,
          dir.parentDirId,
        );
        return {
          ...dir,
          owners,
          capabilities,
          permissions,
        };
      }),
    );
    return res.status(200).json({
      ...parentDir,
      files: topLevelFilesWithResolvedRoles,
      directories: topLevelDirsWithResolvedRoles,
    });
  } catch (error) {
    next(error);
  }
};

export const getSharedWithMe = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const [allowedFileIds, allowedFolderIds] = await Promise.all([
      listSharedObjects("file", userId),
      listSharedObjects("folder", userId),
    ]);

    if (!allowedFolderIds.length && !allowedFileIds.length) {
      return res.status(200).json({ files: [], directories: [] });
    }

    const allowedFolderIdSet = new Set(
      allowedFolderIds.map((id) => String(id)),
    );

    const [files, directories] = await Promise.all([
      allowedFileIds.length
        ? File.find({
            _id: {
              $in: allowedFileIds,
            },

            userId: {
              $ne: userId,
            },
          })
            .populate("parentDirId")
            .populate("userId", "name email avatar")
            .populate("path", "name")
            .lean()
        : [],

      allowedFolderIds.length
        ? Directory.find({
            _id: {
              $in: allowedFolderIds,
            },

            userId: {
              $ne: userId,
            },
          })
            .populate("userId", "name email avatar")
            .populate("path", "name")
            .lean()
        : [],
    ]);

    const getParentId = (parentDirId) => {
      if (!parentDirId) {
        return null;
      }

      if (typeof parentDirId === "object" && parentDirId._id) {
        return String(parentDirId._id);
      }

      return String(parentDirId);
    };

    const topLevelFiles = files.filter((file) => {
      const parentId = getParentId(file.parentDirId);

      return !parentId || !allowedFolderIdSet.has(parentId);
    });

    const topLevelDirectories = directories.filter((directory) => {
      const parentId = getParentId(directory.parentDirId);

      return !parentId || !allowedFolderIdSet.has(parentId);
    });

    const filesWithRoles = await Promise.all(
      topLevelFiles.map(async (file) => {
        let parentDir = null;

        const parentId = getParentId(file.parentDirId);
        if (parentId) {
          parentDir = await Directory.findById(parentId)
            .select("_id name parentDirId isPublic publicRole")
            .lean();
        }
        const isMine =
          String(file.userId?._id ?? file.userId) === String(userId);
        const { owners, capabilities, permissions, sharedWithMeTime } =
          await resolveRole(file, "file", userId, parentDir, true);

        return {
          ...file,
          owners,
          capabilities,
          permissions,
          sharedWithMeTime,
          rootType: isMine ? "mine" : "shared",
        };
      }),
    );

    const directoriesWithRoles = await Promise.all(
      topLevelDirectories.map(async (directory) => {
        let parentDir = null;

        if (directory.parentDirId) {
          const parentId = getParentId(directory.parentDirId);

          if (parentId) {
            parentDir = await Directory.findById(parentId)
              .select("_id name parentDirId isPublic publicRole")
              .lean();
          }
        }
    const isMine =
          String(directory.userId?._id ?? directory.userId) === String(userId);
        const { owners, capabilities, permissions, sharedWithMeTime } =
          await resolveRole(directory, "folder", userId, parentDir, true);

        return {
          ...directory,
          owners,
          capabilities,
          permissions,
          sharedWithMeTime,
          rootType: isMine ? "mine" : "shared"
        };
      }),
    );

    return res.status(200).json({
      files: filesWithRoles,
      directories: directoriesWithRoles,
    });
  } catch (error) {
    next(error);
  }
};

export const getStarredItems = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(403).json({ message: "Access denied" });

    const [allowedFileIds, allowedFolderIds] = await Promise.all([
      listSharedObjects("file", userId),
      listSharedObjects("folder", userId),
    ]);

    const [sharedFiles, sharedDirectories, files, directories] =
      await Promise.all([
        allowedFileIds.length
          ? File.find({
              _id: { $in: allowedFileIds },
              userId: { $ne: userId },
              isStarred: true,
            })
              .populate("userId", "name email avatar")
              .populate("path", "name")
              .lean()
          : [],
        allowedFolderIds.length
          ? Directory.find({
              _id: { $in: allowedFolderIds },
              userId: { $ne: userId },
              isStarred: true,
            })
              .populate("userId", "name email avatar")
              .populate("path", "name")
              .lean()
          : [],
        File.find({ userId, isDeleted: false, isStarred: true })
          .populate("userId", "name email avatar")
          .populate("path", "name")
          .lean(),
        Directory.find({ userId, isDeleted: false, isStarred: true })
          .populate("userId", "name email avatar")
          .populate("path", "name")
          .lean(),
      ]);

    // only show top-level shared items, not children of shared folders
    const topLevelSharedFiles = sharedFiles.filter(
      (file) => !allowedFileIds.includes(file.parentDirId?.toString()),
    );

    const topLevelSharedDirs = sharedDirectories.filter(
      (dir) => !allowedFolderIds.includes(dir.parentDirId?.toString()),
    );

    const sharedFilesWithRoles = await Promise.all(
      topLevelSharedFiles.map(async (file) => {
        const { owners, capabilities, permissions } = await resolveRole(
          file,
          "file",
          userId,
          file.parentDirId,
        );
        return {
          ...file,
          owners,
          capabilities,
          permissions,
          isShared: true,
        };
      }),
    );

    const sharedDirectoriesWithRoles = await Promise.all(
      topLevelSharedDirs.map(async (dir) => {
        const { owners, capabilities, permissions } = await resolveRole(
          dir,
          "folder",
          userId,
          dir.parentDirId,
        );
        return {
          ...dir,
          owners,
          capabilities,
          permissions,
          isShared: true,
        };
      }),
    );

    const filesWithRoles = await Promise.all(
      files.map(async (file) => {
        const { owners, capabilities, permissions } = await resolveRole(
          file,
          "file",
          userId,
          file.parentDirId,
        );
        return {
          ...file,
          owners,
          capabilities,
          permissions,
        };
      }),
    );

    const directoriesWithRoles = await Promise.all(
      directories.map(async (dir) => {
        const { owners, capabilities, permissions } = await resolveRole(
          dir,
          "folder",
          userId,
          dir.parentDirId,
        );
        return {
          ...dir,
          owners,
          capabilities,
          permissions,
        };
      }),
    );

    return res.status(200).json({
      files: [...sharedFilesWithRoles, ...filesWithRoles],
      directories: [...sharedDirectoriesWithRoles, ...directoriesWithRoles],
    });
  } catch (error) {
    next(error);
  }
};
export const addDirectory = async (req, res, next) => {
  const userId = req.user._id;
  const parentDirId = req.params.parentDirId || req.user.parentDirId;
  const type = req.body.type;
  const dirname = sanitizeText(req.body.dirName) || "New folder";
  if (type === "google") {
    const { drive_access_token } = req.signedCookies;
    if (!drive_access_token) {
      return res.status(401).json({
        message: "Missing token",
      });
    }
    const drive = getDriveClient(drive_access_token);

    const response = await drive.files.create({
      requestBody: {
        name: dirname,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields:
        "id,name,webViewLink,webContentLink,mimeType,thumbnailLink,hasThumbnail,createdTime,modifiedTime,viewedByMeTime,size,owners,capabilities(canReadDrive, canEdit, canDelete, canShare, canCopy, canDownload, canRename, canAddChildren,canMoveItemWithinDrive),permissions(id,type,role,photoLink,emailAddress,displayName,allowFileDiscovery,pendingOwner)",
    });

    return res
      .status(201)
      .json({ message: "Directory Created!", data: response.data });
  }
  try {
    const parentDirectory = await Directory.findOne({
      _id: parentDirId,
    }).lean();
    if (!parentDirectory)
      return res
        .status(404)
        .json({ message: "Parent Directory does not exist" });

    // ✅ check if user can edit the parent currentDirectory
    const isOwner = parentDirectory.userId.toString() === userId.toString();
    if (!isOwner) {
      const canWrite = await fgaClient.check({
        user: getFgaObject("user", userId),
        relation: "can_write",
        object: getFgaObject("folder", parentDirId),
      });
      if (!canWrite.allowed)
        return res
          .status(403)
          .json({ message: "You don't have permission to create here" });
    }
    const fullPath = await getDirectoryPath(parentDirectory._id);

    const addedDirectory = await Directory.create({
      name: dirname,
      userId,
      parentDirId,
      path: fullPath,
    });
    await fgaClient.write({
      writes: [
        {
          user: getFgaObject("user", userId),
          relation: "owner",
          object: getFgaObject("folder", addedDirectory._id),
        },
        {
          user: getFgaObject("folder", parentDirId),
          relation: "parent",
          object: getFgaObject("folder", addedDirectory._id),
        },
      ],
    });
    const { owners, capabilities, permissions } = await resolveRole(
      addedDirectory,
      "folder",
      userId,
      parentDirId,
    );
    const createdDirectory = {
      ...addedDirectory.toObject(),
      owners,
      capabilities,
      permissions,
    };

    return res
      .status(201)
      .json({ message: "Directory Created!", data: createdDirectory });
  } catch (error) {
    next(error);
  }
};
export const editDirectory = async (req, res, next) => {
  const { id } = req.params;
  const { newDirName } = req.body;
  const userId = req.user?._id;
  if (!newDirName) {
    return res.status(404).json({ message: "Dirname is required" });
  }
  const canRename = await fgaClient.check({
    user: getFgaObject("user", userId),
    relation: "can_rename",
    object: getFgaObject("folder", id),
  });
  if (req.user.role !== "superuser" && !canRename.allowed) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  try {
    await Directory.updateOne(
      { _id: id },
      {
        name: sanitizeText(newDirName),
        modifiedTime: new Date(),
        lastModifyingUser: userId,
      },
    );

    return res.status(200).json({ message: "Renamed" });
  } catch (error) {
    next(error);
  }
};

export const softDeleteDirectory = async (req, res, next) => {
  try {
    const user = req.user;
    const ids = req.body?.ids ?? [req.params.id];

    const dirs = await Directory.find({ _id: { $in: ids }, isDeleted: false })
      .select("parentDirId userId size")
      .lean();
    if (!dirs.length)
      return res.status(404).json({ message: "Directory not found" });

    const checks = await Promise.all(
      dirs.map((d) =>
        fgaClient.check({
          user: getFgaObject("user", user._id),
          relation: "can_trash",
          object: getFgaObject("folder", d._id),
        }),
      ),
    );
    const allowed = dirs.filter(
      (_, i) => user.role === "superuser" || checks[i].allowed,
    );
    if (!allowed.length)
      return res.status(403).json({ message: "Unauthorized!" });

    // collect every nested folder + file, one query per level
    let frontier = allowed.map((d) => d._id);
    const allDirIds = [...frontier];
    const allFileIds = [];

    while (frontier.length) {
      const [childDirs, childFiles] = await Promise.all([
        Directory.find({ parentDirId: { $in: frontier }, isDeleted: false })
          .select("_id")
          .lean(),
        File.find({ parentDirId: { $in: frontier }, isDeleted: false })
          .select("_id")
          .lean(),
      ]);
      frontier = childDirs.map((d) => d._id);
      allDirIds.push(...frontier);
      allFileIds.push(...childFiles.map((f) => f._id));
    }

    const trashedTime = Date.now();
    await Promise.all([
      allFileIds.length
        ? File.updateMany(
            { _id: { $in: allFileIds } },
            { isDeleted: true, trashedTime },
          )
        : null,
      Directory.updateMany(
        { _id: { $in: allDirIds } },
        { isDeleted: true, trashedTime },
      ),
    ]);

    // one size update per parent folder
    const sizeByParent = {};
    allowed.forEach((d) => {
      const key = String(d.parentDirId);
      sizeByParent[key] = (sizeByParent[key] ?? 0) + d.size;
    });
    await Promise.all(
      Object.entries(sizeByParent).map(([dirId, size]) =>
        updateParentDirSize(dirId, -size),
      ),
    );

    return res.status(200).json({
      message: "Moved to trash",
      trashedIds: allowed.map((d) => String(d._id)),
    });
  } catch (error) {
    next(error);
  }
};
export const deleteDirectory = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = user._id;

    // Support both single and bulk deletion
    const ids = req.body?.ids ?? (req.params.id ? [req.params.id] : []);

    if (!ids.length) {
      return res.status(400).json({
        message: "Directory IDs are required",
      });
    }

    // Find all requested root directories
    const dirs = await Directory.find({
      _id: { $in: ids },
      userId,
    })
      .select("_id parentDirId")
      .lean();

    if (!dirs.length) {
      return res.status(404).json({
        message: "Directory not found",
      });
    }

    // Check permissions for all requested directories
    const checks = await Promise.all(
      dirs.map((dir) =>
        fgaClient.check({
          user: getFgaObject("user", userId),
          relation: "can_delete",
          object: getFgaObject("folder", dir._id),
        }),
      ),
    );

    const allowed = dirs.filter(
      (_, i) => user.role === "superuser" || checks[i].allowed,
    );

    if (!allowed.length) {
      return res.status(403).json({
        message: "Unauthorized!",
      });
    }

    // Collect all nested directories and files
    let frontier = allowed.map((dir) => dir._id);

    const allDirIds = [...frontier];

    const allDirDetails = [...allowed];

    const allFiles = [];

    while (frontier.length) {
      const [childDirs, childFiles] = await Promise.all([
        Directory.find({
          parentDirId: { $in: frontier },
          userId,
        })
          .select("_id parentDirId")
          .lean(),

        File.find({
          parentDirId: { $in: frontier },
          userId,
        })
          .select("_id parentDirId extension")
          .lean(),
      ]);

      frontier = childDirs.map((dir) => dir._id);

      allDirIds.push(...frontier);
      allDirDetails.push(...childDirs);
      allFiles.push(...childFiles);
    }

    // Delete files from S3
    if (allFiles.length) {
      await deleteFileArray(allFiles);
    }

    const fileIds = allFiles.map((file) => file._id);

    // Delete MongoDB metadata
    await Promise.all([
      fileIds.length
        ? File.deleteMany({ _id: { $in: fileIds } })
        : Promise.resolve(),

      Directory.deleteMany({ _id: { $in: allDirIds } }),
    ]);

    // Prepare OpenFGA relationship deletions
    const deletes = [
      ...allFiles.flatMap((file) => {
        const object = getFgaObject("file", file._id);

        return [
          {
            user: getFgaObject("user", userId),
            relation: "owner",
            object,
          },
          {
            user: getFgaObject("user", userId),
            relation: "writer",
            object,
          },
          {
            user: getFgaObject("user", userId),
            relation: "reader",
            object,
          },
          {
            user: getFgaObject("folder", file.parentDirId),
            relation: "parent",
            object,
          },
        ];
      }),

      ...allDirDetails.flatMap((dir) => {
        const object = getFgaObject("folder", dir._id);

        return [
          {
            user: getFgaObject("user", userId),
            relation: "owner",
            object,
          },
          {
            user: getFgaObject("user", userId),
            relation: "writer",
            object,
          },
          {
            user: getFgaObject("user", userId),
            relation: "reader",
            object,
          },
          {
            user: getFgaObject("folder", dir.parentDirId),
            relation: "parent",
            object,
          },
        ];
      }),
    ];

    // Delete OpenFGA relationships in batches of 100
    const batchSize = 100;

    for (let i = 0; i < deletes.length; i += batchSize) {
      await fgaClient.write(
        {
          deletes: deletes.slice(i, i + batchSize),
        },
        {
          conflict: {
            onMissingDeletes: ClientWriteRequestOnMissingDeletes.Ignore,
          },
        },
      );
    }

    return res.status(200).json({
      message: "Directory deleted successfully",
      deletedIds: allowed.map((dir) => String(dir._id)),
      deleted: {
        directories: allDirIds.length,
        files: fileIds.length,
      },
    });
  } catch (error) {
    console.error("Directory delete error:", error);
    next(error);
  }
};
export const restoreDirectory = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const ids = (req.body?.ids ?? [req.params.id]).filter((id) =>
      mongoose.isValidObjectId(id),
    );
    if (!ids.length) return res.status(400).json({ message: "No valid ids" });

    const dirs = await Directory.find({ _id: { $in: ids }, isDeleted: true });
    if (!dirs.length) {
      return res.status(404).json({ message: "Directory not found" });
    }

    // storage check for ALL folders together
    const rootDir = await Directory.findOne({ userId }).lean();
    const totalNeeded = dirs.reduce((sum, d) => sum + d.size, 0);
    const storageLeft = req.user.totalStorage - rootDir.size;

    if (totalNeeded > storageLeft) {
      return res.status(507).json({
        message: `Storage is full. You need ${formatSize(totalNeeded - storageLeft)} more storage`,
      });
    }

    // collect every nested folder + file, one query per level
    let frontier = dirs.map((d) => d._id);
    const allDirIds = [...frontier];
    const allFileIds = [];

    while (frontier.length) {
      const [childDirs, childFiles] = await Promise.all([
        Directory.find({ parentDirId: { $in: frontier } })
          .select("_id")
          .lean(),
        File.find({ parentDirId: { $in: frontier } })
          .select("_id")
          .lean(),
      ]);
      frontier = childDirs.map((d) => d._id);
      allDirIds.push(...frontier);
      allFileIds.push(...childFiles.map((f) => f._id));
    }

    await Promise.all([
      Directory.updateMany({ _id: { $in: allDirIds } }, { isDeleted: false }),
      allFileIds.length
        ? File.updateMany({ _id: { $in: allFileIds } }, { isDeleted: false })
        : null,
    ]);

    // one size update per parent folder
    const sizeByParent = {};
    dirs.forEach((d) => {
      const key = String(d.parentDirId);
      sizeByParent[key] = (sizeByParent[key] ?? 0) + d.size;
    });
    await Promise.all(
      Object.entries(sizeByParent).map(([dirId, size]) =>
        updateParentDirSize(dirId, size),
      ),
    );

    return res.status(200).json({
      message: "Restored successfully",
      restoredIds: dirs.map((d) => String(d._id)),
    });
  } catch (error) {
    next(error);
  }
};

export const requestAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, message } = req.body;
    const userId = req.user._id;

    const currentDirectory = await Directory.findById(id)
      .populate("userId", "name email")
      .lean();
    if (!currentDirectory)
      return res.status(404).json({ message: "Directory not found" });

    const requester = await User.findById(userId).lean();

    const cleanMessage = sanitizeText(message || "");

    await sendRequestAccessEmail({
      toEmail: currentDirectory.userId.email,
      toName: currentDirectory.userId.name,
      fromName: requester.name,
      fromEmail: requester.email,
      fromUserId: requester._id.toString(),
      itemName: currentDirectory.name,
      itemType: "folder",
      itemId: id,
      itemUrl: `${process.env.CLIENT_URL}/currentDirectory/${id}`,
      role,
      cleanMessage,
    });

    return res.status(200).json({ message: "Access requested" });
  } catch (error) {
    next(error);
  }
};

export const sendLink = async (req, res, next) => {
  try {
    const { items, toEmails, message, notifyPeople } = req.body;

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({
        message: "Send between 1 and 50 items",
      });
    }

    if (!Array.isArray(toEmails) || toEmails.length === 0) {
      return res.status(400).json({
        message: "At least one recipient is required",
      });
    }

    if (!notifyPeople) {
      return res.status(200).json({
        message: "Item Shared",
      });
    }

    const sender = await User.findById(req.user._id)
      .select("name email")
      .lean();

    const cleanMessage = sanitizeText(message || "");

    const recipients = [
      ...new Set(
        toEmails
          .filter((email) => typeof email === "string")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    const validItems = [];
    const failed = [];

    // Build and validate all items once
    for (const it of items) {
      if (!it.id || !it.type) {
        failed.push({
          id: it.id,
          reason: "Missing item ID or type",
        });
        continue;
      }

      try {
        let emailItem;

        if (it.type.startsWith("google-drive")) {
          if (!it.url) {
            throw new Error("Missing Google Drive URL");
          }

          emailItem = {
            name: sanitizeText(it.name || ""),
            type: it.type,
            url: it.url,
            isPublic: Boolean(it.isPublic),
            publicRole: it.publicRole || "reader",
          };
        } else {
          if (!["file", "folder"].includes(it.type)) {
            throw new Error("Invalid item type");
          }

          const Model = it.type === "folder" ? Directory : File;

          const doc = await Model.findById(it.id).lean();

          if (!doc) {
            throw new Error("Item not found");
          }

          emailItem = {
            name: sanitizeText(doc.name),
            type: it.type,
            url: `${process.env.CLIENT_URL}/${it.type === "folder" ? "directory" : "file"}/${it.id}`,
            isPublic: doc.isPublic,
            publicRole: doc.publicRole,
          };
        }

        validItems.push({
          id: it.id,
          emailItem,
        });
      } catch (error) {
        failed.push({
          id: it.id,
          reason: error.message,
        });
      }
    }

    // One email per recipient containing all selected items
    let successfulRecipients = 0;

    for (const toEmail of recipients) {
      try {
        await sendLinkEmail({
          toEmail,
          fromName: sanitizeText(sender.name),
          fromEmail: sender.email,
          message: cleanMessage,
          items: validItems.map((entry) => entry.emailItem),
        });

        successfulRecipients++;
      } catch (error) {
        failed.push({
          recipient: toEmail,
          reason: error.message,
        });
      }
    }

    const sent = successfulRecipients > 0 ? validItems.length : 0;

    if (!sent) {
      return res.status(500).json({
        message: "Failed to send links",
        sent: 0,
        failed,
      });
    }

    return res.status(200).json({
      message:
        failed.length > 0
          ? `Successfully sent links to ${successfulRecipients} of ${recipients.length} recipients`
          : recipients.length > 1
            ? `Links sent to ${recipients.length} recipients`
            : "Links sent",
      sent,
      failed,
      successfulRecipients,
    });
  } catch (error) {
    next(error);
  }
};

export const toggleItemStar = async (req, res, next) => {
  try {
    const { id, type } = req.params;
    const allowedTypes = ["file", "folder"];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        message: "Invalid item type",
      });
    }
    if (!id || !type) {
      return res.status(400).json({
        message: "Item id and type are required",
      });
    }

    const Model = type === "folder" ? Directory : File;

    const item = await Model.findById(id);
    if (!item) {
      return res.status(404).json({
        message: "Item not found",
      });
    }

    item.isStarred = !item.isStarred;
    await item.save();

    return res.status(200).json({
      message: item.isStarred
        ? "Item starred successfully"
        : "Item unstarred successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const sendOwnershipMail = async (req, res, next) => {
  try {
    const { newOwner, itemId, type } = req.body;

    const currentOwnerId = req.user?._id;
    const currentOwnerName = req.user?.name;

    if (!itemId || !type) {
      return res.status(400).json({
        message: "itemId and type are required",
      });
    }
    if (type === "google") {
      const { drive_access_token } = req.signedCookies;

      if (!drive_access_token) {
        return res.status(401).json({
          message: "Missing token",
        });
      }

      const drive = getDriveClient(drive_access_token);
      const permissions = await drive.permissions.list({
        fileId: itemId,
        fields: "permissions(id,type,emailAddress,role,pendingOwner)",
      });

      const existingPermission = permissions.data.permissions?.find(
        (p) =>
          p.type === "user" &&
          p.emailAddress?.toLowerCase() === newOwner.emailAddress.toLowerCase(),
      );

      let result;

      if (existingPermission) {
        try {
          result = await drive.permissions.update({
            fileId: itemId,
            permissionId: existingPermission.id,
            requestBody: { role: "writer", pendingOwner: true },
            fields: "id,type,emailAddress,role,pendingOwner",
          });
        } catch (err) {
          const reason = err?.response?.data?.error?.errors?.[0]?.reason;
          if (reason === "targetUserCannotBePendingOwnerOnFile") {
            return res.status(400).json({
              message:
                "This account can't receive ownership from a personal Google account. Ask them to make a copy, or use a Gmail account.",
              reason,
            });
          }
          throw err;
        }
      } else {
        result = await drive.permissions.create({
          fileId: itemId,
          sendNotificationEmail: true,
          requestBody: {
            type: "user",
            role: "writer",
            emailAddress: newOwner.emailAddress,
            pendingOwner: true,
          },
          fields: "id,type,emailAddress,role,pendingOwner",
        });
      }

      return res.status(200).json({
        message: "Ownership transfer request sent",
        permission: result.data,
      });
    }

    if (!["folder", "file"].includes(type)) {
      return res.status(400).json({
        message: "Invalid resource type. Expected 'folder' or 'file'",
      });
    }

    if (String(currentOwnerId) === String(newOwner.id)) {
      return res.status(400).json({
        message: "The new owner must be different from the current owner",
      });
    }

    const itemType = type === "folder" ? "Directory" : "File";
    const Model = type === "folder" ? Directory : File;
    const object = `${type}:${itemId}`;

    const { allowed: isOwner } = await fgaClient.check({
      user: `user:${currentOwnerId}`,
      relation: "owner",
      object,
    });

    if (!isOwner) {
      return res.status(403).json({
        message: "You do not have permission to transfer ownership",
      });
    }

    const resource = await Model.findOne({
      _id: itemId,
      userId: currentOwnerId,
    }).populate("parentDirId");

    if (!resource) {
      return res.status(404).json({
        message: `${type} not found`,
      });
    }

    const transfer = await Ownership.create({
      itemId,
      itemType,
      fromUser: currentOwnerId,
      toUser: newOwner.id,
      status: "pending",
    });
    await sendOwnershipTransferEmail({
      to: newOwner.emailAddress,
      toName: newOwner.displayName,
      fromName: currentOwnerName,
      itemName: resource.name,
      transferId: transfer._id,
      expiresAt: transfer.expiresAt,
    });
    const finalResponse = await resolveRole(
      resource,
      type,
      newOwner.id,
      resource.parentDirId,
    );
    return res.status(200).json({
      message: "Ownership mail sent successfully!",
      permissions: finalResponse.permissions,
    });
  } catch (error) {
    console.error("OWNERSHIP MAIL ERROR:", error);
    return next(error);
  }
};
export const cancelOwnershipMail = async (req, res, next) => {
  try {
    const { newOwner, itemId, type } = req.body;
    const currentOwnerId = req.user?._id;
    const newOwnerId = newOwner?._id || newOwner?.id;
    const currentOwnerName = req.user?.name;

    if (!newOwner || !itemId) {
      return res.status(400).json({
        message: "newOwner and itemId are required",
      });
    }
    if (type === "google") {
      const { drive_access_token } = req.signedCookies;

      if (!drive_access_token) {
        return res.status(401).json({
          message: "Missing token",
        });
      }

      const drive = getDriveClient(drive_access_token);
      const permissions = await drive.permissions.list({
        fileId: itemId,
        fields: "permissions(id,type,emailAddress,role,pendingOwner)",
      });

      const existingPermission = permissions.data.permissions?.find(
        (p) =>
          p.type === "user" &&
          p.emailAddress?.toLowerCase() === newOwner.emailAddress.toLowerCase(),
      );

      let result;

      if (existingPermission) {
        result = await drive.permissions.update({
          fileId: itemId,
          permissionId: existingPermission.id,
          requestBody: {
            role: "writer",
            pendingOwner: true,
          },
          fields: "id,type,emailAddress,role,pendingOwner",
        });
      } else {
        result = await drive.permissions.create({
          fileId: itemId,
          sendNotificationEmail: true,
          requestBody: {
            type: "user",
            role: "writer",
            emailAddress: newOwner.emailAddress,
            pendingOwner: true,
          },
          fields: "id,type,emailAddress,role,pendingOwner",
        });
      }

      return res.status(200).json({
        message: "Ownership transfer request sent",
        permission: result.data,
      });
    }
    const ownership = await Ownership.findOne({ toUser: newOwnerId })
      .sort({ createdAt: -1 })
      .populate("itemId");

    if (!ownership) {
      return res
        .status(400)
        .json({ message: "No active link sent to the provided user!" });
    }
    ownership.status = "cancelled";
    await ownership.save();
    const itemtype = ownership.itemType === "Directory" ? "folder" : "file";

    const finalResponse = await resolveRole(
      ownership.itemId,
      itemtype,
      newOwnerId,
      ownership.itemId.parentDirId,
    );
    return res.status(200).json({
      message: "Ownership mail cancelled successfully!",
      permissions: finalResponse.permissions,
    });
  } catch (error) {
    return next(error);
  }
};

export const ownershipAction = async (req, res, next) => {
  try {
    const { action, transferId } = req.params;

    // VALIDATION

    if (!transferId || !action) {
      return res.status(400).json({
        message: "Id or action is required!",
      });
    }

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        message: "Invalid ownership action!",
      });
    }

    // GET OWNERSHIP

    const ownership = await Ownership.findById(transferId)
      .populate("fromUser")
      .populate("toUser");

    if (!ownership) {
      return res.status(404).json({
        message: "Ownership transfer not found!",
      });
    }

    if (ownership.status !== "pending") {
      return res.status(400).json({
        message: `This ownership transfer has already been ${ownership.status}.`,
      });
    }

    // EXPIRY

    if (ownership.expiresAt && ownership.expiresAt.getTime() < Date.now()) {
      await updateOwnershipStatus(ownership, "cancelled");

      return res.status(400).json({
        message: "Ownership transfer expired!",
      });
    }

    // GET RESOURCE

    const Model = getOwnershipModel(ownership.itemType);

    const item = await Model.findById(ownership.itemId);

    if (!item) {
      return res.status(400).json({
        message: "Resource invalid!",
      });
    }

    // REJECT

    if (action === "reject") {
      await updateOwnershipStatus(ownership, "rejected");

      await sendOwnershipTransferResultEmail({
        to: ownership.fromUser?.email,
        toName: ownership.fromUser?.name,
        newOwnerName: ownership.toUser?.name,
        itemName: item.name,
        itemType: ownership.itemType === "Directory" ? "Folder" : "File",
        status: "rejected",
      });

      return res.redirect(`${process.env.CLIENT_URL}/home?ownership=rejected`);
    }

    // ACCEPT

    const oldOwnerId = ownership.fromUser._id;

    const newOwnerId = ownership.toUser._id;

    // FGA
    await transferFgaOwnership({
      itemType: ownership.itemType,
      itemId: item._id,
      oldOwnerId,
      newOwnerId,
    });

    // ROOT DIRECTORIES

    const { currentOwnerRootDir, newOwnerRootDir } = await getOwnerRoots(
      oldOwnerId,
      newOwnerId,
    );

    // STORAGE

    await updateOwnerStorage({
      oldRootId: currentOwnerRootDir._id,
      newRootId: newOwnerRootDir._id,
      size: item.size,
    });

    // RESOURCE

    const newDirectoryPath = await updateResourceOwnership({
      item,
      newOwnerId,
      newOwnerRootId: newOwnerRootDir._id,
    });

    // DIRECTORY CHILDREN

    if (ownership.itemType === "Directory") {
      await updateDirectoryChildren({
        directoryId: item._id,
        newOwnerId,
        newDirectoryPath,
      });
    }

    // ACCEPTED

    await updateOwnershipStatus(ownership, "accepted");

    // NOTIFY OLD OWNER

    await sendOwnershipTransferResultEmail({
      to: ownership.fromUser?.email,
      toName: ownership.fromUser?.name,
      newOwnerName: ownership.toUser?.name,
      itemName: item.name,
      itemType: ownership.itemType === "Directory" ? "Folder" : "File",
      status: "accepted",
    });

    return res.redirect(`${process.env.CLIENT_URL}/home?ownership=accepted`);
  } catch (error) {
    next(error);
  }
};
export const downloadFolder = async (req, res, next) => {
  let archive = null;
  let cancelled = false;

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Missing folder id",
      });
    }

    const folder = await Directory.findOne({
      _id: id,
      isDeleted: false,
    }).lean();
    if (!folder) {
      return res.status(404).json({
        message: "Folder not found",
      });
    }

    const zipName = `${folder.name || "folder"}.zip`.replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_",
    );

    res.setHeader("Content-Type", "application/zip");

    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    archive = new ZipArchive({
      zlib: {
        level: 6,
      },
    });

    const cancelDownload = () => {
      if (cancelled) {
        return;
      }

      cancelled = true;

      console.log("Folder download cancelled by client");

      try {
        archive.abort();
      } catch {}

      try {
        if (!res.destroyed) {
          res.destroy();
        }
      } catch {}
    };

    req.once("aborted", cancelDownload);

    res.once("close", () => {
      if (!res.writableFinished) {
        cancelDownload();
      }
    });

    archive.on("error", (error) => {
      if (cancelled) {
        return;
      }

      console.error("ZIP error:", error);

      if (!res.destroyed) {
        res.destroy(error);
      }
    });

    archive.pipe(res);

    const directories = await Directory.find({
      isDeleted: false,
      path: folder._id,
    })
      .select("_id name parentDirId path")
      .lean();

    const directoryMap = new Map();

    directoryMap.set(folder._id.toString(), folder.name);

    for (const directory of directories) {
      directoryMap.set(directory._id.toString(), directory.name);
    }

    const files = await File.find({
      isDeleted: false,
      isUploading: false,
      path: folder._id,
    })
      .select("_id name extension size parentDirId path")
      .lean();

    console.log(`Folder "${folder.name}" contains ${files.length} files`);

    for (const directory of directories) {
      if (cancelled) {
        return;
      }

      const relativePath = buildDirectoryPath(
        directory,
        folder._id,
        directoryMap,
      );

      if (!relativePath) {
        continue;
      }

      archive.append("", {
        name: `${relativePath}/`,
      });
    }

    let completed = 0;

    for (const file of files) {
      if (cancelled) {
        return;
      }

      const s3Key = `${file._id}${file.extension}`;

      const safeFileName = (file.name || "file").replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        "_",
      );

      const folderPath = buildFilePath(file, folder._id, directoryMap);

      const zipPath = folderPath
        ? `${folderPath}/${safeFileName}`
        : safeFileName;

      console.log(`Adding ${completed + 1}/${files.length}: ${zipPath}`);

      const s3Response = await getFile(s3Key);

      if (cancelled) {
        return;
      }

      if (!s3Response?.Body) {
        console.log(`Skipping missing S3 object: ${s3Key}`);

        continue;
      }

      await new Promise((resolve, reject) => {
        const stream = s3Response.Body;

        let finished = false;

        const cleanup = () => {
          stream.removeListener("end", onEnd);

          stream.removeListener("error", onError);

          stream.removeListener("aborted", onAborted);
        };

        const finish = () => {
          if (finished) {
            return;
          }

          finished = true;

          cleanup();

          resolve();
        };

        const onEnd = () => {
          finish();
        };

        const onError = (error) => {
          if (finished) {
            return;
          }

          finished = true;

          cleanup();

          reject(error);
        };

        const onAborted = () => {
          if (finished) {
            return;
          }

          finished = true;

          cleanup();

          reject(new Error("S3 stream aborted"));
        };

        stream.once("end", onEnd);

        stream.once("error", onError);

        stream.once("aborted", onAborted);

        archive.append(stream, {
          name: zipPath,
        });
      });

      if (cancelled) {
        return;
      }

      completed++;

      const progress =
        files.length > 0 ? Math.round((completed / files.length) * 100) : 100;

      console.log(`ZIP progress: ${progress}%`);
    }

    if (cancelled) {
      return;
    }

    console.log("Finalizing folder ZIP...");

    await new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        archive.removeListener("error", onError);

        res.removeListener("error", onResponseError);
      };

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;

        cleanup();

        resolve();
      };

      const onError = (error) => {
        if (settled) {
          return;
        }

        settled = true;

        cleanup();

        reject(error);
      };

      const onResponseError = (error) => {
        onError(error);
      };

      archive.once("error", onError);

      res.once("error", onResponseError);

      archive.finalize();

      res.once("finish", finish);
    });

    req.removeListener("aborted", cancelDownload);

    console.log("Folder download completed");
  } catch (error) {
    if (
      cancelled ||
      req.aborted ||
      error?.code === "ECONNABORTED" ||
      error?.code === "ABORTED" ||
      error?.code === "QUEUECLOSED"
    ) {
      console.log("Folder download cancelled by client");

      return;
    }

    if (res.headersSent) {
      if (!res.destroyed) {
        res.destroy();
      }

      return;
    }

    console.error("Folder download error:", error);

    next(error);
  }
};

const buildDirectoryPath = (directory, rootFolderId, directoryMap) => {
  const pathIds = directory.path || [];

  const rootIndex = pathIds.findIndex(
    (id) => id.toString() === rootFolderId.toString(),
  );

  if (rootIndex === -1) {
    return directory.name;
  }

  const ids = [...pathIds.slice(rootIndex + 1), directory._id];

  return ids
    .map((id) => directoryMap.get(id.toString()))
    .filter(Boolean)
    .join("/");
};

const buildFilePath = (file, rootFolderId, directoryMap) => {
  const pathIds = file.path || [];

  const rootIndex = pathIds.findIndex(
    (id) => id.toString() === rootFolderId.toString(),
  );

  if (rootIndex === -1) {
    return "";
  }

  return pathIds
    .slice(rootIndex + 1)
    .map((id) => directoryMap.get(id.toString()))
    .filter(Boolean)
    .join("/");
};
export const getDownloadProgress = async (req, res) => {
  const { jobId } = req.params;

  const job = downloadJobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      message: "Download job not found",
    });
  }

  return res.json({
    status: job.status,
    progress: job.progress,
    completed: job.completed,
    total: job.total,
    error: job.error,
  });
};

export const initiateFolderUpload = async (req, res, next) => {
  const createdFileIds = [];
  const createdDirectoryIds = [];

  try {
    const userId = req.user._id;

    const { files } = req.body;

    const parentDirId = req.body.parentDirId || null;

    if (!Array.isArray(files) || !files.length) {
      return res.status(400).json({
        message: "No files provided",
      });
    }

    let parentDir;

    if (parentDirId) {
      parentDir = await Directory.findOne({
        _id: parentDirId,
        userId,
        isDeleted: false,
      });
    } else {
      parentDir = await Directory.findOne({
        userId,
        parentDirId: null,
        isDeleted: false,
      });
    }

    if (!parentDir) {
      return res.status(404).json({
        message: "Parent directory not found",
      });
    }

    const subscription = await Subscription.findOne({
      userId,
    });

    if (subscription && subscription.status !== "active") {
      await updateUserPlan(userId, {
        uploadLimit: 0,
      });

      return res.status(403).json({
        message: "Your subscription is not active.",
      });
    }

    const user = req.user;

    const uploadLimit = Number(user.uploadLimit || 0);

    const totalStorage = Number(user.totalStorage || 0);

    const rootDir = await Directory.findOne({
      userId,
      parentDirId: null,
      isDeleted: false,
    }).lean();

    if (!rootDir) {
      return res.status(404).json({
        message: "Root directory not found",
      });
    }

    const totalStorageUsed = Number(rootDir.size || 0);

    const totalStorageLeft = totalStorage - totalStorageUsed;

    let totalUploadSize = 0;

    for (const file of files) {
      const size = Number(file.size || 0);

      if (!size || size < 0) {
        return res.status(400).json({
          message: `Invalid file size for ${file.name}`,
        });
      }

      if (size > uploadLimit) {
        return res.status(413).json({
          message: `File ${file.name} exceeds your upload limit`,
        });
      }

      totalUploadSize += size;
    }

    if (totalUploadSize > totalStorageLeft) {
      const needed = totalUploadSize - totalStorageLeft;

      return res.status(507).json({
        message: `Storage is full. You need ${formatSize(needed)} more storage`,
      });
    }

    const directoryCache = new Map();

    // Root/current parent
    directoryCache.set(String(parentDir._id), parentDir);

    const getOrCreateDirectory = async (directoryName, parent) => {
      const cacheKey = `${parent._id}:${directoryName}`;

      const cached = directoryCache.get(cacheKey);

      if (cached) {
        return cached;
      }

      let directory = await Directory.findOne({
        name: directoryName,
        parentDirId: parent._id,
        userId,
        isDeleted: false,
      });

      if (!directory) {
        const parentPath = Array.isArray(parent.path) ? parent.path : [];

        directory = await Directory.create({
          name: directoryName,

          size: 0,

          parentDirId: parent._id,

          path: [...parentPath, parent._id],

          userId,

          isPublic: false,

          isStarred: false,

          isDeleted: false,

          modifiedTime: new Date(),
        });

        createdDirectoryIds.push(directory._id);
      }

      const fgaWrites = [
        {
          user: getFgaObject("user", userId),

          relation: "owner",

          object: getFgaObject("folder", directory._id),
        },
      ];

      if (directory.parentDirId) {
        fgaWrites.push({
          user: getFgaObject("folder", directory.parentDirId),

          relation: "parent",

          object: getFgaObject("folder", directory._id),
        });
      }

      await fgaClient.write({
        writes: fgaWrites,
      });

      directoryCache.set(cacheKey, directory);

      return directory;
    };

    const resolveFileParent = async (relativePath) => {
      const normalizedPath = String(relativePath || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+/g, "/");

      const parts = normalizedPath.split("/").filter(Boolean);

      if (!parts.length) {
        return parentDir;
      }

      parts.pop();

      let current = parentDir;

      for (const rawFolderName of parts) {
        const folderName = sanitizeFilename(rawFolderName) || "untitled";

        current = await getOrCreateDirectory(folderName, current);
      }

      return current;
    };

    const uploadResults = [];

    for (let index = 0; index < files.length; index++) {
      const inputFile = files[index];

      const originalName = String(inputFile.name || "untitled");

      const relativePath = String(inputFile.relativePath || originalName)
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+/g, "/");

      const fileParentDir = await resolveFileParent(relativePath);

      const rawFileName = path.basename(originalName);

      let fileName = sanitizeFilename(rawFileName) || "untitled";

      let extension = path.extname(fileName);

      const contentType = inputFile.contentType || "application/octet-stream";

      if (!extension) {
        const mimeExtension = contentType.includes("/")
          ? contentType.split("/").pop()
          : "";

        if (mimeExtension && mimeExtension !== "octet-stream") {
          extension = `.${mimeExtension}`;
        }
      }

      const currentPlan = user.plan;

      const parentPath = Array.isArray(fileParentDir.path)
        ? fileParentDir.path
        : [];

      const filePath = [...parentPath, fileParentDir._id];

      const uploadedFile = await File.create({
        name: fileName,

        extension: extension || "",

        size: Number(inputFile.size || 0),

        parentDirId: fileParentDir._id,

        path: filePath,

        userId,

        currentPlan,

        isUploading: true,

        modifiedTime: new Date(),
      });

      createdFileIds.push(uploadedFile._id);

      const s3Key = `${uploadedFile._id}${uploadedFile.extension}`;

      const uploadUrl = await getSignedUploadUrl(s3Key, contentType);

      uploadResults.push({
        index,

        fileId: uploadedFile._id,

        uploadUrl,

        contentType,

        name: fileName,

        size: Number(inputFile.size || 0),

        relativePath,

        parentDirId: fileParentDir._id,
      });
    }

    return res.status(200).json({
      message: "Folder upload initialized",

      parentDirId: parentDir._id,

      files: uploadResults,
    });
  } catch (error) {
    console.error("Folder upload initialization error:", error);

    if (createdFileIds.length) {
      await File.deleteMany({
        _id: {
          $in: createdFileIds,
        },
      }).catch(() => {});
    }

    if (createdDirectoryIds.length) {
      await Directory.deleteMany({
        _id: {
          $in: createdDirectoryIds,
        },
      }).catch(() => {});
    }

    return next(error);
  }
};

export const completeFolderUpload = async (req, res, next) => {
  try {
    const { fileId } = req.body;

    const userId = req.user._id;

    if (!fileId) {
      return res.status(400).json({
        message: "Missing fileId",
      });
    }

    const uploadedFile = await File.findOne({
      _id: fileId,
      userId,
    });

    if (!uploadedFile) {
      return res.status(404).json({
        message: "File not found in the backend",
      });
    }

    const s3Key = `${uploadedFile._id}${uploadedFile.extension}`;

    let contentLength;

    try {
      contentLength = await getFileSize(s3Key);
    } catch (error) {
      await deleteFileFromS3(s3Key).catch(() => {});

      await uploadedFile.deleteOne().catch(() => {});

      return res.status(404).json({
        message: "Upload corrupted",
      });
    }

    if (Number(uploadedFile.size) !== Number(contentLength)) {
      await deleteFileFromS3(s3Key).catch(() => {});

      await uploadedFile.deleteOne().catch(() => {});

      return res.status(400).json({
        message: "File size doesn't match",
      });
    }

    try {
      await fgaClient.write({
        writes: [
          {
            user: getFgaObject("user", userId),

            relation: "owner",

            object: getFgaObject("file", uploadedFile._id),
          },

          {
            user: getFgaObject("folder", uploadedFile.parentDirId),

            relation: "parent",

            object: getFgaObject("file", uploadedFile._id),
          },
        ],
      });
    } catch (error) {
      await deleteFileFromS3(s3Key).catch(() => {});

      await uploadedFile.deleteOne().catch(() => {});

      return next(error);
    }

    uploadedFile.isUploading = false;

    await uploadedFile.save();

    await updateParentDirSize(uploadedFile.parentDirId, uploadedFile.size);

    return res.status(201).json({
      message: "Folder file uploaded successfully",

      fileId: uploadedFile._id,
    });
  } catch (error) {
    return next(error);
  }
};

export const copyItems = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const providerType = req.body?.providerType;

    const items = req.body?.items ?? (req.body?.item ? [req.body.item] : []);

    const allowedProviderTypes = ["local", "google"];

    // =========================================
    // VALIDATION
    // =========================================

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!items.length) {
      return res.status(400).json({
        message: "At least one item is required",
      });
    }

    if (!allowedProviderTypes.includes(providerType)) {
      return res.status(400).json({
        message: "Invalid provider type",
      });
    }

    const normalizedItems = items.map((item) => ({
      ...item,
      itemId: item?._id || item?.id,
      type: item?.isDirectory
        ? "folder"
        : item?.type || req.body?.type || "file",
    }));

    for (const item of normalizedItems) {
      if (!item.itemId) {
        return res.status(400).json({
          message: "Item ID is required",
        });
      }

      if (!["file", "folder"].includes(item.type)) {
        return res.status(400).json({
          message: "Invalid item type",
        });
      }
    }

    // =========================================
    // GOOGLE DRIVE
    // =========================================

    if (providerType === "google") {
      const { drive_access_token } = req.signedCookies;

      if (!drive_access_token) {
        return res.status(401).json({
          message: "Missing Google Drive token",
        });
      }

      const drive = getDriveClient(drive_access_token);

      const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";

      const GOOGLE_FIELDS = [
        "id",
        "name",
        "mimeType",
        "parents",
        "webViewLink",
        "owners",
        "createdTime",
        "modifiedTime",
        "capabilities",
      ].join(",");

      // -----------------------------------------
      // Fetch complete copied item information
      // -----------------------------------------

      const getGoogleItemDetails = async (fileId) => {
        const [fileResponse, permissionsResponse] = await Promise.all([
          drive.files.get({
            fileId,
            fields: GOOGLE_FIELDS,
          }),

          drive.permissions.list({
            fileId,
            fields:
              "permissions(id,type,emailAddress,role,pendingOwner,displayName)",
          }),
        ]);

        return {
          ...fileResponse.data,
          owners: fileResponse.data.owners || [],
          capabilities: fileResponse.data.capabilities || {},
          permissions: permissionsResponse.data.permissions || [],
        };
      };

      // -----------------------------------------
      // Recursively copy Google Drive folders
      // -----------------------------------------

      const copyGoogleFolder = async (
        sourceFolderId,
        destinationParentId,
        newName,
      ) => {
        const folderResponse = await drive.files.create({
          requestBody: {
            name: newName,
            mimeType: GOOGLE_FOLDER_MIME,
            parents: [destinationParentId],
          },
          fields: "id",
        });

        const newFolderId = folderResponse.data.id;

        let nextPageToken;

        do {
          const response = await drive.files.list({
            q: `'${sourceFolderId}' in parents and trashed = false`,
            fields: "nextPageToken,files(id,name,mimeType)",
            pageToken: nextPageToken,
            pageSize: 1000,
          });

          for (const file of response.data.files || []) {
            if (file.mimeType === GOOGLE_FOLDER_MIME) {
              await copyGoogleFolder(file.id, newFolderId, file.name);
            } else {
              await drive.files.copy({
                fileId: file.id,
                requestBody: {
                  name: file.name,
                  parents: [newFolderId],
                },
                fields: "id",
              });
            }
          }

          nextPageToken = response.data.nextPageToken;
        } while (nextPageToken);

        return getGoogleItemDetails(newFolderId);
      };

      // -----------------------------------------
      // Copy selected items
      // -----------------------------------------

      const copiedItems = [];

      for (const item of normalizedItems) {
        if (item.type === "file") {
          const copiedFile = await drive.files.copy({
            fileId: item.itemId,
            requestBody: {
              name: `Copy of ${item.name || "file"}`,
            },
            fields: "id",
          });

          const copiedItem = await getGoogleItemDetails(copiedFile.data.id);

          copiedItems.push({
            copiedItem,
          });
        } else {
          const sourceFolder = await drive.files.get({
            fileId: item.itemId,
            fields: "id,name,parents,mimeType",
          });

          const destinationParentId = sourceFolder.data.parents?.[0];

          if (!destinationParentId) {
            return res.status(400).json({
              message: `Could not determine destination parent for ${sourceFolder.data.name}`,
            });
          }

          const copiedFolder = await copyGoogleFolder(
            item.itemId,
            destinationParentId,
            `Copy of ${sourceFolder.data.name}`,
          );

          copiedItems.push({
            copiedItem: copiedFolder,
          });
        }
      }

      return res.status(200).json({
        message: `${copiedItems.length} item(s) copied successfully`,
        data: {
          copiedItems,
        },
      });
    }

    // =========================================
    // LOCAL STORAGE
    // =========================================

    // -----------------------------------------
    // Check copy permissions
    // -----------------------------------------

    const checks = await Promise.all(
      normalizedItems.map((item) =>
        fgaClient.check({
          user: getFgaObject("user", userId),
          relation: "can_copy",
          object: getFgaObject(item.type, item.itemId),
        }),
      ),
    );

    if (checks.some((check) => !check.allowed)) {
      return res.status(403).json({
        message: "Unauthorized! You cannot copy one or more items.",
      });
    }

    const relationships = [];
    const createdItems = [];

    // -----------------------------------------
    // Recursively copy local files and folders
    // -----------------------------------------

    const copyLocalItem = async (source, type, parentDirId, path, name) => {
      const Model = type === "folder" ? Directory : File;

      const copiedItem = new Model({
        name,
        size: source.size,
        parentDirId,
        path,
        userId: source.userId,
        isPublic: source.isPublic,
        publicRole: source.publicRole,
      });

      if (type === "file") {
        copiedItem.extension = source.extension;
        copiedItem.isUploading = true;

        const newS3Key = `${copiedItem._id}${copiedItem.extension}`;

        const oldS3Key = `${source._id}${source.extension}`;

        await copyS3File(oldS3Key, newS3Key);

        copiedItem.isUploading = false;
      }

      await copiedItem.save();

      // Collect OpenFGA relationships
      relationships.push(
        {
          user: getFgaObject("user", userId),
          relation: "owner",
          object: getFgaObject(type, copiedItem._id),
        },
        {
          user: getFgaObject("folder", parentDirId),
          relation: "parent",
          object: getFgaObject(type, copiedItem._id),
        },
      );

      // Track newly created documents
      createdItems.push(copiedItem);

      // Recursively copy folder contents
      if (type === "folder") {
        const [childFolders, childFiles] = await Promise.all([
          Directory.find({
            parentDirId: source._id,
          }).lean(),

          File.find({
            parentDirId: source._id,
          }).lean(),
        ]);

        const childPath = [...path, copiedItem._id];

        for (const folder of childFolders) {
          await copyLocalItem(
            folder,
            "folder",
            copiedItem._id,
            childPath,
            folder.name,
          );
        }

        for (const file of childFiles) {
          await copyLocalItem(
            file,
            "file",
            copiedItem._id,
            childPath,
            file.name,
          );
        }
      }

      return copiedItem;
    };

    // -----------------------------------------
    // Create copied items
    // -----------------------------------------

    const copiedDocuments = [];

    for (const item of normalizedItems) {
      const Model = item.type === "folder" ? Directory : File;

      const dbItem = await Model.findById(item.itemId).lean();

      if (!dbItem) {
        return res.status(404).json({
          message: `${
            item.type === "folder" ? "Folder" : "File"
          } not found: ${item.itemId}`,
        });
      }

      const copiedItem = await copyLocalItem(
        dbItem,
        item.type,
        dbItem.parentDirId,
        dbItem.path || [],
        `Copy of ${dbItem.name}`,
      );

      copiedDocuments.push({
        copiedItem,
        type: item.type,
      });
    }

    // -----------------------------------------
    // Write OpenFGA relationships BEFORE
    // resolving capabilities
    // -----------------------------------------

    const batchSize = 100;

    for (let i = 0; i < relationships.length; i += batchSize) {
      await fgaClient.write({
        writes: relationships.slice(i, i + batchSize),
      });
    }

    // -----------------------------------------
    // Resolve permissions AFTER relationships
    // -----------------------------------------

    const copiedItems = await Promise.all(
      copiedDocuments.map(async ({ copiedItem, type }) => {
        const { owners, capabilities, permissions } = await resolveRole(
          copiedItem,
          type,
          userId,
          copiedItem.parentDirId,
        );

        return {
          copiedItem,
          owners,
          capabilities,
          permissions,
        };
      }),
    );

    // =========================================
    // SUCCESS RESPONSE
    // =========================================

    return res.status(201).json({
      message: `${copiedItems.length} item(s) copied successfully`,
      data: {
        copiedItems,
      },
    });
  } catch (error) {
    console.error("COPY ITEM ERROR:", error);

    if (error?.code === 403) {
      return res.status(403).json({
        message: error?.cause?.message || "You can't copy this item",
      });
    }

    return res.status(500).json({
      message: error.message || "Something went wrong while copying items",
    });
  }
};

export const moveItems = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    // Support single and multiple items
    const items = req.body?.items ?? (req.body?.item ? [req.body.item] : []);
    const { destinationId, destinationName } = req.body;

    if (!items.length || !destinationId || !destinationName) {
      return res.status(400).json({
        message: "Invalid or missing move details",
      });
    }

    // Find destination folder
    const destinationFolder = await Directory.findById(destinationId).lean();

    if (!destinationFolder) {
      return res.status(404).json({
        message: "Destination folder not found",
      });
    }

    const destinationFolderId = String(destinationFolder._id);
    const destinationPath = destinationFolder.path || [];

    // Resolve all files and folders
    const resolvedItems = [];

    for (const item of items) {
      if (!item?._id) {
        return res.status(400).json({
          message: "Invalid item ID",
        });
      }

      let document;
      let type;

      if (item.isDirectory) {
        document = await Directory.findById(item._id);
        type = "folder";
      } else {
        document = await File.findById(item._id);
        type = "file";
      }

      if (!document) {
        return res.status(404).json({
          message: `Invalid ${type === "folder" ? "Folder" : "File"} ID: ${item._id}`,
        });
      }

      resolvedItems.push({ document, type });
    }

    // Validate all items before moving
    for (const { document, type } of resolvedItems) {
      if (document.parentDirId == null) {
        return res.status(400).json({
          message: `${document.name}: Root items cannot be moved`,
        });
      }

      const alreadyInDestination = resolvedItems.filter(
        ({ document }) => String(document.parentDirId) === destinationFolderId,
      );

      if (alreadyInDestination.length) {
        const message =
          alreadyInDestination.length === 1
            ? `${alreadyInDestination[0].document.name} is already in ${destinationName}`
            : `Selected items are already in ${destinationName}`;

        return res.status(400).json({ message });
      }

      if (type === "folder") {
        const folderId = String(document._id);

        if (folderId === destinationFolderId) {
          return res.status(400).json({
            message: "A folder cannot be moved into itself",
          });
        }

        const isDescendant = destinationPath.some(
          (id) => String(id) === folderId,
        );

        if (isDescendant) {
          return res.status(400).json({
            message: "A folder cannot be moved into one of its own subfolders",
          });
        }
      }
    }

    // Prevent moving a selected parent folder and its children together
    const selectedFolderIds = new Set(
      resolvedItems
        .filter(({ type }) => type === "folder")
        .map(({ document }) => String(document._id)),
    );

    for (const { document } of resolvedItems) {
      const path = (document.path || []).map(String);

      if (path.some((id) => selectedFolderIds.has(id))) {
        return res.status(400).json({
          message:
            "Cannot move a folder and its nested items together. Select only the parent folder.",
        });
      }
    }

    // Check permissions for all items
    const checks = await Promise.all(
      resolvedItems.map(({ document, type }) =>
        fgaClient.check({
          user: getFgaObject("user", userId),
          relation: "can_move",
          object: getFgaObject(type, document._id),
        }),
      ),
    );

    if (checks.some((check) => !check.allowed)) {
      return res.status(403).json({
        message: "Unauthorized!",
      });
    }

    // Prepare updates and OpenFGA relationships
    const writes = [];
    const deletes = [];

    const fileOperations = [];
    const folderOperations = [];
    const activityOperations = [];

    for (const { document, type } of resolvedItems) {
      const itemId = String(document._id);
      const oldParentId = String(document.parentDirId);

      const oldPath = (document.path || []).map(String);

      const newPath = [...destinationPath.map(String), destinationFolderId];

      const object = getFgaObject(type, document._id);

      writes.push({
        user: getFgaObject("folder", destinationFolderId),
        relation: "parent",
        object,
      });

      deletes.push({
        user: getFgaObject("folder", oldParentId),
        relation: "parent",
        object,
      });

      if (type === "file") {
        fileOperations.push({
          updateOne: {
            filter: { _id: document._id },
            update: {
              $set: {
                parentDirId: destinationFolderId,
                path: newPath,
              },
            },
          },
        });

        activityOperations.push(
          FileActivity.findOneAndUpdate(
            {
              file: document._id,
              user: userId,
              type: "move",
            },
            {
              $set: {
                occuredAt: new Date(),
              },
            },
            {
              upsert: true,
            },
          ),
        );

        continue;
      }

      // Update moved folder
      folderOperations.push({
        updateOne: {
          filter: { _id: document._id },
          update: {
            $set: {
              parentDirId: destinationFolderId,
              path: newPath,
            },
          },
        },
      });

      // Find all descendants
      const [descendantFolders, descendantFiles] = await Promise.all([
        Directory.find({ path: document._id }).select("_id path").lean(),

        File.find({ path: document._id }).select("_id path").lean(),
      ]);

      // Update descendant folder paths
      for (const folder of descendantFolders) {
        const childPath = (folder.path || []).map(String);
        const relativePath = childPath.slice(oldPath.length + 1);

        folderOperations.push({
          updateOne: {
            filter: { _id: folder._id },
            update: {
              $set: {
                path: [...newPath, itemId, ...relativePath],
              },
            },
          },
        });
      }

      // Update descendant file paths
      for (const file of descendantFiles) {
        const childPath = (file.path || []).map(String);
        const relativePath = childPath.slice(oldPath.length + 1);

        fileOperations.push({
          updateOne: {
            filter: { _id: file._id },
            update: {
              $set: {
                path: [...newPath, itemId, ...relativePath],
              },
            },
          },
        });
      }
    }

    // OpenFGA relationship updates in batches of 100
    const batchSize = 100;

    for (let i = 0; i < writes.length; i += batchSize) {
      await fgaClient.write({
        writes: writes.slice(i, i + batchSize),
        deletes: deletes.slice(i, i + batchSize),
      });
    }

    // Bulk update MongoDB documents
    await Promise.all([
      fileOperations.length
        ? File.bulkWrite(fileOperations)
        : Promise.resolve(),

      folderOperations.length
        ? Directory.bulkWrite(folderOperations)
        : Promise.resolve(),

      ...activityOperations,
    ]);

    const fileCount = resolvedItems.filter(
      ({ type }) => type === "file",
    ).length;

    const folderCount = resolvedItems.filter(
      ({ type }) => type === "folder",
    ).length;

    return res.status(200).json({
      message: `${resolvedItems.length} item(s) moved to ${destinationName} successfully`,
      movedIds: resolvedItems.map(({ document }) => String(document._id)),
      moved: {
        files: fileCount,
        folders: folderCount,
      },
    });
  } catch (error) {
    console.error("MOVE ITEM ERROR:", error);

    return res.status(500).json({
      message: error.message || "Something went wrong while moving items",
    });
  }
};
