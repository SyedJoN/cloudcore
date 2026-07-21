import mongoose from "mongoose";
import Directory from "../models/directory.model.js";

export const getDirectoryPath = async (parentDirId) => {
  const result = await Directory.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(parentDirId) } },
    {
      $graphLookup: {
        from: "directories",
        startWith: "$parentDirId",
        connectFromField: "parentDirId",
        connectToField: "_id",
        as: "ancestors",
        depthField: "depth",
      },
    },
    { $project: { ancestors: 1, _id: 1 } },
  ]);

  if (!result.length) return [];

  const { _id, ancestors } = result[0];

  // sort by depth descending = root first, then append self
  const sorted = ancestors
    .sort((a, b) => b.depth - a.depth)
    .map((a) => a._id);

  return [...sorted, _id];
};