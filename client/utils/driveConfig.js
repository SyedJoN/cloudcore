import {
  getDirectory,
  getGoogleDrive,
  getRecent,
  getRootDirectory,
  getSharedItems,
  getTrash,
} from "../apis/directoryApi2";

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
    fetch: getRecent,
  },
  trash: {
    fetch: getTrash,
  },
  'google-drive': {
    fetch: getGoogleDrive,
  },
};
