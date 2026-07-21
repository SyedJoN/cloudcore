import { rm } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Directory from "../models/directory.model.js";
import File from "../models/file.model.js";
import { fgaClient } from "../services/openFGAService.js";
import { ClientWriteRequestOnMissingDeletes } from "@openfga/sdk";
import {
  sendLinkEmail,
  sendRequestAccessEmail,
} from "../services/sendMailService.js";
import User from "../models/user.model.js";
import { sanitizeText } from "../utils/sanitizeText.js";
import { updateParentDirSize } from "../utils/updateDirSize.js";
import { formatSize } from "../utils/formatSize.js";
import { getDirectoryPath } from "../utils/updatePath.js";
import { deleteFile } from "../services/s3/delete.js";
import { deleteFileArray } from "../services/s3/deleteArray.js";

const __filename = fileURLToPath(import.meta.url);

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

    if (parentDir.isPublic) {
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

      if (userId && parentDir.userId.toString() !== userId.toString()) {
        const relation = parentDir.publicRole || "viewer";
        Promise.allSettled([
          fgaClient.write({
            writes: {
              tuple_keys: [
                {
                  user: `user:${userId}`,
                  relation,
                  object: `folder:${parentDir._id}`,
                },
              ],
              on_duplicate: "skip",
            },
          }),
        ]);
      }

      const { files: _, directories: __, ...parentDirData } = parentDir;

      const resolveRole = async (item, type) => {
        if (!userId) return parentDir.publicRole || "viewer";
        if (item.userId?._id?.toString() === userId.toString()) return "owner";
        const canEdit = await fgaClient.check({
          user: `user:${userId}`,
          relation: "can_edit",
          object: `${type}:${item._id}`,
        });
        return canEdit.allowed ? "editor" : parentDir.publicRole || "viewer";
      };

      const [filesWithRoles, directoriesWithRoles] = await Promise.all([
        Promise.all(
          files.map(async (f) => ({
            ...f,
            userRole: await resolveRole(f, "file"),
          })),
        ),
        Promise.all(
          directories.map(async (d) => ({
            ...d,
            userRole: await resolveRole(d, "folder"),
          })),
        ),
      ]);
      const parentDirWithRole = {
        ...parentDirData,
        userRole:
          userId && parentDir.userId.toString() === userId.toString()
            ? "owner"
            : undefined,
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

    // ✅ check if user can view this currentDirectory
    const canView = await fgaClient.check({
      user: `user:${userId}`,
      relation: "can_view",
      object: `folder:${parentDir._id}`,
    });

    if (!canView.allowed)
      return res.status(403).json({
        message: "Access denied",
        requiresAuth: false,
        name: parentDir.name,
      });

    const [allowedFiles, allowedFolders] = await Promise.all([
      fgaClient.listObjects({
        user: `user:${userId}`,
        relation: "can_view",
        type: "file",
      }),
      fgaClient.listObjects({
        user: `user:${userId}`,
        relation: "can_view",
        type: "folder",
      }),
    ]);

    const allowedFilesIds = allowedFiles.objects
      .map((o) => o.split(":")[1])
      .filter(Boolean);
    const allowedFolderIds = allowedFolders.objects
      .map((o) => o.split(":")[1])
      .filter(Boolean);

    const [files, directories] = await Promise.all([
      File.find({
        _id: { $in: allowedFilesIds },
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
        const [isOwner, canEdit] = await Promise.all([
          fgaClient.check({
            user: `user:${userId}`,
            relation: "owner",
            object: `file:${file._id}`,
          }),
          fgaClient.check({
            user: `user:${userId}`,
            relation: "can_edit",
            object: `file:${file._id}`,
          }),
        ]);
        return {
          ...file,
          userRole: isOwner.allowed
            ? "owner"
            : canEdit.allowed
              ? "editor"
              : "viewer",
        };
      }),
    );

    const directoriesWithRoles = await Promise.all(
      directories.map(async (dir) => {
        const [isOwner, canEdit] = await Promise.all([
          fgaClient.check({
            user: `user:${userId}`,
            relation: "owner",
            object: `folder:${dir._id}`,
          }),
          fgaClient.check({
            user: `user:${userId}`,
            relation: "can_edit",
            object: `folder:${dir._id}`,
          }),
        ]);
        return {
          ...dir,
          userRole: isOwner.allowed
            ? "owner"
            : canEdit.allowed
              ? "editor"
              : "viewer",
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
      // ✅ inside a deleted currentDirectory — show its undeleted children
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

    // ✅ trash currentDirectory — show only top level deleted items
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

    return res
      .status(200)
      .json({ ...parentDir, files: topLevelFiles, directories: topLevelDirs });
  } catch (error) {
    next(error);
  }
};

export const getSharedWithMe = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(403).json({ message: "Access denied" });

    const [allowedFiles, allowedFolders] = await Promise.all([
      fgaClient.listObjects({
        user: `user:${userId.toString()}`,
        relation: "can_view",
        type: "file",
      }),
      fgaClient.listObjects({
        user: `user:${userId.toString()}`,
        relation: "can_view",
        type: "folder",
      }),
    ]);

    const allowedFilesIds = allowedFiles.objects
      .map((obj) => obj.split(":")[1])
      .filter(Boolean);

    const allowedFolderIds = allowedFolders.objects
      .map((obj) => obj.split(":")[1])
      .filter(Boolean);

    const [files, directories] = await Promise.all([
      allowedFilesIds.length
        ? File.find({
            _id: { $in: allowedFilesIds },
            userId: { $ne: userId },
          })
            .populate("userId", "name email avatar")
            .populate("path", "name")
            .lean()
        : [],
      allowedFolderIds.length
        ? Directory.find({
            _id: { $in: allowedFolderIds },
            userId: { $ne: userId },
          })
            .populate("userId", "name email avatar")
            .populate("path", "name")
            .lean()
        : [],
    ]);

    // ✅ only show top-level shared items, not children of shared folders
    const topLevelFiles = files.filter(
      (file) => !allowedFolderIds.includes(file.parentDirId?.toString()),
    );

    const topLevelDirs = directories.filter(
      (dir) => !allowedFolderIds.includes(dir.parentDirId.toString()),
    );

    const filesWithRoles = await Promise.all(
      topLevelFiles.map(async (file) => {
        const canEdit = await fgaClient.check({
          user: `user:${userId.toString()}`,
          relation: "can_edit",
          object: `file:${file._id.toString()}`,
        });
        return { ...file, userRole: canEdit.allowed ? "editor" : "viewer" };
      }),
    );

    const directoriesWithRoles = await Promise.all(
      topLevelDirs.map(async (dir) => {
        const canEdit = await fgaClient.check({
          user: `user:${userId.toString()}`,
          relation: "can_edit",
          object: `folder:${dir._id.toString()}`,
        });
        return { ...dir, userRole: canEdit.allowed ? "editor" : "viewer" };
      }),
    );

    return res
      .status(200)
      .json({ files: filesWithRoles, directories: directoriesWithRoles });
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
      const canEdit = await fgaClient.check({
        user: `user:${userId}`,
        relation: "can_edit",
        object: `folder:${parentDirId}`,
      });
      if (!canEdit.allowed)
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
          user: `user:${userId.toString()}`,
          relation: "owner",
          object: `folder:${addedDirectory._id.toString()}`,
        },
        {
          user: `folder:${parentDirId.toString()}`,
          relation: "parentDir",
          object: `folder:${addedDirectory._id.toString()}`,
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
    relation: "can_edit",
    object: `folder:${id}`,
  });
  if (!isEditor) {
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

    if (!isOwner) {
      const queue = [id];
      const allFolderIds = [id];
      const allFileIds = [];

      while (queue.length) {
        const currentId = queue.shift();
        const [childDirs, childFiles] = await Promise.all([
          Directory.find({ parentDirId: currentId }).select("_id").lean(),
          File.find({ parentDirId: currentId }).select("_id").lean(),
        ]);
        childDirs.forEach((d) => {
          allFolderIds.push(d._id);
          queue.push(d._id);
        });
        childFiles.forEach((f) => allFileIds.push(f._id));
      }

      await Promise.allSettled([
        ...allFolderIds.flatMap((folderId) => [
          fgaClient.write({
            deletes: [
              {
                user: `user:${userId}`,
                relation: "viewer",
                object: `folder:${folderId}`,
              },
            ],
          }),
          fgaClient.write({
            deletes: [
              {
                user: `user:${userId}`,
                relation: "editor",
                object: `folder:${folderId}`,
              },
            ],
          }),
        ]),
        ...allFileIds.flatMap((fileId) => [
          fgaClient.write({
            deletes: [
              {
                user: `user:${userId}`,
                relation: "viewer",
                object: `file:${fileId}`,
              },
            ],
          }),
          fgaClient.write({
            deletes: [
              {
                user: `user:${userId}`,
                relation: "editor",
                object: `file:${fileId}`,
              },
            ],
          }),
        ]),
      ]);

      return res
        .status(200)
        .json({ message: "Folder removed from shared view" });
    }
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

    // Build FGA deletes
    const deletes = [
      // file tuples
      ...files.flatMap((f) => [
        { user: `user:${userId}`, relation: "owner", object: `file:${f._id}` },
        { user: `user:${userId}`, relation: "editor", object: `file:${f._id}` },
        { user: `user:${userId}`, relation: "viewer", object: `file:${f._id}` },
        {
          user: `folder:${f.parentDirId}`,
          relation: "parentDir",
          object: `file:${f._id}`,
        },
      ]),
      // folder tuples
      ...allDirIds.flatMap((dir) => [
        {
          user: `user:${userId}`,
          relation: "owner",
          object: `folder:${dir._id}`,
        },
        {
          user: `folder:${dir.parentDirId}`,
          relation: "parentDir",
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
    const { id } = req.params;
    const { toEmail, message, type } = req.body;
    const userId = req.user._id;

    const item =
      type === "folder"
        ? await Directory.findById(id).lean()
        : await File.findById(id).lean();

    const sender = await User.findById(userId).select("name email").lean();
    const cleanMessage = sanitizeText(message || "");

    await sendLinkEmail({
      toEmail,
      fromName: sender.name,
      fromEmail: sender.email,
      itemName: item.name,
      itemType: type,
      itemUrl: `${process.env.CLIENT_URL}/${type === "folder" ? "currentDirectory" : "file"}/${id}`,
      isPublic: item.isPublic,
      publicRole: item.publicRole,
      cleanMessage,
    });

    return res.status(200).json({ message: "Link sent" });
  } catch (error) {
    next(error);
  }
};
