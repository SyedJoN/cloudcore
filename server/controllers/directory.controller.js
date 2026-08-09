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

const resolveRole = async (item, type, userId, parentDir) => {
  const ROLE_PRIORITY = {
    reader: 1,
    writer: 2,
    owner: 3,
  };

  const object = `${type === "folder" ? "folder" : "file"}:${item._id}`;

  const getTuples = async (object) => {
    let allTuples = [];
    let continuationToken;

    do {
      const response = await fgaClient.read(
        {
          tuple_key: {
            object,
          },
        },
        continuationToken
          ? {
              continuationToken,
            }
          : undefined,
      );

      allTuples = allTuples.concat(response.tuples || []);
      continuationToken = response.continuation_token;
    } while (continuationToken);

    return allTuples;
  };

  const getCollaborators = (tuples, object) => {
    return tuples
      .filter(
        (t) =>
          t.key.object === object &&
          t.key.user?.startsWith("user:") &&
          ["owner", "reader", "writer"].includes(t.key.relation),
      )
      .map((t) => ({
        userId: t.key.user.split(":")[1],
        relation: t.key.relation,
      }));
  };

  const getUsers = async (collaborators) => {
    if (!collaborators.length) return [];

    return User.find({
      _id: {
        $in: collaborators.map((c) => c.userId),
      },
    })
      .select("name email avatar")
      .lean();
  };


  const mergePermission = (permissionMap, user, relation) => {
    if (!user?._id || !ROLE_PRIORITY[relation]) return;

    const userId = user._id.toString();
    const existing = permissionMap.get(userId);

    if (!existing) {
      permissionMap.set(userId, {
        id: user._id,
        photoLink: user.avatar,
        displayName: user.name,
        type: "user",
        emailAddress: user.email,
        role: relation,
      });

      return;
    }

    const existingPriority = ROLE_PRIORITY[existing.role] || 0;
    const incomingPriority = ROLE_PRIORITY[relation] || 0;

    if (incomingPriority > existingPriority) {
      existing.role = relation;
    }
  };

  const resolveObjectPermissions = async (object) => {
    const tuples = await getTuples(object);
    const collaborators = getCollaborators(tuples, object);
    const users = await getUsers(collaborators);

    const collaboratorMap = new Map(
      collaborators.map((c) => [c.userId, c.relation]),
    );

    return users.map((user) => ({
      user,
      relation: collaboratorMap.get(user._id.toString()),
    }));
  };

  const getAncestorDirectories = async (directory) => {
    const ancestors = [];

    let current = directory;

    while (current?._id) {
      ancestors.push(current);


      if (!current.parentId) {
        break;
      }

      current = await Folder.findById(current.parentId)
        .select("_id parentId isPublic publicRole")
        .lean();
    }

    return ancestors;
  };

  const permissionMap = new Map();

  const directPermissions = await resolveObjectPermissions(object);

  for (const { user, relation } of directPermissions) {
    mergePermission(permissionMap, user, relation);
  }
  if (parentDir?._id) {
    const ancestors = await getAncestorDirectories(parentDir);

    for (const ancestor of ancestors) {
      const parentObject = `folder:${ancestor._id}`;

      const inheritedPermissions =
        await resolveObjectPermissions(parentObject);

      for (const { user, relation } of inheritedPermissions) {
        mergePermission(permissionMap, user, relation);
      }
    }
  }

  const permissions = Array.from(permissionMap.values());


  const owners = permissions
    .filter((permission) => permission.role === "owner")
    .map((permission) => ({
      displayName: permission.displayName,
      kind: "drive#user",
      me:
        permission.id?.toString() ===
        userId?.toString(),
      permissionId: permission.id,
      emailAddress: permission.emailAddress,
      photoLink: permission.photoLink,
    }));

  const isPublic = Boolean(
    item.isPublic || parentDir?.isPublic,
  );

  let publicRole;

  if (item.isPublic) {
    publicRole = item.publicRole;
  } else if (parentDir?.isPublic) {
    publicRole = parentDir.publicRole;
  }

  if (isPublic) {
    permissions.push({
      id: "anyoneWithLink",
      type: "anyone",
      role: publicRole || "reader",
    });
  }


  permissions.push({
    id: "superuser",
    role: "superuser",
    type: "superuser",
  });

  return {
    permissions,
    owners,
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
            const roles = await resolveRole(f, "file", userId, parentDir);
            return {
              ...f,
              owners: roles.owners,
              permissions: roles.permissions,
            };
          }),
        ),
        Promise.all(
          directories.map(async (d) => {
            const roles = await resolveRole(d, "folder", userId, parentDir);
            return {
              ...d,
              owners: roles.owners,
              permissions: roles.permissions,
            };
          }),
        ),
      ]);
      const { owners, permissions } = await resolveRole(
        parentDir,
        "folder",
        userId,
        parentDir,
      );
      const parentDirWithRole = {
        ...parentDirData,
        owners,
        permissions,
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
        const roles = await resolveRole(file, "file", userId, parentDir);
        return {
          ...file,
          owners: roles.owners,
          permissions: roles.permissions,
        };
      }),
    );

    const directoriesWithRoles = await Promise.all(
      directories.map(async (dir) => {
        const roles = await resolveRole(dir, "folder", userId, parentDir);
        return {
          ...dir,
          owners: roles.owners,
          permissions: roles.permissions,
        };
      }),
    );
    const { owners, permissions } = await resolveRole(
      parentDir,
      "folder",
      userId,
      parentDir,
    );
    return res.status(200).json({
      ...parentDir,
      owners,
      permissions,
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

    const [allowedFileIds, allowedFolderIds] = await Promise.all([
      listObjects(userId, "file"),
      listObjects(userId, "folder"),
    ]);

    const [files, directories] = await Promise.all([
      allowedFileIds.length
        ? File.find({
            _id: { $in: allowedFileIds },
            userId: { $ne: userId },
          })
            .populate("parentDirId")
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

    // only show top-level shared items, not children of shared folders
    const topLevelFiles = files.filter(
      (file) => !allowedFolderIds.includes(file.parentDirId?.toString()),
    );

    const topLevelDirs = directories.filter(
      (dir) => !allowedFolderIds.includes(dir.parentDirId.toString()),
    );

    const filesWithRoles = await Promise.all(
      topLevelFiles.map(async (file) => {
        const roles = await resolveRole(file, "file", userId, file.parentDirId);
        return {
          ...file,
          owners: roles.owners,
          permissions: roles.permissions,
        };
      }),
    );

    const directoriesWithRoles = await Promise.all(
      topLevelDirs.map(async (dir) => {
        const roles = await resolveRole(dir, "folder", userId);
        return {
          ...dir,
          owners: roles.owners,
          permissions: roles.permissions,
        };
      }),
    );

    return res
      .status(200)
      .json({ files: filesWithRoles, directories: directoriesWithRoles });
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
      topLevelSharedFiles.map(async (file) =>
        resolveRole(file, "file", userId),
      ),
    );

    const sharedDirectoriesWithRoles = await Promise.all(
      topLevelSharedDirs.map(async (dir) => resolveRole(dir, "folder", userId)),
    );

    const filesWithRoles = await Promise.all(
      files.map(async (file) => resolveRole(file, "file", userId)),
    );

    const directoriesWithRoles = await Promise.all(
      directories.map(async (dir) => resolveRole(dir, "folder", userId)),
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
      
      console.log('toEmail', cleanMessage)
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
