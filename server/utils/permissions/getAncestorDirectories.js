import Directory from "../../models/directory.model.js";
import { getIdString } from "./getIdString.js";

export const getAncestorDirectories = async (directory) => {
  const ancestors = [];

  let current = directory;

  while (current?._id) {
    ancestors.push(current);

    const parentId =
      getIdString(current.parentDirId);

    if (!parentId) {
      break;
    }

    current = await Directory.findById(parentId)
      .select(
        "_id name parentDirId isPublic publicRole"
      )
      .lean();
  }

  return ancestors;
};