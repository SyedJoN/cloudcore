import { rm } from "fs/promises";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "path";
import { fileURLToPath } from "url";
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
import { deleteFile } from "../services/s3/delete.js";
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
import mongoose from "mongoose";
import { GetObjectCommand } from "@aws-sdk/client-s3";
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

const __filename = fileURLToPath(import.meta.url);

const resolveRole = async (item, type, userId, parentDir, isShared = false) => {
  const objectType = type === "folder" ? "folder" : "file";

  const object = `${objectType}:${item._id}`;

  // Direct permissions

  const directPermissions = await resolveObjectPermissions(object);
  const permissionMap = new Map();

  for (const { user, relation } of directPermissions) {
    mergePermission({
      permissionMap,
      user,
      relation,
      source: "direct",
      isShared,
    });
  }

  // Inherited permissions

  if (parentDir?._id) {
    const ancestors = await getAncestorDirectories(parentDir);

    for (const ancestor of ancestors) {
      const inheritedPermissions = await resolveObjectPermissions(
        `folder:${ancestor._id}`,
      );

      for (const { user, relation } of inheritedPermissions) {
        mergePermission({
          permissionMap,

          user,

          relation: relation,

          source: "parent",

          inheritedFrom: ancestor,
        });
      }
    }
  }

  const permissions = Array.from(permissionMap.values());

  // Owners

  const owners = permissions
    .filter((permission) => permission.role === "owner")
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

  const isPublic = Boolean(item?.isPublic);

  const publicRole = isPublic ? item?.publicRole || "reader" : null;

  const directRole =
    currentUserPermission?.permissionDetails?.[0].directRole || null;

  const inheritedRole =
    currentUserPermission?.permissionDetails?.[0].inheritedRole || null;

  const directPriority = directRole ? ROLE_PRIORITY[directRole] : 0;

  const inheritedPriority = inheritedRole ? ROLE_PRIORITY[inheritedRole] : 0;

  const publicPriority = publicRole ? ROLE_PRIORITY[publicRole] : 0;

  const highestPriority = Math.max(
    directPriority,
    inheritedPriority,
    publicPriority,
  );

  let currentRole = null;

  if (highestPriority > 0) {
    if (publicPriority === highestPriority) {
      currentRole = publicRole;
    } else if (directPriority >= inheritedPriority) {
      currentRole = directRole;
    } else {
      currentRole = inheritedRole;
    }
  }

  const isPublicEffective = Boolean(
    currentRole && publicRole && publicPriority === highestPriority,
  );

  // Root checks

  const parentId = getIdString(parentDir?.parentDirId);

  const isRootDirectory = Boolean(parentDir?._id) && !parentId;

  const isRootLevelFile = type === "file" && isRootDirectory;

  // Current user capabilities

  const isOwner = currentRole === "owner";

  const isWriter = currentRole === "writer" || currentRole === "owner";

  let canChangeRole = isOwner || isWriter;

  // Add capabilities to each user
  let capabilities;
  const permissionsWithCapabilities = permissions.map((permission) => {
    console.log("permission", permission);
    const permissionId = permission.id;
    if (permissionId.toString() === userId) {
      capabilities = getCapabilities(permission.role, type, isRootLevelFile);
    }
    return {
      ...permission,
    };
  });

  // Public / anyone permission

  if (isPublic) {
    const publicCapabilities = getCapabilities(
      publicRole,
      type,
      isRootLevelFile,
    );

    publicCapabilities.canChangeRole = false;

    permissionsWithCapabilities.push({
      id: "anyoneWithLink",

      type: "anyone",

      role: publicRole,

      capabilities: publicCapabilities,

      inherited: false,

      inheritedFrom: null,
    });
  }

  // Ownership transfer

  const ownership = await Ownership.findOne({
    itemId: item?._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  const ownerId = ownership?.toUser ? getIdString(ownership.toUser) : null;

  const updatedPermissions = permissionsWithCapabilities.map((permission) => {
    const permissionId = getIdString(permission.id);

    if (ownership?.status === "pending" && permissionId === ownerId) {
      return {
        ...permission,
        pendingOwner: true,
      };
    }

    return permission;
  });

  // Final response

  return {
    capabilities: capabilities,
    permissions: updatedPermissions,

    owners,

    isRootLevelFile,

    isRootDirectory,
  };
};

async function listObjects(userId, type) {
  const canRead = await fgaClient.listObjects({
    user: `user:${userId.toString()}`,
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
        File.find({ parentDirId: parentDir._id, isDeleted: false })
          .populate("userId", "name email avatar")
          .populate("path", "name")
          .lean(),
        Directory.find({ parentDirId: parentDir._id, isDeleted: false })
          .populate("userId", "name email avatar")
          .populate("path", "name")
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
                relation,
                object: `folder:${parentDir._id}`,
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

      const [filesWithRoles, directoriesWithRoles] = await Promise.all([
        Promise.all(
          files.map(async (f) => {
            const { owners, capabilities, permissions } = await resolveRole(
              f,
              "file",
              userId,
              parentDir,
            );
            return {
              ...f,
              owners,
              capabilities,
              permissions,
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
            return {
              ...d,
              owners,
              capabilities,
              permissions,
            };
          }),
        ),
      ]);
      const permissions = await resolveRole(
        parentDir,
        "folder",
        userId,
        parentDir,
      );
      const parentDirWithRole = {
        ...parentDirData,
        ...permissions,
      };
      return res.status(200).json({
        ...parentDirWithRole,
        files: filesWithRoles,
        directories: directoriesWithRoles,
        totalUsage: rootDir.size,
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
      user: `user:${userId}`,
      relation: "can_read",
      object: `folder:${parentDir._id}`,
    });

    if (!canRead.allowed)
      return res.status(403).json({
        message: "Access denied",
        requiresAuth: false,
        name: parentDir.name,
      });

    const [allowedFileIds, allowedFolderIds] = await Promise.all([
      listObjects(userId, "file"),
      listObjects(userId, "folder"),
    ]);

    const [files, directories] = await Promise.all([
      File.find({
        _id: { $in: allowedFileIds },
        parentDirId: parentDir._id,
        isDeleted: false,
      })
        .populate("userId", "name email avatar")
        .populate("path", "name")
        .lean(),
      Directory.find({
        _id: { $in: allowedFolderIds },
        parentDirId: parentDir._id,
        isDeleted: false,
      })
        .populate("userId", "name email avatar")
        .populate("path", "name")
        .lean(),
    ]);

    const filesWithRoles = await Promise.all(
      files.map(async (file) => {
        const { owners, capabilities, permissions } = await resolveRole(
          file,
          "file",
          userId,
          parentDir,
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
          parentDir,
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
      files: filesWithRoles,
      directories: directoriesWithRoles,
      totalUsage: rootDir.size,
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

    // =========================================================
    // GET EVERYTHING THE USER CAN ACCESS
    // =========================================================

    const [allowedFileIds, allowedFolderIds] = await Promise.all([
      listObjects(userId, "file"),
      listObjects(userId, "folder"),
    ]);

    // Normalize IDs once.
    const allowedFolderIdSet = new Set(
      allowedFolderIds.map((id) => String(id)),
    );

    // =========================================================
    // FETCH FILES + DIRECTORIES
    // =========================================================

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
        const { owners, capabilities, permissions } = await resolveRole(
          file,
          "file",
          userId,
          file.parentDirId,
          true,
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

        const { owners, capabilities, permissions } = await resolveRole(
          directory,
          "folder",
          userId,
          parentDir,
          true,
        );

        return {
          ...directory,
          owners,
          capabilities,
          permissions,
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
      listObjects(userId, "file"),
      listObjects(userId, "folder"),
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
        );
        return {
          ...file,
          owners,
          capabilities,
          permissions,
        };
      }),
    );

    const sharedDirectoriesWithRoles = await Promise.all(
      topLevelSharedDirs.map(async (dir) => {
        const { owners, capabilities, permissions } = await resolveRole(
          dir,
          "folder",
          userId,
        );
        return {
          ...dir,
          owners,
          capabilities,
          permissions,
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
  const dirname = sanitizeText(req.headers.dirname) || "New folder";

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
        user: `user:${userId}`,
        relation: "can_write",
        object: `folder:${parentDirId}`,
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
          user: `user:${userId}`,
          relation: "owner",
          object: `folder:${addedDirectory._id}`,
        },
        {
          user: `folder:${parentDirId}`,
          relation: "parent",
          object: `folder:${addedDirectory._id}`,
        },
      ],
    });

    return res.status(201).json({ message: "Directory Created!" });
  } catch (error) {
    next(error);
  }
};
export const editDirectory = async (req, res, next) => {
  const { id } = req.params;
  const { newDirName } = req.body;
  if (!newDirName) {
    return res.status(404).json({ message: "Dirname is required" });
  }
  const isEditor = await fgaClient.check({
    user: `user:${req.user._id.toString()}`,
    relation: "can_write",
    object: `folder:${id}`,
  });
  if (!isEditor.allowed) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  try {
    await Directory.updateOne({ _id: id }, { name: sanitizeText(newDirName) });

    return res.status(200).json({ message: "Renamed" });
  } catch (error) {
    next(error);
  }
};

export const softDeleteDirectory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    const currentDirectory = await Directory.findOne({
      _id: id,
      isDeleted: false,
    })
      .select("parentDirId userId size")
      .lean();

    if (!currentDirectory)
      return res.status(404).json({ message: "Directory not found" });
    const isOwner = currentDirectory.userId.toString() === userId.toString();

    const queue = [currentDirectory._id];
    const allDirIds = [id];
    const allFileIds = [];

    while (queue.length) {
      const currentId = queue.shift();
      const [childDirs, childFiles] = await Promise.all([
        Directory.find({ parentDirId: currentId, isDeleted: false })
          .select("_id")
          .lean(),
        File.find({ parentDirId: currentId, isDeleted: false })
          .select("_id")
          .lean(),
      ]);
      childDirs.forEach((d) => {
        allDirIds.push(d._id);
        queue.push(d._id);
      });
      childFiles.forEach((f) => allFileIds.push(f._id));
    }

    await Promise.all([
      allFileIds.length
        ? File.updateMany({ _id: { $in: allFileIds } }, { isDeleted: true })
        : Promise.resolve(),
      Directory.updateMany({ _id: { $in: allDirIds } }, { isDeleted: true }),
    ]);
    await updateParentDirSize(
      currentDirectory.parentDirId,
      -currentDirectory.size,
    );

    return res.status(200).json({
      message: "Directory moved to trash",
      deleted: { directories: allDirIds.length, files: allFileIds.length },
    });
  } catch (error) {
    console.dir(error.errInfo, { depth: null });
  }
};
export const deleteDirectory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const currentDirectory = await Directory.findOne({ _id: id, userId })
      .select("parentDirId")
      .lean();

    if (!currentDirectory) {
      return res.status(404).json({ message: "Directory not found" });
    }

    const queue = [{ _id: id, parentDirId: currentDirectory.parentDirId }];
    const directories = [];
    const files = [];

    // BFS traversal
    while (queue.length) {
      const { _id: dirId } = queue.shift();

      const [childDirs, childFiles] = await Promise.all([
        Directory.find({ parentDirId: dirId, userId })
          .select("_id parentDirId")
          .lean(),
        File.find({ parentDirId: dirId, userId })
          .select("_id extension parentDirId")
          .lean(),
      ]);

      directories.push(...childDirs);
      files.push(...childFiles);

      queue.push(...childDirs);
    }

    // Delete files from S3 Bucket
    await deleteFileArray(files);

    const fileIds = files.map((f) => f._id);
    const allDirIds = [
      { _id: id, parentDirId: currentDirectory.parentDirId },
      ...directories,
    ];

    // Delete file metadata
    await Promise.all([
      fileIds.length
        ? File.deleteMany({ _id: { $in: fileIds } })
        : Promise.resolve(),
      Directory.deleteMany({ _id: { $in: allDirIds.map((d) => d._id) } }),
    ]);

    const deletes = [
      ...files.flatMap((f) => [
        { user: `user:${userId}`, relation: "owner", object: `file:${f._id}` },
        { user: `user:${userId}`, relation: "editor", object: `file:${f._id}` },
        { user: `user:${userId}`, relation: "viewer", object: `file:${f._id}` },
        {
          user: `folder:${f.parentDirId}`,
          relation: "parent",
          object: `file:${f._id}`,
        },
      ]),

      ...allDirIds.flatMap((dir) => [
        {
          user: `user:${userId}`,
          relation: "owner",
          object: `folder:${dir._id}`,
        },
        {
          user: `folder:${dir.parentDirId}`,
          relation: "parent",
          object: `folder:${dir._id}`,
        },
      ]),
    ];

    // batch deletes — FGA recommends max 100 per write
    const batchSize = 100;
    for (let i = 0; i < deletes.length; i += batchSize) {
      await fgaClient.write(
        { deletes: deletes.slice(i, i + batchSize) },
        {
          conflict: {
            onMissingDeletes: ClientWriteRequestOnMissingDeletes.Ignore,
          },
        },
      );
    }

    return res.status(200).json({
      message: "Directory deleted successfully",
      deleted: {
        directories: allDirIds.length,
        files: fileIds.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const restoreDirectory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const totalStorage = req.user.totalStorage;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const currentDirectory = await Directory.findOne({
      _id: id,
      isDeleted: true,
    });
    if (!currentDirectory)
      return res.status(404).json({ message: "Directory not found" });
    const rootDir = await Directory.findOne({
      userId,
    }).lean();

    const totalStorageLeft = totalStorage - rootDir.size;
    const needed = currentDirectory.size - totalStorageLeft;
    if (currentDirectory.size > totalStorageLeft) {
      return res.status(413).json({
        message: `Storage is full. You need ${formatSize(needed)} more storage`,
      });
    }
    const queue = [currentDirectory._id];
    const allDirIds = [id];
    const allFileIds = [];

    while (queue.length) {
      const currentId = queue.shift();

      const [childDirs, childFiles] = await Promise.all([
        Directory.find({ parentDirId: currentId }).select("_id").lean(),
        File.find({ parentDirId: currentId }).select("_id").lean(),
      ]);

      childDirs.forEach((d) => {
        allDirIds.push(d._id);
        queue.push(d._id);
      });

      childFiles.forEach((f) => allFileIds.push(f._id));
    }

    await Promise.all([
      Directory.updateMany({ _id: { $in: allDirIds } }, { isDeleted: false }),
      allFileIds.length
        ? File.updateMany({ _id: { $in: allFileIds } }, { isDeleted: false })
        : Promise.resolve(),
    ]);
    await updateParentDirSize(
      currentDirectory.parentDirId,
      currentDirectory.size,
    );
    return res.status(200).json({ message: "Directory restored successfully" });
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
    const { id, toEmail, message, name, type, url, isPublic, publicRole } =
      req.body;
    const userId = req.user._id;
    const isGoogleDriveLink = type.startsWith("google-drive");
    const sender = await User.findById(userId).select("name email").lean();
    const cleanMessage = sanitizeText(message || "");

    console.log("toEmail", cleanMessage);
    if (isGoogleDriveLink) {
      await sendLinkEmail({
        toEmail,
        fromName: sender.name,
        fromEmail: sender.email,
        itemName: name,
        itemType: type,
        itemUrl: url,
        isPublic: isPublic,
        publicRole: publicRole,
        message: cleanMessage,
      });
      return res.status(200).json({ message: "Link sent" });
    }
    const item =
      type === "folder"
        ? await Directory.findById(id).lean()
        : await File.findById(id).lean();

    await sendLinkEmail({
      toEmail,
      fromName: sender.name,
      fromEmail: sender.email,
      itemName: item.name,
      itemType: type,
      itemUrl: `${process.env.CLIENT_URL}/${type === "folder" ? "currentDirectory" : "file"}/${id}`,
      isPublic: item.isPublic,
      publicRole: item.publicRole,
      message: cleanMessage,
    });

    return res.status(200).json({ message: "Link sent" });
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

    if (!currentOwnerId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!newOwner || !itemId || !type) {
      return res.status(400).json({
        message: "newOwner, itemId, and type are required",
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
    const { newOwner, itemId } = req.body;
    const currentOwnerId = req.user?._id;
    const newOwnerId = newOwner?._id || newOwner?.id;
    const currentOwnerName = req.user?.name;

    if (!currentOwnerId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }
    if (!newOwner || !itemId) {
      return res.status(400).json({
        message: "newOwner and itemId are required",
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
    const type = ownership.itemType === "Directory" ? "folder" : "file";
    console.log({
      itemId: ownership.itemId,
      type,
      newOwnerId,
      parentDirId: ownership.itemId.parentDirId,
    });
    const finalResponse = await resolveRole(
      ownership.itemId,
      type,
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
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Missing folder id",
      });
    }

    const folder = await Directory.findOne({
      _id: id,
      userId,
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
      userId,
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
      userId,
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
          user: `user:${userId.toString()}`,

          relation: "owner",

          object: `folder:${directory._id.toString()}`,
        },
      ];

      if (directory.parentDirId) {
        fgaWrites.push({
          user: `folder:${directory.parentDirId.toString()}`,

          relation: "parent",

          object: `folder:${directory._id.toString()}`,
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
            user: `user:${userId.toString()}`,

            relation: "owner",

            object: `file:${uploadedFile._id.toString()}`,
          },

          {
            user: `folder:${uploadedFile.parentDirId.toString()}`,

            relation: "parent",

            object: `file:${uploadedFile._id.toString()}`,
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

export const copyItem = async (req, res, next) => {
  try {
    const { id, type } = req.body;
    const userId = req.user?._id;

    const allowedTypes = ["file", "folder"];

    if (!id || !type) {
      return res.status(400).json({
        message: "Item id and type are required",
      });
    }

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        message: "Invalid item type",
      });
    }

    const Model = type === "folder" ? Directory : File;

    const item = await Model.findById(id).lean();

    if (!item) {
      return res.status(404).json({
        message: "Item not found",
      });
    }

    const copiedItem = new Model({
      name: "Copy of " + item.name,
      size: item.size,
      parentDirId: item.parentDirId,
      path: item.path,
      userId: item.userId,
      isPublic: item.isPublic,
      publicRole: item.publicRole,
    });

    if (type === "file") {
      copiedItem.extension = item.extension;
      copiedItem.isUploading = true;

      const newS3Key = `${copiedItem._id.toString()}${copiedItem.extension}`;
      const oldS3Key = `${item._id.toString()}${item.extension}`;

      await copyS3File(oldS3Key, newS3Key);
      copiedItem.isUploading = false;
    }


    await copiedItem.save();

    await fgaClient.write({
      writes: [
        {
          user: `user:${userId.toString()}`,
          relation: "owner",
          object: `${type}:${copiedItem._id.toString()}`,
        },
        {
          user: `folder:${copiedItem.parentDirId.toString()}`,
          relation: "parent",
          object: `${type}:${copiedItem._id.toString()}`,
        },
      ],
    });

    return res.status(201).json({
      message: `${type} copied successfully!`,
      itemId: copiedItem._id,
    });
  } catch (error) {
    next(error);
  }
};
