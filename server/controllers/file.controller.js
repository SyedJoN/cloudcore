import { createWriteStream } from "fs";
import { rename, rm } from "fs/promises";
import path from "path";
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
import { getFile } from "../services/s3/getFile.js";
import { deleteFile as deleteFileFromS3 } from "../services/s3/delete.js";
import { createGetSignedUrl } from "../services/s3/getSignedUrl.js";
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

  // Direct permissions
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

  // Inherited permissions
  if (parentDir?._id) {
    const ancestors = await getAncestorDirectories(parentDir);

    for (const ancestor of ancestors) {
      const inheritedPermissions = await resolveObjectPermissions(
        `folder:${ancestor._id}`,
      );

      for (const { user, relation } of inheritedPermissions) {
        // An ancestor's owner only passes down writer access to
        // descendants, not ownership of them.
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

  // Current user's effective role, factoring in public access
  const currentUserId = getIdString(userId);
  const currentUserPermission = currentUserId
    ? permissionMap.get(currentUserId)
    : null;

  const isPublic = Boolean(item?.isPublic);
  const publicRole = isPublic ? item?.publicRole || "reader" : null;

  const directRole = currentUserPermission?.directRole || null;
  const inheritedRole = currentUserPermission?.inheritedRole || null;

  const directPriority = directRole ? ROLE_PRIORITY[directRole] : 0;
  const inheritedPriority = inheritedRole ? ROLE_PRIORITY[inheritedRole] : 0;
  const publicPriority = publicRole ? ROLE_PRIORITY[publicRole] : 0;

  const highestPriority = Math.max(
    directPriority,
    inheritedPriority,
    publicPriority,
  );

  let currentRole = null;
  let roleSource = null; // "direct" || "inherited" || "public"

  if (highestPriority > 0) {
    if (publicPriority === highestPriority) {
      currentRole = publicRole;
      roleSource = "public";
    } else if (directPriority >= inheritedPriority) {
      currentRole = directRole;
      roleSource = "direct";
    } else {
      currentRole = inheritedRole;
      roleSource = "inherited";
    }
  }

  const isPublicEffective = Boolean(
    currentRole && publicRole && publicPriority === highestPriority,
  );

  const parentId = getIdString(parentDir?.parentDirId);
  const isRootDirectory = Boolean(parentDir?._id) && !parentId;
  const isRootLevelFile = type === "file" && isRootDirectory;

  const currentUserCapabilities = getCapabilities(
    currentRole,
    type,
    isRootLevelFile,
  );

  if (isPublicEffective && !directRole && !inheritedRole) {
    currentUserCapabilities.canChangeRole = false;
  }

  const [viewActivity, modifiedActivity] = await Promise.all([
    FileActivity.findOne({
      file: item._id,
      user: userId,
      type: "view",
    }).lean(),

    FileActivity.findOne({
      file: item._id,
      user: userId,
      type: { $in: ["rename", "move"] },
    })
      .sort({ occuredAt: -1 })
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

  if (isPublic) {
    const publicCapabilities = getCapabilities(
      publicRole,
      type,
      isRootLevelFile,
    );
    publicCapabilities.canChangeRole = false;

    permissions.push({
      id: "anyoneWithLink",
      type: "anyone",
      role: publicRole,
      capabilities: publicCapabilities,
      inherited: false,
      inheritedFrom: null,
    });
  }

  const ownership = await Ownership.findOne({ itemId: item?._id })
    .sort({ createdAt: -1 })
    .lean();

  const ownerId = ownership?.toUser ? getIdString(ownership.toUser) : null;

  const updatedPermissions = permissions.map((permission) => {
    const permissionId = getIdString(permission.id);

    if (ownership?.status === "pending" && permissionId === ownerId) {
      return { ...permission, pendingOwner: true };
    }

    return permission;
  });

  return {
    capabilities: currentUserCapabilities,
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
      const url = await createGetSignedUrl({
        s3Key,
        fileName: file.name,
        download: true,
      });
      return res.redirect(url);
    }

    const s3Response = await getFile(s3Key);

    if (!s3Response.ContentType?.startsWith("text/")) {
      const url = await createGetSignedUrl({
        s3Key,
        fileName: file.name,
      });

      return res.redirect(url);
    }

    res.setHeader("Content-Type", s3Response.ContentType || "text/plain");
    await file.save();
    return s3Response.Body.pipe(res);
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
    } = await resolveRole(file, "file", userId, parentDir);

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

    const isPublicallyAccessible = parentDir?.isPublic;
    file?.isPublic;

    if (!isPublicallyAccessible) {
      if (!userId) {
        return res.status(403).json({
          message: "Access denied",
          requiresAuth: true,
        });
      }

      const canRead = await Promise.all(
        fgaClient.check({
          user: getFgaObject("user", userId),
          role: "can_read",
          object: getFgaObject("file", id),
        }),
      );

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
          $set: { lastOccurredAt: new Date() },
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
          role: "can_read",
          object: getFgaObject("file", id),
        }),
        fgaClient.check({
          user: getFgaObject("user", userId),
          role: "can_write",
          object: getFgaObject("file", id),
        }),
      ]);

      if (canRead.checked || canWrite.checked) {
        await FileActivity.findOneAndUpdate(
          {
            file: file._id,
            user: userId,
            type: "view",
          },
          {
            $set: { lastOccurredAt: new Date() },
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
    await FileActivity.findOneAndUpdate(
      {
        file: file._id,
        user: userId,
        type: "view",
      },
      {
        $set: { lastOccurredAt: new Date() },
      },
      {
        upsert: true,
      },
    );
    await file.save();
  } catch (error) {
    next(error);
  }
};

export const getRecentFiles = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(403).json({ message: "Access denied" });

    const allowedFiles = await fgaClient.listObjects({
      user: getFgaObject("user", userId),
      relation: "can_read",
      type: "file",
    });

    const sharedFileIds = allowedFiles.objects
      .map((obj) => obj.split(":")[1])
      .filter(Boolean);

    const [ownFiles, sharedFiles] = await Promise.all([
      File.find({ userId, isDeleted: false })
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

    const getActivityTime = (file) => {
      const viewed = file.viewedByMeTime
        ? new Date(file.viewedByMeTime).getTime()
        : 0;
      const modified = file.updatedAt ? new Date(file.updatedAt).getTime() : 0;
      return Math.max(viewed, modified);
    };

    allFiles.sort((a, b) => getActivityTime(b) - getActivityTime(a));

    const RECENT_LIMIT = 100;
    const recentFiles = allFiles.slice(0, RECENT_LIMIT);

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

      if (req.user?.role === "superuser" || isOwner) {
        return await performRename(file, finalName, res, userId);
      }

      const canWrite = await fgaClient.check({
        user: getFgaObject("user", userId),
        role: "can_write",
        object: `file:${fileId}`,
      });

      if (canWrite.allowed) {
        return await performRename(file, finalName, res, userId);
      }

      const parentDir = file.parentDirId
        ? await Directory.findById(file.parentDirId).lean()
        : null;

      const publicRole = file.isPublic
        ? file.publicRole || "viewer"
        : parentDir?.isPublic
          ? parentDir?.publicRole || "viewer"
          : null;

      if (publicRole === "editor") {
        return await performRename(file, finalName, res, userId);
      }

      return res.status(403).json({
        message: "You don't have permission to rename this file",
      });
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
      $set: { lastOccurredAt: new Date() },
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
    const { id } = req.params;
    const userId = req.user._id;

    const file = await File.findOne({ _id: id });
    if (!file) return res.status(404).json({ message: "File not found!" });

    const isOwner = file.userId.toString() === userId.toString();

    if (isOwner) {
      file.isDeleted = true;
      file.trashedTime = Date.now();
      await file.save();
    } else {
      await Promise.allSettled([
        fgaClient.write({
          deleteFile: [
            {
              user: getFgaObject("user", userId),
              role: "reader",
              object: getFgaObject("file", id),
            },
          ],
        }),
        fgaClient.write({
          deletes: [
            {
              user: getFgaObject("user", userId),
              role: "writer",
              object: getFgaObject("file", id),
            },
          ],
        }),
      ]);
    }

    await updateParentDirSize(file.parentDirId, -file.size);
    return res.status(200).json({ message: "File moved to trash" });
  } catch (error) {
    next(error);
  }
};
export const deleteFile = async (req, res, next) => {
  const userId = req.user._id;
  const { id } = req.params;
  const { type } = req.query;

  if (!id) {
    return res.status(400).json({
      message: "fileId is required",
    });
  }
  if (type === "google") {
    try {
      const { drive_access_token } = req.signedCookies;
      if (!drive_access_token) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }
      const drive = getDriveClient(drive_access_token);

      await drive.files.delete({
        fileId: id,
      });

      return res.status(200).json({
        message: "File deleted successfully",
      });
    } catch (error) {
      console.error("File delete error:", error);
      next(error);
    }
  } else {
    try {
      const fileToDelete = await File.findOne({
        _id: id,
      }).select("name extension size");
      if (!fileToDelete) {
        return res.status(404).json({ message: "File not found!" });
      }
      const object = getFgaObject("file", id);
      const user = getFgaObject("user", userId);
      await fgaClient.write(
        {
          deletes: [
            { user, role: "owner", object },
            {
              user,
              relation: "writer",
              object,
            },
            {
              user,
              relation: "reader",
              object,
            },
          ],
        },
        {
          conflict: {
            onMissingDeletes: ClientWriteRequestOnMissingDeletes.Ignore,
          },
        },
      );
      const s3Key = `${fileToDelete._id}${fileToDelete.extension}`;
      await deleteFileFromS3(s3Key);
      await fileToDelete.deleteOne();
      await updateParentDirSize(fileToDelete.parentDirId, fileToDelete.size);
      return res.status(200).json({ message: "File Deleted Successfully" });
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
};
export const restoreFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const totalStorage = req.user?.totalStorage;
    if (!userId) {
      return res
        .status(409)
        .json({ message: "Unauthorized. You are not logged in!" });
    }
    const file = await File.findOne({ _id: id, isDeleted: true });
    if (!file) {
      return res.status(404).json({ message: "File not found to restore" });
    }
    const rootDir = await Directory.findOne({
      userId,
    }).lean();

    const totalStorageLeft = totalStorage - rootDir.size;
    const needed = file.size - totalStorageLeft;
    if (file.size > totalStorageLeft) {
      return res.status(507).json({
        message: `Storage is full. You need ${formatSize(needed)} more storage`,
      });
    }
    file.isDeleted = false;
    await file.save();
    await updateParentDirSize(file.parentDirId, file.size);

    return res.status(200).json({ message: "File restored successfully" });
  } catch (error) {
    next(error);
  }
};

export const toggleFilePublic = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { itemId, role } = req.params;
    const { access, type } = req.query;
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

    const isRestricted = access === "restricted";

    if (isRestricted) {
      const tuples = await fgaClient.read({
        tuple_key: { object: getFgaObject(type, itemId) },
      });

      const toDelete = tuples.tuples.filter(
        (t) => t.key.role !== "owner" && t.key.role !== "parent",
      );

      if (toDelete.length) {
        await Promise.allSettled(
          toDelete.map((t) =>
            fgaClient.write({
              deletes: [
                {
                  user: t.key.user,
                  role: t.key.role,
                  object: getFgaObject(type, itemId),
                },
              ],
            }),
          ),
        );
      }

      item.isPublic = false;
      item.publicRole = undefined;
    } else {
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
      permissions: permissions,
    });
  } catch (error) {
    next(error);
  }
};

export const giveAccessById = async (req, res, next) => {
  try {
    const { usersArray, message, type } = req.body;
    const id = req.params.id;

    if (!Array.isArray(usersArray) || usersArray.length === 0) {
      return res.status(400).json({
        message: "No users provided",
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

      const { data } = await drive.permissions.list({
        fileId: id,
        fields: "permissions(id,type,role,emailAddress,displayName)",
      });

      const existingPermissions = data.permissions || [];

      const responses = await Promise.all(
        usersArray.map(async (user) => {
          const email = user.emailAddress || user.email;

          const existing = existingPermissions.find(
            (p) =>
              p.type === "user" &&
              p.emailAddress?.toLowerCase() === email?.toLowerCase(),
          );

          if (existing) {
            const response = await drive.permissions.update({
              fileId: id,
              permissionId: existing.id,
              requestBody: {
                role: user.role,
              },
              fields: "id,type,role,emailAddress,displayName",
            });

            return {
              ...response.data,
              avatar: user.avatar || response.data.photoLink || null,
            };
          }

          const response = await drive.permissions.create({
            fileId: id,
            requestBody: {
              type: "user",
              role: user.role,
              emailAddress: email,
            },
            sendNotificationEmail: true,
            fields: "id,type,role,emailAddress,displayName",
          });

          return {
            ...response.data,
            avatar: user.avatar || response.data.photoLink || null,
          };
        }),
      );

      return res.status(200).json({
        message: message || "Permissions updated successfully!",
        permissions: responses,
      });
    }

    if (!["file", "folder"].includes(type)) {
      return res.status(400).json({
        message: "Invalid resource type",
      });
    }

    const Model = type === "folder" ? Directory : File;

    const item = await Model.findById(id)
      .populate("parentDirId")
      .populate("userId", "name email")
      .lean();

    if (!item) {
      return res.status(404).json({
        message: `${type} not found`,
      });
    }

    if (type === "folder") {
      const owner = await User.findById(item.userId?._id || item.userId)
        .select("parentDirId")
        .lean();

      if (
        owner?.parentDirId &&
        item._id.toString() === owner.parentDirId.toString()
      ) {
        return res.status(400).json({
          message: "Root directory cannot be shared",
        });
      }
    }

    const writeRole = async (object, userId, role) => {
      await fgaClient.write(
        {
          writes: [
            {
              user: getFgaObject("user", userId),
              relation: role,
              object,
            },
          ],
        },
        {
          transaction: {
            disable: true,
          },
        },
      );
    };

    const findDirectPermission = async (object, userId) => {
      const result = await fgaClient.read({
        user: getFgaObject("user", userId),
        object,
      });

      const tuples = result?.tuples || [];

      const tuple = tuples.find(
        (t) =>
          t.key?.user === getFgaObject("user", userId) &&
          ["reader", "writer"].includes(t.key?.relation),
      );

      return tuple?.key || null;
    };

    const findExistingPermissionSource = async ({
      resourceType,
      resourceId,
      userId,
    }) => {
      let currentType = resourceType;
      let currentId = resourceId;

      while (currentId) {
        const currentObject = getFgaObject(currentType, currentId);

        const directPermission = await findDirectPermission(
          currentObject,
          userId,
        );

        if (directPermission) {
          return {
            object: currentObject,
            type: currentType,
            id: currentId,
            role: directPermission.relation,
            isCurrentObject: currentId.toString() === resourceId.toString(),
          };
        }

        const currentModel = currentType === "folder" ? Directory : File;

        const currentResource = await currentModel
          .findById(currentId)
          .select("parentDirId")
          .lean();

        if (!currentResource) {
          break;
        }

        const parentId = currentResource.parentDirId;

        if (!parentId) {
          break;
        }

        currentType = "folder";
        currentId = parentId;
      }

      return null;
    };

    await Promise.all(
      usersArray.map(async (user) => {
        if (!user.id) {
          throw new Error("User id is required");
        }

        if (!["reader", "writer"].includes(user.role)) {
          throw new Error(`Invalid role: ${user.role}`);
        }

        const userId = user.id;

        const existingPermissionSource = await findExistingPermissionSource({
          resourceType: type,
          resourceId: id,
          userId,
        });

        let targetFgaObject;
        let previousRole = null;
        let inherited = false;

        if (existingPermissionSource) {
          targetFgaObject = existingPermissionSource.object;
          previousRole = existingPermissionSource.role;
          inherited = !existingPermissionSource.isCurrentObject;
        } else {
          targetFgaObject = getFgaObject(type, id);
        }

        if (inherited) {
          const sourceId = existingPermissionSource.id;

          const rootOwner = await User.findOne({
            parentDirId: sourceId,
          })
            .select("_id parentDirId")
            .lean();

          if (rootOwner) {
            throw new Error(
              "Cannot change an inherited permission from the root directory",
            );
          }
        }

        if (previousRole === user.role) {
          return;
        }

        if (previousRole) {
          await fgaClient.write({
            deletes: [
              {
                user: getFgaObject("user", userId),
                relation: previousRole,
                object: targetFgaObject,
              },
            ],
          });
        }

        await writeRole(targetFgaObject, userId, user.role);

        if (!existingPermissionSource) {
          await SharedAccess.updateOne(
            { itemId: id, itemType: type, userId },
            { $setOnInsert: { sharedWithMeTime: new Date() } },
            { upsert: true },
          );

          const userData = await User.findById(userId)
            .select("name email avatar")
            .lean();

          if (userData) {
            await sendAccessEmail({
              toEmail: userData.email,
              toName: userData.name,
              fromName: item.userId.name,
              fromEmail: item.userId.email,
              itemName: item.name,
              itemType: type,
              itemUrl: `${process.env.CLIENT_URL}/${
                type === "folder" ? "directory" : "file"
              }/${id}`,
              role: user.role,
              message,
            });
          }
        }
      }),
    );

    const finalResult = await resolveRole(
      item,
      type,
      item?.userId,
      item.parentDirId,
      true,
    );

    return res.status(200).json({
      message: `${type} access updated successfully`,
      ...finalResult,
    });
  } catch (error) {
    console.error("giveAccessById error:", error);
    next(error);
  }
};

export const revokeAccessById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetId: permissionId, type, relation } = req.body;

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

      await drive.permissions.delete({
        fileId: id,
        permissionId,
      });

      return res.status(200).json({
        message: "Permission revoked successfully",
      });
    }

  
    const objectType = type === "folder" ? "folder" : "file";
    const user = getFgaObject("user", permissionId);
    const object = getFgaObject(objectType, id);


    const relations =
      relation === "remove"
        ? ["reader", "writer"]
        : [relation];

   
    const tuples = [];

    for (const rel of relations) {
      const result = await fgaClient.read({
        user,
        relation: rel,
        object,
      });

      tuples.push(...result.tuples);
    }

  
    if (!tuples.length) {
      return res.status(200).json({
        message: "Access already revoked",
      });
    }

    await fgaClient.write({
      deletes: tuples.map(({ key }) => ({
        user: key.user,
        relation: key.relation,
        object: key.object,
      })),
    });

    return res.status(200).json({
      message: "Access revoked successfully",
    });
  } catch (error) {
    next(error);
  }
};


export const fetchItemPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type = "file" } = req.query;

    if (!id) {
      return res.status(404).json({ message: "Id missing" });
    }

    const object = getFgaObject(type, id);

    let allTuples = [];
    let continuationToken = undefined;

    do {
      const response = await fgaClient.read(
        { tuple_key: { object } },
        { continuationToken },
      );
      allTuples = allTuples.concat(response.tuples);
      continuationToken = response.continuation_token;
    } while (continuationToken);

    const collaborators = allTuples
      .filter(
        (t) =>
          t.key.object === object &&
          t.key.user.startsWith("user:") &&
          ["reader", "writer"].includes(t.key.role),
      )
      .map((t) => ({
        userId: t.key.user.split(":")[1],
        role: t.key.role,
      }));

    if (!collaborators.length) {
      return res.status(200).json({ success: true, users: [] });
    }

    const users = await User.find({
      _id: { $in: collaborators.map((c) => c.userId) },
    })
      .select("name email avatar")
      .lean();

    const result = users.map((user) => {
      const permissions = collaborators
        .filter((c) => c.userId === user._id.toString())
        .map((c) => c.role);

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        permissions,
      };
    });

    return res.status(200).json({ success: true, users: result });
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

export const updateGoogleDrivePermission = async (req, res, next) => {
  try {
    const { drive_access_token } = req.signedCookies;

    if (!drive_access_token) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { fileId, role } = req.body;

    if (!fileId || !role) {
      return res.status(400).json({
        message: "fileId and role are required",
      });
    }

    const drive = getDriveClient(drive_access_token);

    const permissions = await drive.permissions.list({
      fileId,
      fields: "permissions(id,type,role,allowFileDiscovery)",
    });

    const publicPermission = permissions.data.permissions.find(
      (p) => p.type === "anyone",
    );

    const file = await drive.files.get({
      fileId,
      fields: "parents",
    });

    const parentId = file.data.parents?.[0];

    if (parentId) {
      const parentPermissions = await drive.permissions.list({
        fileId: parentId,
        fields: "permissions(id,type,role,allowFileDiscovery)",
      });

      const parentPublicPermission = parentPermissions.data.permissions.find(
        (p) => p.type === "anyone",
      );

      if (
        parentPublicPermission &&
        parentPublicPermission.role === "writer" &&
        role === "reader"
      ) {
        return res.status(400).json({
          message:
            "Parent folder has higher public access. Update parent permission first.",
        });
      }
    }

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
          lastOccurredAt: new Date(),
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
