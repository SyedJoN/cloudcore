import Directory from "../models/directory.model.js";
export const updateParentDirSize = async (parentDirId, deltaSize) => {
  let parentDirIdsArray = [];
  while (parentDirId) {
    const parentDir = await Directory.findById(parentDirId, "parentDirId");
    if (!parentDir) break;
    parentDirIdsArray.push(parentDir._id);
    parentDirId = parentDir.parentDirId;
  }
  if (parentDirIdsArray.length > 0) {

  
   await Directory.updateMany(
  { _id: { $in: parentDirIdsArray } },
  [
    {
      $set: {
        size: {
          $max: [
            0,
            { $add: ["$size", deltaSize] }
          ]
        }
      }
    }
  ],
  { updatePipeline: true }
)
  }
};