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

export const generateSignedUploadUrl = async (req, res, next) => {
  const { name, size, contentType } = req.body;

  const parentDirId = req.body.parentDirId || req.user.parentDirId;
  const userId = req.user._id;
  const totalStorage = req.user.totalStorage;
  const uploadLimit = req.user.uploadLimit;

  const fileName = sanitizeFilename(name) || "untitled";
  const fileExt = path.extname(fileName);
  const fileType = contentType || "application/octet-stream";
  const fileSize = Number(size || 0);

  let responded;
  let uploadedFile;

  const safeResponse = async (status, payload) => {
    if (responded) return;
    responded = true;
    return res.status(status).json(payload);
  };
  try {
    if (!fileExt.trim()) {
      return safeResponse(400, {
        message: "File without extension is not allowed!",
      });
    }
    if (!fileSize || fileSize > uploadLimit) {
      return res.status(413).json({
        message: "File too large",
      });
    }
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

if (!subscription || subscription.status !== "active") {
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
      extension: fileExt,
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
            relation: "parentDir",
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
    const file = await File.findById(id).lean();
    if (!file) return res.status(404).json({ message: "File not found" });

    if (!file.isPublic && req.user?.role !== "superuser") {
      // ✅ check if parent directory is public
      const parentDir = await Directory.findById(file.parentDirId).lean();

      if (!parentDir?.isPublic) {
        // neither file nor parent is public — check FGA
        if (!userId) {
          return res.status(403).json({ message: "Access denied" });
        }

        const canView = await fgaClient.check({
          user: `user:${userId}`,
          relation: "can_view",
          object: `file:${id}`,
        });

        if (!canView.allowed) {
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

    // 1. OWNER OR SUPERUSER → always owner
    if (req.user?.role === "superuser" || isOwner) {
      return res.status(200).json({
        ...file,
        userRole: "owner",
      });
    }

    // 2. PUBLIC ACCESS CHECK
    const isAccessible = file.isPublic || parentDir?.isPublic;

    if (!isAccessible) {
      // 3. NOT LOGGED IN + PRIVATE FILE
      if (!userId) {
        return res.status(403).json({
          message: "Access denied",
          requiresAuth: true,
        });
      }

      // 4. ACL CHECK (FGA) — private file, logged-in user
      const [canView, canEdit] = await Promise.all([
        fgaClient.check({
          user: `user:${userId}`,
          relation: "can_view",
          object: `file:${id}`,
        }),
        fgaClient.check({
          user: `user:${userId}`,
          relation: "can_edit",
          object: `file:${id}`,
        }),
      ]);

      if (!canView.allowed) {
        return res.status(403).json({ message: "Access denied" });
      }

      return res.status(200).json({
        ...file,
        userRole: canEdit.allowed ? "editor" : "viewer",
      });
    }

    // 5. PUBLIC FILE / FOLDER — determine effective role
    const publicRole = file.isPublic
      ? file.publicRole || "viewer"
      : parentDir?.publicRole || "viewer";

    // 5a. Logged-in user — run FGA check so explicit grants are honoured,
    //     fall back to publicRole if FGA has no tuple for this user
    if (userId) {
      const [canView, canEdit] = await Promise.all([
        fgaClient.check({
          user: `user:${userId}`,
          relation: "can_view",
          object: `file:${id}`,
        }),
        fgaClient.check({
          user: `user:${userId}`,
          relation: "can_edit",
          object: `file:${id}`,
        }),
      ]);

      // Derive role from FGA result; fall back to publicRole if no FGA tuple exists
      const fgaRole = canEdit.allowed
        ? "editor"
        : canView.allowed
          ? "viewer"
          : null;

      return res.status(200).json({
        ...file,
        userRole: fgaRole || publicRole,
      });
    }

    // 5b. Anonymous user — honour publicRole directly
    return res.status(200).json({
      ...file,
      userRole: publicRole,
    });
  } catch (error) {
    next(error);
  }
};
export const updateFile = async (req, res, next) => {
  const { id: fileId } = req.params;
  const { fileName } = req.body;
  if (!fileName || typeof fileName !== "string") {
    return res.status(400).json({ message: "Filename is required" });
  }
  const userId = req.user._id;

  if (!fileName) {
    return res.status(400).json({ message: "Filename is required" });
  }

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
    const canEdit = await fgaClient.check({
      user: `user:${userId}`,
      relation: "can_edit",
      object: `file:${fileId}`,
    });

    if (canEdit.allowed) {
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
};

// ── helper ────────────────────────────────────────────────────────────────────
const performRename = async (file, fileId, fileName, res) => {
  console.log("fileName", fileName);
  const ext = file.extension;

  file.name = fileName;
  file.extension = ext;

  await file.save();

  return res.status(200).json({ message: "File renamed successfully" });
};

export const softDeleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const file = await File.findOne({ _id: id, isDeleted: false });
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
              relation: "viewer",
              object: `file:${id}`,
            },
          ],
        }),
        fgaClient.write({
          deletes: [
            {
              user: `user:${userId}`,
              relation: "editor",
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
  const { id } = req.params;
  const userId = req.user._id;
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
          { user: `user:${userId}`, relation: "owner", object: `file:${id}` },
          { user: `user:${userId}`, relation: "editor", object: `file:${id}` },
          { user: `user:${userId}`, relation: "viewer", object: `file:${id}` },
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
};
export const restoreFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
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
        (t) => t.key.relation !== "owner" && t.key.relation !== "parentDir",
      );

      if (toDelete.length) {
        await Promise.allSettled(
          toDelete.map((t) =>
            fgaClient.write({
              deletes: [{ user: t.key.user, relation: t.key.relation, object }],
            }),
          ),
        );
      }

      item.isPublic = false;
      item.publicRole = undefined; // ✅ remove publicRole
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

    if (!usersArray?.length) {
      return res.status(400).json({ message: "No users provided" });
    }

    // ✅ prevent sharing root directory
    if (type === "folder") {
      const folder = await Directory.findById(id).lean();
      if (!folder) return res.status(404).json({ message: "Folder not found" });

      const user = await User.findById(folder.userId).lean();
      if (user && folder._id.toString() === user.parentDirId.toString()) {
        return res
          .status(400)
          .json({ message: "Root directory cannot be shared" });
      }
    }

    const object = `${type}:${id}`;

    const item =
      type === "folder"
        ? await Directory.findById(id).populate("userId", "name email").lean()
        : await File.findById(id).populate("userId", "name email").lean();

    await Promise.all(
      usersArray.map(async (user) => {
        // check if user already has access
        const existing = await fgaClient.check({
          user: `user:${user.id}`,
          relation: "can_view",
          object,
        });

        await Promise.allSettled(
          ["viewer", "editor"].map((relation) =>
            fgaClient.write({
              deletes: [{ user: `user:${user.id}`, relation, object }],
            }),
          ),
        );

        await fgaClient.write({
          writes: [
            { user: `user:${user.id}`, relation: user.relation, object },
          ],
        });
        if (!existing.allowed) {
          const userData = await User.findById(user.id)
            .select("name email avatar")
            .lean();
          await sendAccessEmail({
            toEmail: userData.email,
            toName: userData.name,
            fromName: item.userId.name,
            fromEmail: item.userId.email,
            itemName: item.name,
            itemType: type,
            itemUrl: `${process.env.CLIENT_URL}/${type === "folder" ? "directory" : "file"}/${id}`,
            role: user.relation,
            message,
          });
        }
      }),
    );

    return res
      .status(200)
      .json({ message: `${type} access granted successfully` });
  } catch (error) {
    next(error);
  }
};
export const revokeFileAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, type } = req.body;

    const item =
      type === "folder"
        ? await Directory.findById(id).select("parentDirId userId").lean()
        : await File.findById(id).select("parentDirId userId").lean();

    if (!item) return res.status(404).json({ message: "Item not found" });

    const parentId = item.parentDirId?.toString();
    const relations = ["viewer", "editor"];

    const deleteTargets = [
      // delete from item itself
      ...relations.map((relation) => ({
        user: `user:${userId}`,
        relation,
        object: `${type === "folder" ? "folder" : "file"}:${id}`,
      })),
      // delete from parent folder
      ...(parentId
        ? relations.map((relation) => ({
            user: `user:${userId}`,
            relation,
            object: `folder:${parentId}`,
          }))
        : []),
    ];

    // ✅ if revoking a folder, also delete tuples from all files/subdirs inside
    if (type === "folder") {
      const [childFiles, childDirs] = await Promise.all([
        File.find({ parentDirId: id }).select("_id").lean(),
        Directory.find({ parentDirId: id }).select("_id").lean(),
      ]);

      childFiles.forEach((f) => {
        relations.forEach((relation) => {
          deleteTargets.push({
            user: `user:${userId}`,
            relation,
            object: `file:${f._id}`,
          });
        });
      });

      childDirs.forEach((d) => {
        relations.forEach((relation) => {
          deleteTargets.push({
            user: `user:${userId}`,
            relation,
            object: `folder:${d._id}`,
          });
        });
      });
    }

    await Promise.allSettled(
      deleteTargets.map((tuple) => fgaClient.write({ deletes: [tuple] })),
    );

    return res.status(200).json({ message: "Access revoked successfully" });
  } catch (error) {
    next(error);
  }
};
export const fetchItemPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type = "file" } = req.query;

    if (!id) return res.status(404).json({ message: "Id missing" });

    const object = `${type === "folder" ? "folder" : "file"}:${id}`;

    const tuples = await fgaClient.read({ tuple_key: { object } });

    const collaborators = tuples.tuples
      .filter(
        (t) =>
          t.key.object === object && // ✅ manual filter since fgaClient.read ignores object filter
          t.key.user.startsWith("user:") &&
          (t.key.relation === "viewer" || t.key.relation === "editor"),
      )
      .map((t) => ({
        userId: t.key.user.split(":")[1],
        relation: t.key.relation,
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
      const collab = collaborators.find(
        (c) => c.userId === user._id.toString(),
      );
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        relation: collab?.relation,
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
          from: "files", // collection name (lowercase plural of File model)
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
