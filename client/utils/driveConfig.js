import {
  getDirectory,
  getGoogleDrive,
  getRootDirectory,
  getSharedItems,
  getTrash,
} from "../apis/directoryApi2";
import { getRecentFiles } from "../apis/fileApi";

export const driveConfig = {
  root: {
    fetch: getDirectory
  },
  home: {
    fetch: getRootDirectory,
  },
  shared: {
    fetch: getSharedItems,
  },
  recent: {
    fetch: getRecentFiles,
  },
  trash: {
    fetch: getTrash,
  },
  'google-drive': {
    fetch: getGoogleDrive,
  },
};
