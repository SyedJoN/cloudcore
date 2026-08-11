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
const roleMap = {
  viewer: "reader",
  editor: "writer",
  commenter: "commenter",
};
const ROLE_PRIORITY = {
  reader: 1,
  writer: 2,
  owner: 3,
};

const resolveRole = async (item, type, userId, parentDir) => {
  const objectType = type === "folder" ? "folder" : "file";
  const object = `${objectType}:${item._id}`;

  const getIdString = (value) => {
    if (!value) return null;

    if (typeof value === "string") {
      return value;
    }

    if (value?._id) {
      return value._id.toString();
    }

    if (typeof value.toString === "function") {
      const stringValue = value.toString();

      if (stringValue !== "[object Object]") {
        return stringValue;
      }
    }

    return null;
  };

  const ROLE_PRIORITY = {
    reader: 1,
    writer: 2,
    owner: 3,
  };

  const getCapabilities = (role) => {
    const isOwner = role === "owner";
    const isWriter = role === "writer" || isOwner;
    const isReader = role === "reader" || role === "writer" || isOwner;

    const capabilities = {
      canRead: isReader,

      canWrite: isWriter,

      canShare: isWriter,

      canChangeRole: isWriter,

      canRename: isWriter,

      canDownload: isReader,

      canCopy: isReader,

      canMove: isWriter,

      canTrash: isOwner,

      canDelete: isOwner,
    };

    if (type === "folder") {
      capabilities.canAddChildren = isWriter;
      capabilities.canRemoveChildren = isWriter;
    } else {
      capabilities.canAddChildren = false;
      capabilities.canRemoveChildren = false;
    }

    return capabilities;
  };

  const getTuples = async (objectName) => {
    const allTuples = [];
    let continuationToken;

    do {
      const response = await fgaClient.read(
        {
          tuple_key: {
            object: objectName,
          },
        },
        continuationToken
          ? {
              continuationToken,
            }
          : undefined,
      );

      allTuples.push(...(response.tuples || []));

      continuationToken = response.continuation_token;
    } while (continuationToken);

    return allTuples;
  };

  const getCollaborators = (tuples, objectName) => {
    return tuples
      .filter(
        (tuple) =>
          tuple.key.object === objectName &&
          tuple.key.user?.startsWith("user:") &&
          ["owner", "reader", "writer"].includes(tuple.key.relation),
      )
      .map((tuple) => ({
        userId: tuple.key.user.slice("user:".length),
        relation: tuple.key.relation,
      }));
  };

  const getUsers = async (collaborators) => {
    if (!collaborators.length) {
      return [];
    }

    const validUserIds = collaborators
      .map((collaborator) => collaborator.userId)
      .filter((id) => mongoose.isValidObjectId(id));

    if (!validUserIds.length) {
      return [];
    }

    return User.find({
      _id: {
        $in: validUserIds,
      },
    })
      .select("name email avatar")
      .lean();
  };

  const resolveObjectPermissions = async (objectName) => {
    const tuples = await getTuples(objectName);

    const collaborators = getCollaborators(tuples, objectName);

    if (!collaborators.length) {
      return [];
    }

    const users = await getUsers(collaborators);

    const relationMap = new Map();

    for (const collaborator of collaborators) {
      relationMap.set(collaborator.userId, collaborator.relation);
    }

    return users
      .map((user) => {
        const relation = relationMap.get(user._id.toString());

        if (!relation) {
          return null;
        }

        return {
          user,
          relation,
        };
      })
      .filter(Boolean);
  };

  const getAncestorDirectories = async (directory) => {
    const ancestors = [];

    let current = directory;

    while (current?._id) {
      ancestors.push(current);

      const parentId = getIdString(current.parentDirId);

      if (!parentId) {
        break;
      }

      current = await Directory.findById(parentId)
        .select("_id name parentDirId isPublic publicRole")
        .lean();
    }

    return ancestors;
  };

  const parentId = getIdString(parentDir?.parentDirId);

  const isRootDirectory = Boolean(parentDir?._id) && !parentId;

  const isRootLevelFile = type === "file" && isRootDirectory;

  const permissionMap = new Map();
  const mergePermission = ({
    user,
    relation,
    source,
    inheritedFrom = null,
  }) => {
    if (!user?._id) {
      return;
    }

    if (!ROLE_PRIORITY[relation]) {
      return;
    }

    const id = user._id.toString();

    let permission = permissionMap.get(id);

    if (!permission) {
      permission = {
        id: user._id,

        photoLink: user.avatar || null,

        displayName: user.name,

        type: "user",

        emailAddress: user.email,

        role: relation,

        directRole: source === "direct" ? relation : null,

        inheritedRole: source === "parent" ? relation : null,

        inherited: source === "parent",

        inheritedFrom:
          source === "parent"
            ? {
                id: inheritedFrom?._id || null,

                name: inheritedFrom?.name || null,

                role: relation,
              }
            : null,
      };

      permissionMap.set(id, permission);

      return;
    }

    if (source === "direct") {
      permission.directRole = relation;
    }

    if (source === "parent") {
      const currentPriority = permission.inheritedRole
        ? ROLE_PRIORITY[permission.inheritedRole]
        : 0;

      const incomingPriority = ROLE_PRIORITY[relation];

      if (incomingPriority > currentPriority) {
        permission.inheritedRole = relation;

        permission.inheritedFrom = {
          id: inheritedFrom?._id || null,

          name: inheritedFrom?.name || null,

          role: relation,
        };
      }
    }

    const directPriority = permission.directRole
      ? ROLE_PRIORITY[permission.directRole]
      : 0;

    const inheritedPriority = permission.inheritedRole
      ? ROLE_PRIORITY[permission.inheritedRole]
      : 0;

    if (directPriority >= inheritedPriority) {
      permission.role = permission.directRole;

      permission.inherited = false;
    } else {
      permission.role = permission.inheritedRole;

      permission.inherited = true;
    }
  };

  const directPermissions = await resolveObjectPermissions(object);

  for (const { user, relation } of directPermissions) {
    mergePermission({
      user,
      relation,
      source: "direct",
    });
  }

  if (parentDir?._id) {
    const ancestors = await getAncestorDirectories(parentDir);

    for (const ancestor of ancestors) {
      const parentObject = `folder:${ancestor._id}`;

      const inheritedPermissions = await resolveObjectPermissions(parentObject);

      for (const { user, relation } of inheritedPermissions) {
        const inheritedRelation = relation === "owner" ? "writer" : relation;

        mergePermission({
          user,

          relation: inheritedRelation,

          source: "parent",

          inheritedFrom: ancestor,
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

  const isOwner = currentRole === "owner";

  const isWriter = currentRole === "writer" || currentRole === "owner";

  const isReader =
    currentRole === "reader" ||
    currentRole === "writer" ||
    currentRole === "owner";

  let canChangeRole = isOwner || isWriter;

  if (isRootLevelFile && !isOwner) {
    canChangeRole = false;
  }

  if (isPublicEffective && !isOwner && !directRole && !inheritedRole) {
    canChangeRole = false;
  }

  const capabilities = getCapabilities(currentRole);

  capabilities.canChangeRole = canChangeRole;

  if (isPublicEffective && !directRole && !inheritedRole) {
    capabilities.canChangeRole = false;
  }

  if (type === "folder") {
    capabilities.canAddChildren = isWriter;

    capabilities.canRemoveChildren = isWriter;
  }

  const permissionsWithCapabilities = permissions.map((permission) => ({
    ...permission,

    capabilities: getCapabilities(permission.role),

    canChangeRole,
  }));

  if (isPublic) {
    const publicCapabilities = getCapabilities(publicRole);

    publicCapabilities.canChangeRole = false;

    permissionsWithCapabilities.push({
      id: "anyoneWithLink",

      type: "anyone",

      role: publicRole,

      capabilities: publicCapabilities,

      inherited: false,

      inheritedFrom: null,

      canChangeRole: false,
    });
  }

  permissionsWithCapabilities.push({
    id: "superuser",

    role: "superuser",

    type: "superuser",

    capabilities: {
      canRead: true,
      canWrite: true,
      canShare: true,
      canChangeRole: false,
      canRename: true,
      canDownload: true,
      canCopy: true,
      canMove: true,
      canTrash: true,
      canDelete: true,

      ...(type === "folder"
        ? {
            canAddChildren: true,
            canRemoveChildren: true,
          }
        : {
            canAddChildren: false,
            canRemoveChildren: false,
          }),
    },

    canChangeRole: false,
  });

  const ownership = await Ownership.findOne({
    itemId: item?._id,
  }).lean();

  const ownerId = ownership?.toUser ? getIdString(ownership.toUser) : null;

  const updatedPermissions = permissionsWithCapabilities.map((permission) => {
    const permissionId = getIdString(permission.id);

    if (ownership?.status === "pending" && permissionId === ownerId) {
      return {
        ...permission,

        transferStatus: ownership.status,
      };
    }

    return permission;
  });

  const currentUser =
    currentUserPermission || currentRole
      ? {
          role: currentRole,

          directRole,

          inheritedRole,

          inherited:
            currentRole === inheritedRole && inheritedPriority > directPriority,

          inheritedFrom:
            currentRole === inheritedRole && inheritedPriority > directPriority
              ? currentUserPermission?.inheritedFrom || null
              : null,

          publicRole: isPublicEffective ? publicRole : null,

          isPublic: isPublicEffective,

          capabilities,

          canChangeRole,
        }
      : {
          role: null,

          directRole: null,

          inheritedRole: null,

          inherited: false,

          inheritedFrom: null,

          publicRole: null,

          isPublic: false,

          capabilities: {
            canRead: false,
            canWrite: false,
            canShare: false,
            canChangeRole: false,
            canRename: false,
            canDownload: false,
            canCopy: false,
            canMove: false,
            canTrash: false,
            canDelete: false,

            ...(type === "folder"
              ? {
                  canAddChildren: false,
                  canRemoveChildren: false,
                }
              : {
                  canAddChildren: false,
                  canRemoveChildren: false,
                }),
          },

          canChangeRole: false,
        };

  return {
    permissions: updatedPermissions,

    owners,

    capabilities,

    currentUser,

    isRootLevelFile,

    isRootDirectory,
  };
};

export const uploadDriveFileToS3 = async (req, res, next) => {
  const { fileId, driveFileId } = req.body;
  const userId = req.user?._id;
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
      // ✅ check if parent directory is public
      const parentDir = await Directory.findById(file.parentDirId).lean();

      if (!parentDir?.isPublic) {
        // neither file nor parent is public — check FGA
        if (!userId) {
          return res.status(403).json({ message: "Access denied" });
        }

        const canRead = await fgaClient.check({
          user: `user:${userId}`,
          relation: "can_read",
          object: `file:${id}`,
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
    const roles = await resolveRole(file, "file", userId, parentDir);

    // 1. OWNER OR SUPERUSER → always owner
    if (req.user?.role === "superuser" || isOwner) {
      return res.status(200).json({
        ...file,
        owners: roles.owners,
        permissions: roles.permissions,
        capabilities: roles.capabilities,
      });
    }

    // 2. PUBLIC ACCESS CHECK
    const isPublicallyAccessible = parentDir?.isPublic;
    file?.isPublic;

    if (!isPublicallyAccessible) {
      // 3. NOT LOGGED IN + PRIVATE FILE
      if (!userId) {
        return res.status(403).json({
          message: "Access denied",
          requiresAuth: true,
        });
      }

      // 4. ACL CHECK (FGA) — private file, logged-in user
      const [canRead, canWrite] = await Promise.all([
        fgaClient.check({
          user: `user:${userId}`,
          role: "can_read",
          object: `file:${id}`,
        }),
        fgaClient.check({
          user: `user:${userId}`,
          role: "can_write",
          object: `file:${id}`,
        }),
      ]);

      if (!canRead.allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      return res.status(200).json({
        ...file,
        owners: roles.owners,
        permissions: roles.permissions,
      });
    }

    // 5a. Logged-in user — run FGA check so explicit grants are honoured,
    //     fall back to publicRole if FGA has no tuple for this user
    if (userId) {
      const [canRead, canWrite] = await Promise.all([
        fgaClient.check({
          user: `user:${userId}`,
          role: "can_read",
          object: `file:${id}`,
        }),
        fgaClient.check({
          user: `user:${userId}`,
          role: "can_write",
          object: `file:${id}`,
        }),
      ]);

      if (canRead.checked || canWrite.checked) {
        return res.status(200).json({
          ...file,
        });
      }
    }
    file.viewedByMeTime = new Date();
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
      user: `user:${userId.toString()}`,
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
            .populate("userId", "name email avatar")
            .populate("path", "name")
            .lean()
        : [],
    ]);

    const sharedFilesWithRoles = await Promise.all(
      sharedFiles.map(async (file) => {
        const roles = await resolveRole(file, "file", userId);
        return {
          ...file,
          owners: roles.owners,
          permissions: roles.permissions,
          capabilities: roles.capabilities,
        };
      }),
    );

    const ownFilesWithRoles = await Promise.all(
      ownFiles.map(async (file) => {
        const roles = await resolveRole(file, "file", userId);
        return {
          ...file,
          owners: roles.owners,
          permissions: roles.permissions,
          capabilities: roles.capabilities,
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

      // 1. OWNER OR SUPERUSER — always allowed
      if (req.user?.role === "superuser" || isOwner) {
        return await performRename(file, fileId, finalName, res);
      }

      // 2. FGA CHECK
      const canWrite = await fgaClient.check({
        user: `user:${userId}`,
        role: "can_write",
        object: `file:${fileId}`,
      });

      if (canWrite.allowed) {
        return await performRename(file, fileId, finalName, res);
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
        return await performRename(file, fileId, finalName, res);
      }

      // 4. DENY
      return res.status(403).json({
        message: "You don't have permission to rename this file",
      });
    } catch (error) {
      next(error);
    }
  }
};

// ── helper ────────────────────────────────────────────────────────────────────
const performRename = async (file, fileId, fileName, res) => {
  const ext = file.extension;

  file.name = fileName;
  file.extension = ext;
  file.modifiedTime = new Date();
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
      // ✅ owner — soft delete the file
      file.isDeleted = true;
      await file.save();
    } else {
      // ✅ not owner — just remove from their shared view by revoking FGA tuple
      await Promise.allSettled([
        fgaClient.write({
          deleteFile: [
            {
              user: `user:${userId}`,
              role: "reader",
              object: `file:${id}`,
            },
          ],
        }),
        fgaClient.write({
          deletes: [
            {
              user: `user:${userId}`,
              role: "writer",
              object: `file:${id}`,
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

      await fgaClient.write(
        {
          deletes: [
            { user: `user:${userId}`, role: "owner", object: `file:${id}` },
            {
              user: `user:${userId}`,
              relation: "writer",
              object: `file:${id}`,
            },
            {
              user: `user:${userId}`,
              relation: "reader",
              object: `file:${id}`,
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
      // ✅ delete all non-owner FGA tuples
      const object = `${type === "folder" ? "folder" : "file"}:${itemId}`;
      const tuples = await fgaClient.read({ tuple_key: { object } });

      const toDelete = tuples.tuples.filter(
        (t) => t.key.role !== "owner" && t.key.role !== "parent",
      );

      if (toDelete.length) {
        await Promise.allSettled(
          toDelete.map((t) =>
            fgaClient.write({
              deletes: [{ user: t.key.user, role: t.key.role, object }],
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

    return res.status(201).json({
      message: `${type === "file" ? "File" : "Directory"} made ${item.isPublic ? "public" : "private"} successfully`,
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

    // ============================================================
    // GOOGLE DRIVE
    // ============================================================

    if (type === "google") {
      const { drive_access_token } = req.signedCookies;

      if (!drive_access_token) {
        return res.status(401).json({
          message: "Missing token",
        });
      }

      try {
        const drive = getDriveClient(drive_access_token);

        await Promise.all(
          usersArray.map(async (user) => {
            if (!user.role) {
              throw new Error(`Invalid role: ${user.role}`);
            }

            await drive.permissions.create({
              fileId: id,
              requestBody: {
                type: "user",
                role: user.role,
                emailAddress: user.emailAddress || user.email,
              },
              sendNotificationEmail: true,
            });
          }),
        );

        return res.status(200).json({
          message: "Permissions granted successfully!",
        });
      } catch (err) {
        console.error("Google Drive Error:", err.response?.data || err.message);

        return next(err);
      }
    }

    // ============================================================
    // VALIDATE TYPE
    // ============================================================

    if (!["file", "folder"].includes(type)) {
      return res.status(400).json({
        message: "Invalid resource type",
      });
    }

    // ============================================================
    // LOAD ITEM
    // ============================================================

    const Model = type === "folder" ? Directory : File;

    const item = await Model.findById(id)
      .populate("userId", "name email")
      .lean();

    if (!item) {
      return res.status(404).json({
        message: `${type} not found`,
      });
    }

    // ============================================================
    // ROOT DIRECTORY CANNOT BE USED AS PERMISSION SOURCE
    // ============================================================

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

    // ============================================================
    // HELPERS
    // ============================================================

    const getParentId = (resource) => {
      if (!resource) return null;

      return (
        resource.parentDirId ||
        resource.parentDirectoryId ||
        resource.directoryId ||
        resource.folderId ||
        null
      );
    };

    const getObject = (resourceType, resourceId) =>
      `${resourceType}:${resourceId}`;

    const removeDirectRole = async (object, userId) => {
      await Promise.allSettled(
        ["reader", "writer"].map((relation) =>
          fgaClient.write({
            deletes: [
              {
                user: `user:${userId}`,
                relation,
                object,
              },
            ],
          }),
        ),
      );
    };

    const writeRole = async (object, userId, role) => {
      await fgaClient.write(
        {
          writes: [
            {
              user: `user:${userId}`,
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

    /**
     * Find the actual stored permission tuple for this user.
     *
     * IMPORTANT:
     * We do NOT use check() here.
     *
     * check() evaluates inherited permissions.
     * read() tells us whether the permission tuple is physically
     * stored on this object.
     */
    const findDirectPermission = async (object, userId) => {
      const result = await fgaClient.read({
        user: `user:${userId}`,
        object,
      });

      const tuples = result?.tuples || [];

      const tuple = tuples.find(
        (item) =>
          item.key?.user === `user:${userId}` &&
          ["reader", "writer"].includes(item.key?.relation),
      );

      return tuple?.key || null;
    };

    /**
     * Find where the user's permission actually originates.
     *
     * Example:
     *
     * root
     *   └── Folder A   <- writer:user:123
     *        └── Folder B
     *             └── file.txt
     *
     * If file.txt is opened and the user changes
     * Editor -> Viewer, the tuple that must change is:
     *
     *     writer user:123 folder:A
     *
     * NOT:
     *
     *     writer user:123 file.txt
     *
     * This reproduces the "change parent permission" behavior.
     */
    const findPermissionSource = async ({
      resourceType,
      resourceId,
      userId,
    }) => {
      let currentType = resourceType;
      let currentId = resourceId;

      while (currentId) {
        const currentObject = getObject(currentType, currentId);

        // Look only for an actual stored tuple.
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

        // Files live inside a directory.
        // Directories also point to their parent directory.
        const currentModel = currentType === "folder" ? Directory : File;

        const currentResource = await currentModel
          .findById(currentId)
          .select("parentDirId")
          .lean();

        if (!currentResource) {
          break;
        }

        const parentId = getParentId(currentResource);

        if (!parentId) {
          break;
        }

        currentType = "folder";
        currentId = parentId;
      }

      return null;
    };

    // ============================================================
    // PROCESS USERS
    // ============================================================

    await Promise.all(
      usersArray.map(async (user) => {
        if (!user.id) {
          throw new Error("User id is required");
        }

        if (!["reader", "writer"].includes(user.role)) {
          throw new Error(`Invalid role: ${user.role}`);
        }

        const userId = user.id;

        // --------------------------------------------------------
        // FIRST: determine whether the permission is inherited
        // --------------------------------------------------------

        const permissionSource = await findPermissionSource({
          resourceType: type,
          resourceId: id,
          userId,
        });

        let targetObject;
        let previousRole = null;
        let inherited = false;

        if (permissionSource) {
          targetObject = permissionSource.object;
          previousRole = permissionSource.role;
          inherited = !permissionSource.isCurrentObject;
        } else {
          // No direct permission anywhere in the hierarchy.
          // This is a new permission on the requested item.
          targetObject = getObject(type, id);
        }

        // --------------------------------------------------------
        // ROOT PROTECTION
        // --------------------------------------------------------

        if (inherited) {
          const sourceId = permissionSource.id;

          const rootOwner = await User.findOne({
            parentDirId: sourceId,
          })
            .select("_id parentDirId")
            .lean();

          if (rootOwner) {
            return res.status(400).json({
              message:
                "Cannot change an inherited permission from the root directory",
            });
          }
        }

        // --------------------------------------------------------
        // NOTHING TO CHANGE
        // --------------------------------------------------------

        if (previousRole === user.role) {
          return;
        }

        // --------------------------------------------------------
        // REMOVE OLD ROLE FROM THE SOURCE
        // --------------------------------------------------------

        if (previousRole) {
          await fgaClient.write({
            deletes: [
              {
                user: `user:${userId}`,
                relation: previousRole,
                object: targetObject,
              },
            ],
          });
        }

        // --------------------------------------------------------
        // WRITE NEW ROLE TO THE SAME SOURCE
        // --------------------------------------------------------
        //
        // This is the important part.
        //
        // If the file inherited "writer" from Folder A:
        //
        //     writer:user:123 -> folder:A
        //
        // changing Editor -> Viewer becomes:
        //
        //     reader:user:123 -> folder:A
        //
        // The file itself is NOT given an overriding permission.
        //
        // Therefore every child of Folder A immediately resolves
        // the new role.
        // --------------------------------------------------------

        await writeRole(targetObject, userId, user.role);

        // --------------------------------------------------------
        // SEND EMAIL ONLY FOR NEW ACCESS
        // --------------------------------------------------------

        if (!permissionSource) {
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

        console.log("Permission changed:", {
          userId,
          requestedObject: getObject(type, id),
          targetObject,
          previousRole,
          newRole: user.role,
          inherited,
        });
      }),
    );

    // ============================================================
    // RESPONSE
    // ============================================================

    return res.status(200).json({
      message: `${type} access updated successfully`,
    });
  } catch (error) {
    console.error("giveAccessById error:", error);
    next(error);
  }
};

export const revokeFileAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetId: userId, type, relation } = req.body;

    if (type !== "google" && !userId) {
      return res.status(400).json({
        message: "Target user is required",
      });
    }

    if (type === "google") {
      const { drive_access_token } = req.signedCookies;

      if (!drive_access_token) {
        return res.status(401).json({
          message: "Missing token",
        });
      }

      try {
        const drive = getDriveClient(drive_access_token);

        const permissions = await drive.permissions.list({
          fileId: id,
          fields: "permissions(id,type)",
        });

        const publicPermission = permissions.data.permissions.find(
          (permission) => permission.type === "anyone",
        );

        if (!publicPermission) {
          return res.status(200).json({
            message: "Permission already revoked",
          });
        }

        await drive.permissions.delete({
          fileId: id,
          permissionId: publicPermission.id,
        });

        return res.status(200).json({
          message: "Permission revoked successfully",
        });
      } catch (error) {
        return next(error);
      }
    }

    const objectType = type === "folder" ? "folder" : "file";
    const object = `${objectType}:${id}`;

    const Model = type === "folder" ? Directory : File;

    const item = await Model.findById(id).select("_id").lean();

    if (!item) {
      return res.status(404).json({
        message: "Item not found",
      });
    }

    const allowedRelations =
      relation === "remove" ? ["reader", "writer"] : [relation];

    const existing = await fgaClient.read({
      tuple_key: {
        user: `user:${userId}`,
        object,
      },
    });

    const deletes = existing.tuples
      .filter(
        (tuple) =>
          tuple.key.user === `user:${userId}` &&
          tuple.key.object === object &&
          allowedRelations.includes(tuple.key.relation),
      )
      .map((tuple) => ({
        user: tuple.key.user,
        relation: tuple.key.relation,
        object: tuple.key.object,
      }));

    // Already removed
    if (!deletes.length) {
      return res.status(200).json({
        message: "Access already revoked",
      });
    }

    await fgaClient.write({
      deletes,
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

    const object = `${type === "folder" ? "folder" : "file"}:${id}`;

    // ── read all pages ──────────────────────────────────────────
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
    // ────────────────────────────────────────────────────────────

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

    // Get current file permissions
    const permissions = await drive.permissions.list({
      fileId,
      fields: "permissions(id,type,role,allowFileDiscovery)",
    });

    const publicPermission = permissions.data.permissions.find(
      (p) => p.type === "anyone",
    );

    // Check parent folder
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
      // Update existing anyone permission
      response = await drive.permissions.update({
        fileId,
        permissionId: publicPermission.id,
        requestBody: {
          role,
        },
        fields: "id,type,role,emailAddress,allowFileDiscovery",
      });
    } else {
      // File is restricted. Create a new anyone permission.
      response = await drive.permissions.create({
        fileId,
        requestBody: {
          type: "anyone",
          role,
          allowFileDiscovery: false, // "Anyone with the link"
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

  if (!id) {
    return res.status(400).json({ message: "File Id is required!" });
  }
  try {
    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }
    file.viewedByMeTime = Date.now();
    await file.save();
    return res.status(200).json({ message: "View record updated!" });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
