
import Directory from "../models/directory.model.js";
import File from "../models/file.model.js";
import Ownership from "../models/ownership.model.js";
import { fgaClient } from "../services/openFGAService.js";

export const getOwnershipModel = (itemType) => {
  return itemType === "Directory" ? Directory : File;
};

export const getOwnershipObject = (itemType, itemId) => {
  return `${itemType === "Directory" ? "folder" : "file"}:${itemId}`;
};

export const getOwnerRoots = async (oldOwnerId, newOwnerId) => {
  const [currentOwnerRootDir, newOwnerRootDir] =
    await Promise.all([
      Directory.findOne({
        userId: oldOwnerId,
        parentDirId: null,
      }),

      Directory.findOne({
        userId: newOwnerId,
        parentDirId: null,
      }),
    ]);

  if (!currentOwnerRootDir || !newOwnerRootDir) {
    throw new Error("Owner root directory not found");
  }

  return {
    currentOwnerRootDir,
    newOwnerRootDir,
  };
};

export const transferFgaOwnership = async ({
  itemType,
  itemId,
  oldOwnerId,
  newOwnerId,
}) => {
  const object = getOwnershipObject(itemType, itemId);

  await fgaClient.write(
    {
      writes: [
   
        {
          user: `user:${newOwnerId}`,
          relation: "owner",
          object,
        },

      
        {
          user: `user:${oldOwnerId}`,
          relation: "writer",
          object,
        },
      ],

      deletes: [
       
        {
          user: `user:${oldOwnerId}`,
          relation: "owner",
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

export const updateOwnerStorage = async ({
  oldRootId,
  newRootId,
  size,
}) => {
  await Promise.all([
    Directory.updateOne(
      { _id: oldRootId },
      {
        $inc: {
          size: -size,
        },
      },
    ),

    Directory.updateOne(
      { _id: newRootId },
      {
        $inc: {
          size,
        },
      },
    ),
  ]);
};

export const updateResourceOwnership = async ({
  item,
  newOwnerId,
  newOwnerRootId,
}) => {
  const newPath = [
    newOwnerRootId,
    item._id,
  ];

  item.userId = newOwnerId;
  item.parentDirId = newOwnerRootId;
  item.path = newPath;

  await item.save();

  return newPath;
};

export const updateDirectoryChildren = async ({
  directoryId,
  newOwnerId,
  newDirectoryPath,
}) => {
  const [childDirectories, childFiles] =
    await Promise.all([
      Directory.find({
        path: directoryId,
        _id: { $ne: directoryId },
      }),

      File.find({
        path: directoryId,
      }),
    ]);


  // CHILD DIRECTORIES

  if (childDirectories.length) {
    const directoryUpdates = childDirectories
      .map((directory) => {
        const path = directory.path.map(String);

        const index = path.indexOf(
          String(directoryId),
        );

        if (index === -1) {
          return null;
        }

        const relativePath = path.slice(index + 1);

        return {
          updateOne: {
            filter: {
              _id: directory._id,
            },
            update: {
              $set: {
                userId: newOwnerId,
                path: [
                  ...newDirectoryPath,
                  ...relativePath,
                ],
              },
            },
          },
        };
      })
      .filter(Boolean);

    if (directoryUpdates.length) {
      await Directory.bulkWrite(directoryUpdates);
    }
  }

  // CHILD FILES
  
  if (childFiles.length) {
    const fileUpdates = childFiles
      .map((file) => {
        const path = file.path.map(String);

        const index = path.indexOf(
          String(directoryId),
        );

        if (index === -1) {
          return null;
        }

        const relativePath = path.slice(index + 1);

        return {
          updateOne: {
            filter: {
              _id: file._id,
            },
            update: {
              $set: {
                userId: newOwnerId,
                path: [
                  ...newDirectoryPath,
                  ...relativePath,
                ],
              },
            },
          },
        };
      })
      .filter(Boolean);

    if (fileUpdates.length) {
      await File.bulkWrite(fileUpdates);
    }
  }
};

export const updateOwnershipStatus = async (
  ownership,
  status,
) => {
  ownership.status = status;
  await ownership.save();
};