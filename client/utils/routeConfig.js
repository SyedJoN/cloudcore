import {
  getRootDirectory,
  getDirectory,
  getSharedItems,
  getTrash,
  getGoogleDrive,
  getStarredItems,
} from "../apis/directoryApi";
import { getRecentFiles } from "../apis/fileApi";

export const ROUTE_CONFIG = {
  "google-drive": {
    label: "Google Drive",
    path: "/google-drive",
    flatBreadcrumb: true,
    fetch: getGoogleDrive,
  },
  home: {
    label: "Home",
    path: "/home",
    flatBreadcrumb: false,
    fetch: getRootDirectory,
  },
  root: {
    label: "My Drive",
    path: "/",
    flatBreadcrumb: false,
    fetch: getDirectory,
  },
  shared: {
    label: "Shared with me",
    path: "/shared",
    flatBreadcrumb: true,
    fetch: getSharedItems,
  },
  recent: {
    label: "Recent",
    path: "/recent",
    flatBreadcrumb: true,
    fetch: getRecentFiles,
  },
  starred: {
    label: "Starred",
    path: "/starred",
    flatBreadcrumb: true,
    fetch: getStarredItems
  },
  trash: {
    label: "Trash",
    path: "/trash",
    flatBreadcrumb: true,
    fetch: getTrash,
  },
};

export function getRouteConfig(dirContext) {
  return ROUTE_CONFIG[dirContext] ?? ROUTE_CONFIG.root;
}
