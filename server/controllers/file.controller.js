import { createWriteStream } from "fs";
import { rename, rm } from "fs/promises";
import path from "path";
import { Readable } from "node:stream";
import { fileURLToPath } from "url";
import Directory from "../models/directory.model.js";
import File from "../models/file.model.js";
import { fgaClient } from "../services/openFGAService.js";
import User from "../models/user.model.js";
import { ClientWriteRequestOnMissingDeletes } from "@openfga/sdk";
import { sendAccessEmail } from "../services/sendMailService.js";
import { sanitizeFilename } from "../utils/sanitizeFileName.js";
import fs from "fs";
import { pipeline } from "stream/promises";
import { updateParentDirSize } from "../utils/updateDirSize.js";
import { formatSize } from "../utils/formatSize.js";
import { getDirectoryPath } from "../utils/updatePath.js";
import { getSignedUploadUrl } from "../services/s3/upload.js";
import { getFileSize } from "../services/s3/getFileSize.js";
import { deleteFile as deleteFileFromS3 } from "../services/s3/delete.js";
import Subscription from "../models/subscription.model.js";
import { pauseUploads } from "../services/subscription/pauseUploads.js";
import { updateUserPlan } from "../utils/updateUserPlan.js";
import { getDriveClient } from "../services/googleDriveClient.js";
import Ownership from "../models/ownership.model.js";
import mongoose from "mongoose";
import { resolveObjectPermissions } from "../utils/permissions/resolveObjectPermissions.js";
import { mergePermission } from "../utils/permissions/mergePermission.js";
import { getAncestorDirectories } from "../utils/permissions/getAncestorDirectories.js";
import { getIdString } from "../utils/permissions/getIdString.js";
import { ROLE_PRIORITY } from "../utils/permissions/getRolePriority.js";
import { getCapabilities } from "../utils/permissions/getCapabilities.js";
import SharedAccess from "../models/sharedAccess.model.js";
import FileActivity from "../models/fileActivity.model.js";
import { getFgaObject } from "../utils/getFgaObject.js";
import { getCreateCloudfrontSignedUrl } from "../services/s3/cloudfront.js";
import { sanitizeText } from "../utils/sanitizeText.js";

async function getSharedWithMeTime({ itemId, itemType, userId }) {
  if (!itemId || !userId) return null;

  const record = await SharedAccess.findOne({ itemId, itemType, userId })
    .select("sharedWithMeTime")
    .lean();

  return record?.sharedWithMeTime || null;
}

async function listSharedObjects(type, userId) {
  const [sharedResult, readerResult] = await Promise.all([
    fgaClient.listObjects({
      user: `user:${userId}`,
      relation: "shared_reader",
      type,
    }),
    fgaClient.listObjects({
      user: `user:${userId}`,
      relation: "can_read",
      type,
    }),
  ]);

  const combined = [...sharedResult.objects, ...readerResult.objects];

  return [...new Set(combined)].map((o) => o.split(":").pop()).filter(Boolean);
}

const resolveRole = async (
  item,
  type,
  userId,
  parentDir,
  isSuperuser = false,
  isShared = false,
) => {
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
    isSuperuser,
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

export const uploadDriveFileToS3 = async (req, res, next) => {
  const { driveFileId } = req.body;
  const { drive_access_token } = req.signedCookies;

  if (!drive_access_token) {
    return res.status(401).json({
      message: "Missing token",
    });
  }

  const drive = getDriveClient(drive_access_token);
  const fileResponse = await drive.files.get(
    {
      fileId: driveFileId,
      alt: "media",
    },
    {
      responseType: "arraybuffer",
    },
  );

  const buffer = Buffer.from(fileResponse.data);
  return res.status(201).json({
    message: "File uploaded successfully",
    buffer,
  });
};
export const generateSignedUploadUrl = async (req, res, next) => {
  const { name, size, contentType } = req.body;

  const parentDirId = req.body.parentDirId || req.user.parentDirId;
  const userId = req.user._id;
  const totalStorage = req.user.totalStorage;
  const uploadLimit = req.user.uploadLimit;

  let fileName = sanitizeFilename(name) || "untitled";
  const fileExt = path.extname(fileName);
  const fileType = contentType || "application/octet-stream";
  const fileSize = Number(size || 0);
  const derivedExtension = "." + contentType.split("/")[1];
  let responded;
  let uploadedFile;

  const safeResponse = async (status, payload) => {
    if (responded) return;
    responded = true;
    return res.status(status).json(payload);
  };
  if (!derivedExtension) {
    return safeResponse(400, {
      message: "Unsupported or missing content type!",
    });
  }
  if (!fileExt.trim()) {
    fileName += derivedExtension;
  }
  if (!fileSize || fileSize > uploadLimit) {
    return res.status(413).json({
      message: "File too large",
    });
  }

  try {
    const parentDir = await Directory.findOne({
      _id: parentDirId,
      userId,
    });

    if (!parentDir) {
      return safeResponse(404, {
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

    const rootDir = await Directory.findOne({
      userId,
    }).lean();

    const totalStorageLeft = totalStorage - rootDir.size;
    const needed = fileSize - totalStorageLeft;
    if (fileSize > totalStorageLeft) {
      return safeResponse(507, {
        message: `Stroage is full. You need ${formatSize(needed)} more storage`,
      });
    }

    const fullPath = await getDirectoryPath(parentDir._id);

    const user = await User.findById(userId);
    const currentPlan = user.plan;

    uploadedFile = await File.insertOne({
      name: fileName,
      extension: fileExt || derivedExtension,
      size: fileSize,
      isUploading: true,
      parentDirId: parentDir._id,
      path: fullPath,
      currentPlan,
      userId,
    });
    const s3Key = `${uploadedFile._id}${uploadedFile.extension}`;
    const url = await getSignedUploadUrl(s3Key, fileType);

    return res.status(200).json({
      fileId: uploadedFile._id,
      uploadUrl: url,
    });
  } catch (error) {
    if (uploadedFile) {
      await File.deleteOne({ _id: uploadedFile._id }).catch(() => {});
    }
    return next(error);
  }
};

export const completeUpload = async (req, res, next) => {
  const { fileId } = req.body;
  const userId = req.user._id;

  let uploadedFile;

  try {
    uploadedFile = await File.findOne({
      _id: fileId,
      userId,
    });

    if (!uploadedFile) {
      return res.status(404).json({ message: "File not found in the backend" });
    }
    const s3Key = `${uploadedFile._id}${uploadedFile.extension}`;
    try {
      const contentLength = await getFileSize(s3Key);
      if (uploadedFile.size !== contentLength) {
        await deleteFileFromS3(s3Key);
        await uploadedFile.deleteOne();
        return res.status(400).json({ message: "File size dosen't match" });
      }
    } catch (error) {
      await deleteFileFromS3(s3Key);
      await uploadedFile.deleteOne();
      return res.status(404).json({ message: "Upload corrupted" });
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
    } catch (err) {
      if (uploadedFile) {
        await File.deleteOne({ _id: uploadedFile._id }).catch(() => {});
      }

      return next(err);
    }
    uploadedFile.isUploading = false;
    await uploadedFile.save();
    await updateParentDirSize(uploadedFile.parentDirId, uploadedFile.size);

    return res.status(201).json({
      message: "File uploaded successfully",
      fileId: uploadedFile._id,
    });
  } catch (error) {
    if (uploadedFile) {
      await File.deleteOne({ _id: uploadedFile._id }).catch(() => {});
    }
    return next(error);
  }
};

export const getFileById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const file = await File.findById(id);
    if (!file) return res.status(404).json({ message: "File not found" });

    if (!file.isPublic && req.user?.role !== "superuser") {
      const parentDir = await Directory.findById(file.parentDirId).lean();

      if (!parentDir?.isPublic) {
        if (!userId) {
          return res.status(403).json({ message: "Access denied" });
        }

        const canRead = await fgaClient.check({
          user: getFgaObject("user", userId),
          relation: "can_read",
          object: getFgaObject("file", id),
        });

        if (!canRead.allowed) {
          return res
            .status(403)
            .json({ message: "You don't have access to this file" });
        }
      }
    }

    const s3Key = `${file._id}${file.extension}`;
    if (req.query.action === "download") {
      const url = getCreateCloudfrontSignedUrl({
        path: s3Key,
        download: true,
        fileName: file.name,
      });
      return res.redirect(url);
    }
    const url = getCreateCloudfrontSignedUrl({
      path: s3Key,
      fileName: file.name,
    });

    const s3Response = await fetch(url);
    if (!s3Response.ok) {
      return res.status(s3Response.status).send("Failed to fetch file");
    }
    const contentType = s3Response.headers.get("content-type");
    if (!contentType?.startsWith("text/")) {
      return res.redirect(url);
    }

    res.setHeader("Content-Type", contentType || "text/plain");
    await file.save();

    return Readable.fromWeb(s3Response.body).pipe(res);
  } catch (error) {
    next(error);
  }
};

export const getFileMetaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    const file = await File.findById(id)
      .populate("userId", "name email avatar")
      .lean();

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    const parentDir = await Directory.findById(file.parentDirId)
      .populate("userId", "name email avatar")
      .lean();

    const isOwner = file.userId?._id?.toString?.() === userId?.toString?.();
    const {
      owners,
      capabilities,
      permissions,
      viewedByMeTime,
      modifiedByMeTime,
    } = await resolveRole(file, "file", userId, parentDir, true);

    if (req.user?.role === "superuser" || isOwner) {
      return res.status(200).json({
        ...file,
        owners,
        capabilities,
        permissions,
        viewedByMeTime,
        modifiedByMeTime,
      });
    }

    const isPublicallyAccessible = parentDir?.isPublic || file?.isPublic;

    if (!isPublicallyAccessible) {
      if (!userId) {
        return res.status(403).json({
          message: "Access denied",
          requiresAuth: true,
        });
      }

      const canRead = await fgaClient.check({
        user: getFgaObject("user", userId),
        relation: "can_read",
        object: getFgaObject("file", id),
      });

      if (!canRead.allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      await FileActivity.findOneAndUpdate(
        {
          file: file._id,
          user: userId,
          type: "view",
        },
        {
          $set: { occuredAt: new Date() },
        },
        {
          upsert: true,
        },
      );
      return res.status(200).json({
        ...file,
        owners,
        capabilities,
        permissions,
        viewedByMeTime,
        modifiedByMeTime,
      });
    }

    if (userId) {
      const [canRead, canWrite] = await Promise.all([
        fgaClient.check({
          user: getFgaObject("user", userId),
          relation: "can_read",
          object: getFgaObject("file", id),
        }),
        fgaClient.check({
          user: getFgaObject("user", userId),
          relation: "can_write",
          object: getFgaObject("file", id),
        }),
      ]);

      if (canRead.allowed || canWrite.allowed) {
        const relation = file.publicRole || "reader";

        try {
          await fgaClient.write(
            {
              writes: [
                {
                  user: `user:${userId}`,
                  relation:
                    relation === "reader" ? "shared_reader" : "shared_writer",
                  object: getFgaObject("file", file._id),
                },
              ],
            },
            {
              transaction: {
                disabled: true,
              },
            },
          );
        } catch (error) {}
        await FileActivity.findOneAndUpdate(
          {
            file: file._id,
            user: userId,
            type: "view",
          },
          {
            $set: { occuredAt: new Date() },
          },
          {
            upsert: true,
          },
        );
        return res.status(200).json({
          ...file,
          owners,
          capabilities,
          permissions,
          viewedByMeTime,
          modifiedByMeTime,
        });
      }
    }
    return res.status(403).json({ message: "Access denied" });
  } catch (error) {
    next(error);
  }
};

export const getRecentFiles = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(403).json({ message: "Access denied" });

    const sharedFileIds = await listSharedObjects("file", userId);

    const [ownFiles, sharedFiles] = await Promise.all([
      File.find({ userId, isDeleted: false, isUploading: false })
        .populate("userId", "name email avatar")
        .populate("path", "name")
        .lean(),
      sharedFileIds.length
        ? File.find({
            _id: { $in: sharedFileIds },
            userId: { $ne: userId },
            isDeleted: false,
          })
            .populate("parentDirId")
            .populate("userId", "name email avatar")
            .populate("path", "name")
            .lean()
        : [],
    ]);

    const sharedFilesWithRoles = await Promise.all(
      sharedFiles.map(async (file) => {
        const {
          owners,
          capabilities,
          permissions,
          viewedByMeTime,
          modifiedByMeTime,
        } = await resolveRole(file, "file", userId, file.parentDirId, true);
        return {
          ...file,
          owners,
          capabilities,
          permissions,
          viewedByMeTime,
          modifiedByMeTime,
          isShared: true,
        };
      }),
    );

    const ownFilesWithRoles = await Promise.all(
      ownFiles.map(async (file) => {
        const {
          owners,
          capabilities,
          permissions,
          viewedByMeTime,
          modifiedByMeTime,
        } = await resolveRole(file, "file", userId);
        return {
          ...file,
          owners,
          capabilities,
          permissions,
          viewedByMeTime,
          modifiedByMeTime,
        };
      }),
    );

    const allFiles = [...ownFilesWithRoles, ...sharedFilesWithRoles];

    const getActivityTime = async (file) => {
      const [viewActivity, modifiedActivity] = await Promise.all([
        FileActivity.findOne({
          file: file._id,
          user: userId,
          type: "view",
        })
          .sort({ occuredAt: -1 })
          .lean(),

        FileActivity.findOne({
          file: file._id,
          user: userId,
          type: { $in: ["rename", "move"] },
        })
          .sort({ occuredAt: -1 })
          .lean(),
      ]);

      const viewedByMeTime = viewActivity?.occuredAt?.getTime() || null;
      const modifiedByMeTime = modifiedActivity?.occuredAt?.getTime() || null;

      return Math.max(viewedByMeTime, modifiedByMeTime);
    };
    const filesWithActivity = await Promise.all(
      allFiles.map(async (file) => ({
        file,
        activityTime: await getActivityTime(file),
      })),
    );
    filesWithActivity.sort((a, b) => b.activityTime - a.activityTime);

    const RECENT_LIMIT = 100;
    const recentFiles = filesWithActivity
      .slice(0, RECENT_LIMIT)
      .map((f) => f.file);

    return res.status(200).json({ files: recentFiles });
  } catch (error) {
    next(error);
  }
};
export const updateFile = async (req, res, next) => {
  const { id: fileId } = req.params;
  let { fileName } = req.body;
  const { type } = req.query;
  if (!fileName || typeof fileName !== "string") {
    return res.status(400).json({ message: "Filename is required" });
  }
  const userId = req.user._id;

  if (type === "google") {
    try {
      const { drive_access_token } = req.signedCookies;
      if (!drive_access_token) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }
      const drive = getDriveClient(drive_access_token);

      const file = await drive.files.get({
        fileId,
        fields: "name",
      });

      const oldName = file.data.name;
      const extension = oldName.includes(".")
        ? oldName.slice(oldName.lastIndexOf("."))
        : "";

      if (
        extension &&
        !fileName.toLowerCase().endsWith(extension.toLowerCase())
      ) {
        fileName += extension;
      }

      await drive.files.update({
        fileId,
        requestBody: {
          name: fileName,
        },
      });

      return res.status(200).json({
        message: "File renamed successfully",
      });
    } catch (error) {
      console.error("File rename error:", error);
      next(error);
    }
  } else {
    try {
      const file = await File.findById(fileId);
      if (!file) return res.status(404).json({ message: "File not found" });
      const ext = file.extension || path.extname(file.name);

      const base = path.basename(fileName, path.extname(fileName));

      const safeBase = sanitizeFilename(base);

      const finalName = safeBase + ext;
      const isOwner = file.userId?.toString() === userId?.toString();

      const canRename = await fgaClient.check({
        user: getFgaObject("user", userId),
        relation: "can_rename",
        object: getFgaObject("file", fileId),
      });

      if (req.user.role !== "superuser" && !canRename.allowed) {
        return res
          .status(403)
          .json({ message: "You don't have permission to rename this file" });
      }

      if (req.user?.role === "superuser" || isOwner) {
        return await performRename(file, finalName, res, userId);
      }

      return await performRename(file, finalName, res, userId);
    } catch (error) {
      next(error);
    }
  }
};

const performRename = async (file, fileName, res, userId) => {
  const ext = file.extension;

  file.name = fileName;
  file.extension = ext;
  file.modifiedTime = new Date();
  file.lastModifyingUser = userId;
  await FileActivity.findOneAndUpdate(
    {
      file: file._id,
      user: userId,
      type: "rename",
    },
    {
      $set: { occuredAt: new Date() },
    },
    {
      upsert: true,
    },
  );

  await file.save();

  return res.status(200).json({ message: "File renamed successfully" });
};

export const softDeleteFile = async (req, res, next) => {
  try {
    const user = req.user;
    const ids = req.body?.ids ?? [req.params.id]; // single OR multiple

    const files = await File.find({ _id: { $in: ids } });
    if (!files.length) return res.status(404).json({ message: "File not found!" });

    // permission check per file
    const checks = await Promise.all(
      files.map((f) =>
        fgaClient.check({
          user: getFgaObject("user", user._id),
          relation: "can_trash",
          object: getFgaObject("file", f._id),
        }),
      ),
    );
    const allowed = files.filter(
      (_, i) => user.role === "superuser" || checks[i].allowed,
    );
    if (!allowed.length) return res.status(403).json({ message: "Unauthorized!" });

    const owned = allowed.filter((f) => f.userId.toString() === user._id.toString());
    const shared = allowed.filter((f) => !owned.includes(f));

    // owned files: one updateMany
    if (owned.length) {
      await File.updateMany(
        { _id: { $in: owned.map((f) => f._id) } },
        { isDeleted: true, trashedTime: Date.now() },
      );

      // one size update per parent folder
      const sizeByParent = {};
      owned.forEach((f) => {
        const key = String(f.parentDirId);
        sizeByParent[key] = (sizeByParent[key] ?? 0) + f.size;
      });
      await Promise.all(
        Object.entries(sizeByParent).map(([dirId, size]) =>
          updateParentDirSize(dirId, -size),
        ),
      );
    }

    // shared files: just remove this user's access
    await Promise.allSettled(
      shared.flatMap((f) =>
        ["reader", "writer"].map((relation) =>
          fgaClient.write({
            deletes: [
              {
                user: getFgaObject("user", user._id),
                relation,
                object: getFgaObject("file", f._id),
              },
            ],
          }),
        ),
      ),
    );

    return res.status(200).json({
      message: "Moved to trash",
      trashedIds: allowed.map((f) => String(f._id)),
    });
  } catch (error) {
    next(error);
  }
};
export const deleteFile = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = user._id;
    const ids = req.body?.ids ?? [req.params.id];
    const { type } = req.query;

    if (!ids.length) {
      return res.status(400).json({
        message: "fileIds are required",
      });
    }

    // Google Drive deletion
    if (type === "google") {
      const { drive_access_token } = req.signedCookies;

      if (!drive_access_token) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      const drive = getDriveClient(drive_access_token);

      await Promise.all(
        ids.map((id) =>
          drive.files.delete({
            fileId: id,
          }),
        ),
      );

      return res.status(200).json({
        message: "Files deleted successfully",
        deletedIds: ids.map(String),
      });
    }

    // Fetch files
    const files = await File.find({
      _id: { $in: ids },
    })
      .select("_id parentDirId name extension size")
      .lean();

    if (!files.length) {
      return res.status(404).json({
        message: "File not found!",
      });
    }

    // Check permissions
    const checks = await Promise.all(
      files.map((file) =>
        fgaClient.check({
          user: getFgaObject("user", userId),
          relation: "can_delete",
          object: getFgaObject("file", file._id),
        }),
      ),
    );

    const allowed = files.filter(
      (_, i) => user.role === "superuser" || checks[i].allowed,
    );

    if (!allowed.length) {
      return res.status(403).json({
        message: "Unauthorized!",
      });
    }

    const fileIds = allowed.map((file) => file._id);

    // Delete files from S3
    const s3Keys = allowed.map(
      (file) => `${file._id}${file.extension}`,
    );

    await Promise.all(s3Keys.map((key) => deleteFileFromS3(key)));

    // Delete MongoDB metadata
    await File.deleteMany({
      _id: { $in: fileIds },
    });

    // Prepare OpenFGA relationship deletions
    const deletes = allowed.flatMap((file) => {
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
    });

    // OpenFGA maximum batch size: 100
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

    // Update parent directory sizes
    const sizeByParent = {};

    allowed.forEach((file) => {
      const key = String(file.parentDirId);

      sizeByParent[key] = (sizeByParent[key] ?? 0) + file.size;
    });

    await Promise.all(
      Object.entries(sizeByParent).map(([dirId, size]) =>
        updateParentDirSize(dirId, -size),
      ),
    );

    return res.status(200).json({
      message: "Files deleted successfully",
      deletedIds: allowed.map((file) => String(file._id)),
      deleted: {
        files: allowed.length,
      },
    });
  } catch (error) {
    console.error("File delete error:", error);
    next(error);
  }
};
export const restoreFile = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(409)
        .json({ message: "Unauthorized. You are not logged in!" });
    }

    const ids = (req.body?.ids ?? [req.params.id]).filter((id) =>
      mongoose.isValidObjectId(id),
    );
    if (!ids.length) return res.status(400).json({ message: "No valid ids" });

    const files = await File.find({ _id: { $in: ids }, isDeleted: true });
    if (!files.length) {
      return res.status(404).json({ message: "File not found to restore" });
    }

    // storage check for ALL files together
    const rootDir = await Directory.findOne({ userId }).lean();
    const totalNeeded = files.reduce((sum, f) => sum + f.size, 0);
    const storageLeft = req.user.totalStorage - rootDir.size;

    if (totalNeeded > storageLeft) {
      return res.status(507).json({
        message: `Storage is full. You need ${formatSize(totalNeeded - storageLeft)} more storage`,
      });
    }

    // restore everything in one query
    await File.updateMany(
      { _id: { $in: files.map((f) => f._id) } },
      { isDeleted: false },
    );

    // one size update per parent folder
    const sizeByParent = {};
    files.forEach((f) => {
      const key = String(f.parentDirId);
      sizeByParent[key] = (sizeByParent[key] ?? 0) + f.size;
    });
    await Promise.all(
      Object.entries(sizeByParent).map(([dirId, size]) =>
        updateParentDirSize(dirId, size),
      ),
    );

    return res.status(200).json({
      message: "Restored successfully",
      restoredIds: files.map((f) => String(f._id)),
    });
  } catch (error) {
    next(error);
  }
};

async function setFolderPublicAccess(folderId, newRole) {
  const object = getFgaObject("folder", folderId);
  const folder = await Directory.findById(folderId);
  if (!folder) return;

  if (!newRole) {
    try {
      await fgaClient.write({
        deletes: [
          { user: "user:*", relation: "link_reader", object },
          { user: "user:*", relation: "link_writer", object },
        ],
      });
    } catch {}
    folder.isPublic = false;
    folder.publicRole = undefined;
  } else {
    const oldRelation = newRole === "reader" ? "link_writer" : "link_reader";
    const newRelation = newRole === "reader" ? "link_reader" : "link_writer";

    try {
      await fgaClient.write({
        deletes: [{ user: "user:*", relation: oldRelation, object }],
      });
    } catch {}
    try {
      await fgaClient.write({
        writes: [{ user: "user:*", relation: newRelation, object }],
      });
    } catch {}

    folder.isPublic = true;
    folder.publicRole = newRole;
  }

  await folder.save();
}

const getAncestors = async (path) => {
  const ancestors = await Directory.find({
    _id: { $in: path },
    name: { $not: /^root/ },
  }).select("name isPublic publicRole");

  return ancestors;
};

export const toggleFilePublic = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { itemId, role } = req.params;
    const { access, type, confirmCascade } = req.query;

    const resource = type === "folder" ? Directory : File;

    if (!userId) return res.status(403).json({ message: "User not logged in" });
    if (!itemId)
      return res.status(400).json({
        message: `${type === "file" ? "FileID" : "Directory Id"} is undefined`,
      });

    const item = await resource.findById(itemId);
    if (!item)
      return res.status(404).json({
        message: `${type === "file" ? "File" : "Directory"} not found`,
      });

    const canShare = await fgaClient.check({
      user: getFgaObject("user", userId),
      relation: "can_share",
      object: getFgaObject(type, itemId),
    });
    if (!canShare.allowed) {
      return res.status(403).json({ message: "Unauthorized!" });
    }

    const object = getFgaObject(type, itemId);
    const isRestricted = access === "restricted";
    const incomingPriority = isRestricted ? 0 : ROLE_PRIORITY[role];

    const ancestors = await getAncestors(item.path);

    const conflicting = ancestors
      .filter(
        (a) => a.isPublic && ROLE_PRIORITY[a.publicRole] > incomingPriority,
      )
      .sort(
        (a, b) => ROLE_PRIORITY[b.publicRole] - ROLE_PRIORITY[a.publicRole],
      )[0];

    if (conflicting && confirmCascade !== "true") {
      return res.status(200).json({
        needsConfirmation: true,
        conflict: {
          ancestorId: conflicting._id,
          ancestorName: conflicting.name,
          ancestorRole: conflicting.publicRole,
        },
      });
    }

    // confirmed — cascade the ancestor too
    if (conflicting && confirmCascade === "true") {
      await setFolderPublicAccess(conflicting._id, isRestricted ? null : role);
    }

    if (isRestricted) {
      const fileIds = [];
      const folderIds = [];

      if (type === "folder") {
        const queue = [itemId];
        while (queue.length) {
          const currentId = queue.shift();
          const [files, folders] = await Promise.all([
            File.find({ parentDirId: currentId, isDeleted: false })
              .select("_id")
              .lean(),
            Directory.find({ parentDirId: currentId, isDeleted: false })
              .select("_id")
              .lean(),
          ]);
          fileIds.push(...files.map((f) => f._id));
          for (const f of folders) {
            folderIds.push(f._id);
            queue.push(f._id);
          }
        }
      }

      const allObjects = [
        object,
        ...fileIds.map((id) => getFgaObject("file", id)),
        ...folderIds.map((id) => getFgaObject("folder", id)),
      ];

      const allToDelete = [];
      for (const obj of allObjects) {
        const tuples = await fgaClient.read({ object: obj });

        const matches = tuples.tuples.filter((t) => {
          return (
            ["link_reader", "link_writer"].includes(t.key.relation) &&
            t.key.user === "user:*"
          );
        });

        allToDelete.push(...matches);
      }

      if (allToDelete.length) {
        try {
          await fgaClient.write({
            deletes: allToDelete.map((t) => ({
              user: t.key.user,
              relation: t.key.relation,
              object: t.key.object,
            })),
          });
        } catch (err) {
          console.error("FGA DELETE FAILED:", err);
        }
      }

      if (fileIds.length)
        await File.updateMany(
          { _id: { $in: fileIds } },
          { $set: { isPublic: false }, $unset: { publicRole: "" } },
        );
      if (folderIds.length)
        await Directory.updateMany(
          { _id: { $in: folderIds } },
          { $set: { isPublic: false }, $unset: { publicRole: "" } },
        );

      item.isPublic = false;
      item.publicRole = undefined;
    } else {
      const newRelation = role === "reader" ? "link_reader" : "link_writer";
      const oldRelation = role === "reader" ? "link_writer" : "link_reader";

      try {
        await fgaClient.write({
          deletes: [{ user: "user:*", relation: oldRelation, object }],
        });
      } catch {}

      try {
        await fgaClient.write({
          writes: [{ user: "user:*", relation: newRelation, object }],
        });
      } catch {}

      item.isPublic = true;
      item.publicRole = role;
    }

    await item.save();

    const { permissions } = await resolveRole(
      item,
      type,
      userId,
      item.parentDirId,
    );

    return res.status(201).json({
      message: `${type === "file" ? "File" : "Directory"} made ${item.isPublic ? "public" : "private"} successfully`,
      permissions,
    });
  } catch (error) {
    next(error);
  }
};

async function grantGoogleAccess({
  id,
  usersArray,
  driveToken,
  itemInfo = {},
}) {
  if (!driveToken) {
    return {
      status: 401,
      body: {
        message: "Missing Google Drive access token",
        permissions: [],
      },
      notify: [],
    };
  }

  const drive = getDriveClient(driveToken);

  const responses = [];
  const notify = [];

  let existingPermissions = [];

  try {
    const { data } = await drive.permissions.list({
      fileId: id,
      supportsAllDrives: true,
      fields: "permissions(id,type,role,emailAddress)",
    });

    existingPermissions = data.permissions || [];
  } catch (error) {
    return {
      status: 500,
      body: {
        message:
          error.response?.data?.error?.message || error.message,
        permissions: [],
      },
      notify: [],
    };
  }

  for (const user of usersArray) {
    const email = (
      user.emailAddress || user.email || ""
    ).trim().toLowerCase();

    if (
      !email ||
      !["reader", "commenter", "writer"].includes(user.role)
    ) {
      responses.push({
        email,
        success: false,
        message: "Invalid email or permission role",
      });
      continue;
    }

    try {
      const existing = existingPermissions.find(
        (permission) =>
          permission.type === "user" &&
          permission.emailAddress?.toLowerCase() === email
      );

      let permission;
      let action;

      if (existing) {
        if (existing.role === user.role) {
          permission = existing;
          action = "unchanged";
        } else {
          const updated = await drive.permissions.update({
            fileId: id,
            permissionId: existing.id,
            supportsAllDrives: true,
            requestBody: {
              role: user.role,
            },
            fields: "id,type,role,emailAddress",
          });

          permission = updated.data;
          action = "updated";
        }
      } else {
        const created = await drive.permissions.create({
          fileId: id,
          supportsAllDrives: true,
          requestBody: {
            type: "user",
            role: user.role,
            emailAddress: email,
          },
          sendNotificationEmail: false,
          fields: "id,type,role,emailAddress",
        });

        permission = created.data;
        action = "created";

        existingPermissions.push(permission);
      }

      responses.push({
        ...permission,
        email,
        success: true,
        action,
        avatar: user.avatar || null,
      });

      if (action !== "unchanged" && user.id) {
        notify.push({
          userId: user.id,
          role: user.role,
          item: {
            id,
            name: itemInfo.name || "Shared item",
            url: itemInfo.url || itemInfo.webViewLink || null,
            isFolder: Boolean(itemInfo.isFolder),
          },
        });
      }
    } catch (error) {
      responses.push({
        email,
        success: false,
        message:
          error.response?.data?.error?.message ||
          error.message,
      });
    }
  }

  const failures = responses.filter(
    (permission) => permission.success === false
  );

  return {
    status:
      failures.length === responses.length ? 500 : 200,
    body: {
      message: "Google Drive permissions processed",
      permissions: responses,
    },
    notify,
  };
}

async function grantLocalAccess({
  id,
  type,
  usersArray,
  message,
  notifyPeople,
  confirmCascade,
}) {
  if (!["file", "folder"].includes(type)) {
    return {
      status: 400,
      body: { message: "Invalid resource type" },
      notify: [],
    };
  }

  const Model = type === "folder" ? Directory : File;

  const item = await Model.findById(id)
    .populate("parentDirId")
    .populate("userId", "name email")
    .lean();

  if (!item) {
    return {
      status: 404,
      body: { message: `${type} not found` },
      notify: [],
    };
  }

  if (type === "folder") {
    const owner = await User.findById(
      item.userId?._id || item.userId
    )
      .select("parentDirId")
      .lean();

    if (
      owner?.parentDirId &&
      item._id.toString() === owner.parentDirId.toString()
    ) {
      return {
        status: 400,
        body: { message: "Root directory cannot be shared" },
        notify: [],
      };
    }
  }

  const findDirectPermission = async (object, userId) => {
    const result = await fgaClient.read({
      user: getFgaObject("user", userId),
      object,
    });

    const tuple = (result?.tuples || []).find((t) =>
      ["shared_reader", "shared_writer", "reader", "writer"].includes(
        t.key?.relation
      )
    );

    return tuple?.key || null;
  };

  const findExistingPermissionSource = async (
    resourceType,
    resourceId,
    userId
  ) => {
    let currentType = resourceType;
    let currentId = resourceId;
    let resourceName = null;

    while (currentId) {
      const currentObject = getFgaObject(currentType, currentId);

      const direct = await findDirectPermission(
        currentObject,
        userId
      );

      if (direct) {
        return {
          object: currentObject,
          id: currentId,
          role: direct.relation,
          name: resourceName,
          isCurrentObject:
            currentId.toString() === resourceId.toString(),
        };
      }

      const currentModel =
        currentType === "folder" ? Directory : File;

      const resource = await currentModel
        .findById(currentId)
        .select("name parentDirId")
        .populate("parentDirId", "name")
        .lean();

      if (!resource?.parentDirId) break;

      currentType = "folder";
      resourceName = resource.parentDirId.name;
      currentId = resource.parentDirId._id;
    }

    return null;
  };

  for (const user of usersArray) {
    if (!user.id) {
      return {
        status: 400,
        body: { message: "User id is required" },
        notify: [],
      };
    }

    if (!["reader", "writer"].includes(user.role)) {
      return {
        status: 400,
        body: { message: `Invalid role: ${user.role}` },
        notify: [],
      };
    }
  }

  const usersWithSource = await Promise.all(
    usersArray.map(async (user) => ({
      user,
      source: await findExistingPermissionSource(
        type,
        id,
        user.id
      ),
    }))
  );

  const cascadeConflicts = [];

  for (const { user, source } of usersWithSource) {
    if (!source || source.isCurrentObject) continue;
    if (source.role === user.role) continue;

    const rootOwner = await User.findOne({
      parentDirId: source.id,
    })
      .select("_id")
      .lean();

    if (rootOwner) {
      return {
        status: 400,
        body: {
          message:
            "Cannot change an inherited permission from the root directory",
        },
        notify: [],
      };
    }

    cascadeConflicts.push({
      userId: user.id,
      ancestorId: source.id,
      ancestorName: source.name,
      previousRole: source.role,
      requestedRole: user.role,
    });
  }

  if (cascadeConflicts.length && !confirmCascade) {
    return {
      status: 200,
      body: {
        needsConfirmation: true,
        conflict: cascadeConflicts,
      },
      notify: [],
    };
  }

  const targetObject = getFgaObject(type, id);
  const notify = [];

  for (const { user, source } of usersWithSource) {
    const fgaUser = getFgaObject("user", user.id);

    try {
      if (source?.isCurrentObject) {
        const existing = await fgaClient.read({
          user: fgaUser,
          object: targetObject,
        });

        const relevant = (existing?.tuples || []).filter((t) =>
          ["reader", "writer", "shared_reader", "shared_writer"].includes(
            t.key?.relation
          )
        );

        for (const tuple of relevant) {
          await fgaClient.write({
            deletes: [
              {
                user: fgaUser,
                relation: tuple.key.relation,
                object: targetObject,
              },
            ],
          });
        }
      }

      const sharedRelation =
        user.role === "reader" ? "shared_reader" : "shared_writer";

      await fgaClient.write(
        {
          writes: [
            {
              user: fgaUser,
              relation: user.role,
              object: targetObject,
            },
          ],
        },
        { transaction: { disable: true } }
      );

      await fgaClient.write(
        {
          writes: [
            {
              user: fgaUser,
              relation: sharedRelation,
              object: targetObject,
            },
          ],
        },
        { transaction: { disable: true } }
      );

      if (!source) {
        await SharedAccess.updateOne(
          {
            itemId: id,
            itemType: type,
            userId: user.id,
          },
          {
            $setOnInsert: {
              sharedWithMeTime: new Date(),
            },
          },
          { upsert: true }
        );
      }

      if (notifyPeople && user.id) {
        const userData = await User.findById(user.id)
          .select("name email")
          .lean();

        if (userData) {
          notify.push({
            userId: user.id,
            role: user.role,
            item: {
              id,
              name: item.name,
              url: `${process.env.CLIENT_URL}/${
                type === "folder" ? "directory" : "file"
              }/${id}`,
              isFolder: type === "folder",
            },
          });
        }
      }
    } catch (error) {
      return {
        status: 500,
        body: {
          message: `Failed to update access for ${user.id}: ${error.message}`,
        },
        notify: [],
      };
    }
  }

  const finalResult = await resolveRole(
    item,
    type,
    item?.userId?._id,
    item.parentDirId,
    true
  );

  return {
    status: 200,
    body: {
      message: `${type} access updated successfully`,
      ...finalResult,
    },
    notify,
  };
}


export const giveAccessById = async (req, res, next) => {
  try {
    const {
      usersArray,
      message,
      type,
      confirmCascade,
      notifyPeople,
    } = req.body || {};

    const isBatch = Array.isArray(req.body?.items);

    const items = isBatch
      ? req.body.items
      : [{ id: req.params.id, type }];

    if (!Array.isArray(usersArray) || !usersArray.length) {
      return res.status(400).json({
        message: "No users provided",
      });
    }

    if (!items.length || items.length > 50) {
      return res.status(400).json({
        message: "Send between 1 and 50 items",
      });
    }

    const uniqueItems = [
      ...new Map(
        items.map((item) => [
          `${item.type}:${item.id}`,
          item,
        ])
      ).values(),
    ];

    for (const item of uniqueItems) {
      if (
        !item.id ||
        !["file", "folder", "google"].includes(item.type)
      ) {
        return res.status(400).json({
          message: "Invalid item id or type",
          item,
        });
      }
    }

    const driveToken =
      req.signedCookies?.drive_access_token;

    const results = [];
    const notifications = {};

    for (const itemInfo of uniqueItems) {
      let result;

      try {
        if (itemInfo.type === "google") {
          result = await grantGoogleAccess({
            id: itemInfo.id,
            usersArray,
            driveToken,
            itemInfo,
          });
        } else {
          result = await grantLocalAccess({
            id: itemInfo.id,
            type: itemInfo.type,
            usersArray,
            message,
            notifyPeople,
            confirmCascade,
          });
        }

        results.push({
          id: itemInfo.id,
          type: itemInfo.type,
          status: result.status,
          ...result.body,
        });

        for (const notification of result.notify || []) {
          if (!notifications[notification.userId]) {
            notifications[notification.userId] = {
              role: notification.role,
              items: [],
            };
          }

          notifications[notification.userId].items.push(
            notification.item
          );
        }
      } catch (error) {
        console.error("ITEM SHARE ERROR:", {
          id: itemInfo.id,
          type: itemInfo.type,
          message: error.message,
          googleError: error.response?.data,
        });

        results.push({
          id: itemInfo.id,
          type: itemInfo.type,
          status: 500,
          message:
            error.response?.data?.error?.message ||
            error.message,
          permissions: [],
        });
      }
    }

    const conflicts = results.filter(
      (result) => result.needsConfirmation
    );

    if (conflicts.length) {
      return res.status(200).json({
        needsConfirmation: true,
        results,
        conflict: results.flatMap(
          (result) => result.conflict || []
        ),
      });
    }

    const emailFailedFor = [];

    if (notifyPeople && Object.keys(notifications).length) {
      const sender = await User.findById(req.user._id)
        .select("name email")
        .lean();

      for (const [userId, notification] of Object.entries(
        notifications
      )) {
        try {
          const recipient = await User.findById(userId)
            .select("name email")
            .lean();

          if (!recipient) continue;

          await sendAccessEmail({
            toEmail: recipient.email,
            toName: sanitizeText(recipient.name),
            fromName: sanitizeText(sender?.name),
            fromEmail: sender?.email,
            role: notification.role,
            message: sanitizeText(message || ""),
            items: notification.items,
          });
        } catch (error) {
          console.error("SHARE EMAIL ERROR:", error.message);
          emailFailedFor.push(userId);
        }
      }
    }

    if (!isBatch) {
      const {
        id,
        type: itemType,
        status,
        ...body
      } = results[0];

      return res.status(status).json(body);
    }

    return res.status(200).json({
      results,
      emailFailedFor,
      summary: {
        total: uniqueItems.length,
        successful: results.filter(
          (result) =>
            result.status >= 200 &&
            result.status < 300 &&
            result.permissions?.some(
              (permission) => permission.success !== false
            )
        ).length,
        failed: results.filter(
          (result) => result.status < 200 || result.status >= 300
        ).length,
      },
    });
  } catch (error) {
    console.error("GIVE ACCESS ERROR:", error);

    return res.status(500).json({
      message: error.message || "Failed to grant access",
    });
  }
};

export const revokeAccessById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetId: permissionId, type, relation, confirmCascade } = req.body;

    const userId = req.user?._id;
    if (!permissionId) {
      return res.status(400).json({
        message: "Target permission is required",
      });
    }

    // Google Drive permission
   
if (type === "google") {
  const { drive_access_token } = req.signedCookies;

  if (!drive_access_token) {
    return res.status(401).json({
      message: "Missing token",
    });
  }

  const drive = getDriveClient(drive_access_token);
  const isPublicLink = permissionId === "anyoneWithLink";

  const findPermission = async (fileId) => {
    const { data } = await drive.permissions.list({
      fileId,
      fields:
        "permissions(id,type,role,emailAddress,permissionDetails(inherited,permissionType,role))",
    });

    return isPublicLink
      ? data.permissions?.find((p) => p.type === "anyone")
      : data.permissions?.find(
          (p) => p.type === "user" && p.id === permissionId
        );
  };

  const targetPermission = await findPermission(id);

  if (!targetPermission) {
    return res.status(404).json({
      message: "Permission not found",
    });
  }

  const hasInherited = targetPermission.permissionDetails?.some(
    (d) => d.inherited === true
  );

  // Inherited permission confirmation
  if (hasInherited && confirmCascade !== true) {
    const { data: fileMeta } = await drive.files.get({
      fileId: id,
      fields: "parents",
    });

    let ancestorId = fileMeta.parents?.[0];
    let ancestorMatch = null;

    while (ancestorId) {
      const perm = await findPermission(ancestorId);

      if (perm) {
        const { data: ancestorMeta } = await drive.files.get({
          fileId: ancestorId,
          fields: "id,name,parents",
        });

        ancestorMatch = {
          fileId: ancestorId,
          name: ancestorMeta.name,
          permission: perm,
        };

        break;
      }

      const { data: nextMeta } = await drive.files.get({
        fileId: ancestorId,
        fields: "parents",
      });

      ancestorId = nextMeta.parents?.[0];
    }

    return res.status(200).json({
      needsConfirmation: true,
      conflict: ancestorMatch
        ? {
            ancestorId: ancestorMatch.fileId,
            ancestorName: ancestorMatch.name,
            previousRole: ancestorMatch.permission.role,
          }
        : null,
    });
  }

  // Confirmed inherited permission removal
  if (hasInherited && confirmCascade === true) {
    const { data: fileMeta } = await drive.files.get({
      fileId: id,
      fields: "parents",
    });

    let ancestorId = fileMeta.parents?.[0];
    let revoked = false;

    while (ancestorId) {
      const perm = await findPermission(ancestorId);

      if (perm) {
        await drive.permissions.delete({
          fileId: ancestorId,
          permissionId: perm.id,
        });

        revoked = true;
        break;
      }

      const { data: nextMeta } = await drive.files.get({
        fileId: ancestorId,
        fields: "parents",
      });

      ancestorId = nextMeta.parents?.[0];
    }

    if (!revoked) {
      return res.status(404).json({
        message: "Parent permission not found",
      });
    }

    return res.status(200).json({
      message: "Permission revoked successfully",
    });
  }

  // Direct permission removal
  await drive.permissions.delete({
    fileId: id,
    permissionId: targetPermission.id,
  });

  return res.status(200).json({
    message: "Permission revoked successfully",
  });
}


    // Local (FGA) permission
    const objectType = type === "folder" ? "folder" : "file";
    const user = getFgaObject("user", permissionId);
    const object = getFgaObject(objectType, id);

    const canShare = await fgaClient.check({
      user: getFgaObject("user", userId),
      relation: "can_share",
      object,
    });
    if (!canShare.allowed) {
      return res.status(403).json({ message: "Unauthorized!" });
    }

    const relationsToCheck =
      relation === "remove"
        ? ["reader", "writer", "shared_reader", "shared_writer"]
        : [relation];

    const findDirectPermissions = async (obj) => {
      const result = await fgaClient.read({ user, object: obj });
      const tuples = result?.tuples || [];
      return tuples.filter((t) => relationsToCheck.includes(t.key?.relation));
    };

    const findExistingPermissionSource = async (resourceType, resourceId) => {
      let currentType = resourceType;
      let currentId = resourceId;
      let resourceName = null;

      while (currentId) {
        const currentObject = getFgaObject(currentType, currentId);
        const direct = await findDirectPermissions(currentObject);

        if (direct.length) {
          return {
            object: currentObject,
            id: currentId,
            roles: direct.map((t) => t.key.relation), // now an array
            name: resourceName,
            isCurrentObject: currentId.toString() === resourceId.toString(),
          };
        }

        const currentModel = currentType === "folder" ? Directory : File;
        const resource = await currentModel
          .findById(currentId)
          .select("name parentDirId")
          .populate("parentDirId", "name")
          .lean();

        if (!resource?.parentDirId) break;

        currentType = "folder";
        resourceName = resource.parentDirId.name;
        currentId = resource.parentDirId._id;
      }

      return null;
    };

    const source = await findExistingPermissionSource(objectType, id);

    if (!source) {
      return res.status(200).json({ message: "Access already revoked" });
    }

    if (!source.isCurrentObject && confirmCascade !== true) {
      return res.status(200).json({
        needsConfirmation: true,
        conflict: {
          ancestorId: source.id,
          ancestorName: source.name,
          previousRole: source.roles[0], // just for display
        },
      });
    }

    await fgaClient.write({
      deletes: source.roles.map((role) => ({
        user,
        relation: role,
        object: source.object,
      })),
    });

    return res.status(200).json({ message: "Access revoked successfully" });
  } catch (error) {
    next(error);
  }
};

export const fetchUserWithFiles = async (req, res, next) => {
  try {
    const usersWithFiles = await User.aggregate([
      {
        $match: {
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: "files",
          localField: "_id",
          foreignField: "userId",
          as: "files",
        },
      },
      {
        $addFields: {
          files: {
            $filter: {
              input: "$files",
              as: "file",
              cond: { $eq: ["$$file.isDeleted", false] },
            },
          },
        },
      },
      {
        $match: {
          "files.0": { $exists: true },
        },
      },

      {
        $project: {
          password: 0,
        },
      },
    ]);

    return res.status(200).json({ users: usersWithFiles });
  } catch (error) {
    next(error);
  }
};

async function getDriveAncestors(drive, fileId) {
  const ancestors = [];
  let currentId = fileId;

  while (true) {
    const { data: file } = await drive.files.get({
      fileId: currentId,
      fields: "id, name, parents",
    });

    if (!file.parents?.length) break;

    const parentId = file.parents[0];

    const { data: parent } = await drive.files.get({
      fileId: parentId,
      fields: "id, name",
    });

    const { data: permData } = await drive.permissions.list({
      fileId: parentId,
      fields: "permissions(id, type, role)",
    });

    const publicPermission = permData.permissions?.find(
      (p) => p.type === "anyone",
    );

    ancestors.push({
      _id: parent.id,
      name: parent.name,
      isPublic: Boolean(publicPermission),
      publicRole: publicPermission?.role || null,
    });

    currentId = parentId;
  }

  return ancestors;
}

async function setDriveFolderPublicAccess(drive, folderId, newRole) {
  const { data: permData } = await drive.permissions.list({
    fileId: folderId,
    fields: "permissions(id, type, role)",
  });

  const existing = permData.permissions?.find((p) => p.type === "anyone");

  if (!newRole) {
    if (existing) {
      await drive.permissions.delete({
        fileId: folderId,
        permissionId: existing.id,
      });
    }
    return;
  }

  if (existing) {
    await drive.permissions.update({
      fileId: folderId,
      permissionId: existing.id,
      requestBody: { role: newRole },
    });
  } else {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: { type: "anyone", role: newRole },
    });
  }
}

export const updateGoogleDrivePermission = async (req, res, next) => {
  try {
    const { drive_access_token } = req.signedCookies;

    if (!drive_access_token) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { fileId, role, confirmCascade } = req.body;

    if (!fileId || !role) {
      return res.status(400).json({
        message: "fileId and role are required",
      });
    }

    const drive = getDriveClient(drive_access_token);

    const incomingPriority = ROLE_PRIORITY[role] || 0;

    const ancestors = await getDriveAncestors(drive, fileId);

    const conflictingAncestors = ancestors.filter(
      (a) => a.isPublic && ROLE_PRIORITY[a.publicRole] > incomingPriority,
    );

    if (conflictingAncestors.length && confirmCascade !== true) {
      const broadest = [...conflictingAncestors].sort(
        (a, b) => ROLE_PRIORITY[b.publicRole] - ROLE_PRIORITY[a.publicRole],
      )[0];

      return res.status(200).json({
        needsConfirmation: true,
        conflict: {
          ancestorId: broadest._id,
          ancestorName: broadest.name,
          ancestorRole: broadest.publicRole,
        },
      });
    }

    if (conflictingAncestors.length && confirmCascade === true) {
      const rootFirst = [...conflictingAncestors].reverse();

      for (const ancestor of rootFirst) {
        await setDriveFolderPublicAccess(drive, ancestor._id, role);
      }
    }

    const permissions = await drive.permissions.list({
      fileId,
      fields: "permissions(id,type,role,allowFileDiscovery)",
    });

    const publicPermission = permissions.data.permissions.find(
      (p) => p.type === "anyone",
    );

    let response;

    if (publicPermission) {
      response = await drive.permissions.update({
        fileId,
        permissionId: publicPermission.id,
        requestBody: {
          role,
        },
        fields: "id,type,role,emailAddress,allowFileDiscovery",
      });
    } else {
      response = await drive.permissions.create({
        fileId,
        requestBody: {
          type: "anyone",
          role,
          allowFileDiscovery: false,
        },
        fields: "id,type,role,emailAddress,allowFileDiscovery",
      });
    }

    return res.status(200).json({
      message: "Permission updated successfully",
      permission: response.data,
    });
  } catch (error) {
    console.error("Update permission error:", error);
    next(error);
  }
};

export const updateFileViewTime = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user?._id;

  if (!id) {
    return res.status(400).json({
      message: "File Id is required!",
    });
  }

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    await FileActivity.findOneAndUpdate(
      {
        file: id,
        user: userId,
        type: "view",
      },
      {
        $set: {
          occuredAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    return res.status(200).json({
      message: "View record updated!",
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};
