import "../Styles/DirectoryView.css";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import {
  DriveHeader,
  DriveSidebar,
  DriveToolbar,
  ContextMenu,
  ShareModal,
  UploadTray,
  DetailsSidebar,
  RequestAccess,
  DriveEmptyState,
  GoogleDriveCard,
  CreateDirectoryModal,
  RenameModal,
  SelectionBar,
  DefaultView,
} from "../Components/Drive";

import { IconInfo } from "../Components/Icons/Icons";

import FileViewer from "../Components/File/FileViewer";
import TopBanner from "../Components/Banners/TopBanner";
import {
  deleteFile,
  grantAccessById,
  restoreFile,
  revokeFileAccess,
  softDeleteFile,
  toggleDriveFilePermission,
  toggleFilePublic,
  updateFileViewTime,
} from "../../apis/fileApi";
import { useAuth, useGDrive, useBreadcrumb, useToast } from "../Contexts";
import { axiosWithCreds } from "../../apis/axiosInstances";
import { fetchPortalUrl } from "../../apis/subscriptionApi";

import { useDirectoryData } from "../Hooks/useDirectoryData";
import { useUploadQueue } from "../Hooks/useUploadQueue";
import { useSelectionAndContextMenu } from "../Hooks/useSelectionAndContextMenu";
import { getResourceType } from "../../Utils/getResourceType";
import { DRIVE_ROLES } from "../../Utils/displayUtils";
import {
  clearPendingDriveFile,
  getPendingDriveFile,
} from "../Components/Drive/PendingGoogleDriveFile";
import { uploadGoogleDriveFile } from "../Components/Drive/uploadGoogleDriveFile";
import RecentView from "../Components/Drive/Recent/RecentView";
import {
  applyRecentFilters,
  DEFAULT_RECENT_FILTERS,
} from "../Components/Drive/Recent/ApplyRecentFilters";
import { copyItem, toggleItemStar } from "../../apis/resourceApi";
import { searchUsers } from "../../apis/userApi";
import { updateSharedAccess } from "../../Utils/shareRoleAccess";
import DownloadTray from "../Components/Drive/DownloadTray";
import { useFolderUploadQueue } from "../Hooks/useFolderUploadQueue";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function DirectoryView({ route }) {
  const { breadcrumbs, setBreadcrumbs } = useBreadcrumb();
  const { user, refreshUser } = useAuth();
  const { checkGoogleDriveAccess, isGoogleDrive, setIsGoogleDrive } =
    useGDrive();
  const { toast } = useToast();
  const { dirId } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const errorTimeoutRef = useRef(null);
  const grantExecutedRef = useRef(false);
  const mainRef = useRef(null);
  const usersLoadedRef = useRef(null);

  const grantUserId = useMemo(
    () => new URLSearchParams(location.search).get("grant"),
    [],
  );
  const grantRole = useMemo(
    () => new URLSearchParams(location.search).get("role"),
    [],
  );

  const isHomeRoute = route === "home";
  const isSharedRoute =
    route === "shared" || params.get("usp") === "drive_link";
  const isTrashRoute = route === "trash";
  const isGoogleDriveRoute = route === "google-drive";
  const isRecentRoute = route === "recent";
  const isStarredRoute = route === "starred";

  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [peopleWithAccess, setPeopleWithAccess] = useState([]);
  const [prevPermissions, setPrevPermissions] = useState([]);
  const [linkAccess, setLinkAccess] = useState("");
  const [linkRole, setLinkRole] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [showCreateDir, setShowCreateDir] = useState(false);
  const [newDirname, setNewDirname] = useState("New Folder");
  const [showRename, setShowRename] = useState(false);
  const [renameType, setRenameType] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareItem, setShareItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [isRenameLoading, setIsRenameLoading] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [downloadProgressMap, setDownloadProgressMap] = useState({});
  const dirContext =
    location.state?.dirContext ||
    (isTrashRoute
      ? "trash"
      : isSharedRoute
        ? "shared"
        : isRecentRoute
          ? "recent"
          : isGoogleDriveRoute
            ? "google-drive"
            : isHomeRoute
              ? "home"
              : isStarredRoute
                ? "starred"
                : "root");
  const previousDirContext = useRef(dirContext);
  const resumedDriveUploadRef = useRef(false);
  const downloadControllers = useRef({});

  const handleUndo = async (undoAction) => {
    if (!undoAction) return;

    if (undoAction.type === "trash") {
      await handleRestoreItem(undoAction.item);
      refreshCurrentDirectory();
    }
    if (undoAction.type === "restore") {
      await handleMoveToTrash(undoAction.item);
      refreshCurrentDirectory();
    }
    if (undoAction.type === "star") {
      await handleToggleStar(undoAction.item);
      isStarredRoute && getDirectoryItems("starred");
    }
    toast({ message: "Action undone", type: "success" });
  };

  function showError(message, autoClear = false) {
    setError(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    if (autoClear) {
      errorTimeoutRef.current = setTimeout(() => setError(""), 5000);
    }
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ownership = params.get("ownership");

    if (ownership === "accepted") {
      toast({
        message: "You are now the owner",
        type: "success",
      });
    }

    if (ownership === "rejected") {
      toast({
        message: "Ownership rejected",
        type: "success",
      });
    }

    if (ownership) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  useEffect(() => {
    previousDirContext.current = dirContext;
  }, [dirContext]);

  useEffect(() => {
    if (!dirId) {
      refreshUser();
    }
  }, [dirId]);
  const {
    directoryName,
    isLoading,
    needsAccess,
    crumbs,
    setCrumbs,
    directoriesList,
    filesList,
    setFilesList,
    setDirectoriesList,
    getDirectoryItems,
    getTrashItems,
    combinedItems,
    filteredFiles,
  } = useDirectoryData({
    dirId,
    dirContext,
    isSharedRoute,
    isRecentRoute,
    isTrashRoute,
    setIsStarred,
    isStarred,
    isGoogleDriveRoute,
    setIsGoogleDrive,
    navigate,
    searchQuery,
  });

  const refreshCurrentDirectory = (type = "") =>
    getDirectoryItems(
      type === "google"
        ? "google-drive"
        : isSharedRoute
          ? "shared"
          : isStarredRoute
            ? "starred"
            : isTrashRoute
              ? "trash"
              : "root",
    );

  const {
    fileInputRef,
    uploadQueue,
    progressMap,
    isUploading,
    handleFileSelect,
    handleCancelUpload,
    setItemProgress,
    enqueueItem,
    completeItem,
    dbFileId,
    setDbFileId,
  } = useUploadQueue({
    dirId,
    showError,
    onQueueComplete: refreshCurrentDirectory,
  });
  const {
    fileInputRef: folderInputRef,
    uploadQueue: folderUploadQueue,
    progressMap: folderProgressMap,
    isUploading: isFolderUploading,
    handleFolderSelect,
    handleCancelUpload: handleCancelFolderUpload,
  } = useFolderUploadQueue({
    dirId,
    showError,
    onQueueComplete: refreshCurrentDirectory,
  });

  const combinedUploadQueue = [...uploadQueue, ...folderUploadQueue];

  const combinedProgressMap = {
    ...progressMap,
    ...folderProgressMap,
  };
  const handleCancelCombinedUpload = async (tempId, fileId) => {
    const isFolderUpload = folderUploadQueue.some(
      (item) => item._id === tempId,
    );

    if (isFolderUpload) {
      await handleCancelFolderUpload(tempId, fileId);

      return;
    }

    await handleCancelUpload(tempId, fileId);
  };
  const {
    selectedItems,
    contextItem,
    setContextItem,
    contextPos,
    openLeft,
    dragBox,
    handleSelect,
    clearSelection,
    handleContextMenu,
    open,
    setOpen,
    handleMainMouseDown,
    handleMainMouseMove,
    handleMainMouseUp,
  } = useSelectionAndContextMenu({ combinedItems, mainRef });
  useEffect(() => {
    console.log("route", route);
  }, [route]);
  useEffect(() => {
    if (!isStarredRoute) return;
    setIsStarred((prev) => {
      const updated = { ...prev };
      combinedItems.forEach((item) => {
        updated[item._id] = item.isStarred;
      });
      return updated;
    });
  }, [isStarredRoute, combinedItems]);

  useEffect(() => {
    if (!directoriesList.length && !filesList.length) {
      clearSelection();
    }
  }, [directoriesList, filesList]);

  useEffect(() => {
    checkGoogleDriveAccess();
  }, []);

  useEffect(() => {
    if (!isGoogleDrive || resumedDriveUploadRef.current) return;

    const pending = getPendingDriveFile();
    if (!pending) return;

    resumedDriveUploadRef.current = true;
    clearPendingDriveFile();

    (async () => {
      try {
        const { dirId: directoryId } = await uploadGoogleDriveFile(pending, {
          enqueueItem,
          setItemProgress,
          completeItem,
          handleCancelUpload,
          refreshUser,
          setDbFileId,
          onUploadComplete: refreshCurrentDirectory,
        });

        if (directoryId) {
          navigate(`/directory/${directoryId}`);
        }
      } catch (err) {
        console.error("Resumed Drive upload failed:", err);
        showError("Couldn't finish uploading the file you picked from Drive.");
      }
    })();
  }, [isGoogleDrive]);

  useEffect(() => {
    if (isGoogleDriveRoute) getDirectoryItems("google-drive");
    else if (dirContext === "trash" || isTrashRoute) getDirectoryItems("trash");
    else if (isRecentRoute) getDirectoryItems("recent");
    else if (isSharedRoute) getDirectoryItems("shared");
    else if (isStarredRoute) getDirectoryItems("starred");
    else {
      getDirectoryItems("root");
    }
    setContextItem(null);
    clearSelection();
    setSearchQuery("");
  }, [
    getDirectoryItems,
    dirContext,
    dirId,
    isSharedRoute,
    isTrashRoute,
    isStarredRoute,
    location.pathname,
  ]);

  useEffect(() => {
    const channel = new BroadcastChannel("file-sync");
    channel.onmessage = (event) => {
      if (event.data.type === "FILE_DELETED") {
        setFilesList((prev) => prev.filter((f) => f._id !== event.data.id));
      }
    };
    return () => channel.close();
  }, [setFilesList]);

  useEffect(() => {
    if (grantUserId && grantRole && dirId && !grantExecutedRef.current) {
      grantExecutedRef.current = true;
      axiosWithCreds
        .post(
          `/file/grant-access/${dirId}`,
          {
            usersArray: [{ id: grantUserId, role: grantRole }],
            type: "folder",
          },
          { headers: { "Content-Type": "application/json" } },
        )
        .then(() => {
          toast({ message: "Access granted successfully", type: "success" });
          navigate(`/directory/${dirId}`, { replace: true });
        })
        .catch(() => {
          grantExecutedRef.current = false;
          toast({ message: "Failed to grant access", type: "error" });
        });
    }
  }, [dirId, grantUserId, grantRole, navigate, toast]);

  // loading users for search suggestion (ShareModal);
  useEffect(() => {
    async function loadAllUsers() {
      if (usersLoadedRef.current) return;
      usersLoadedRef.current = true;
      try {
        const data = await searchUsers();
        setAllUsers(
          data.users.map((u) => ({
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            avatar: u.avatar,
          })),
        );
      } catch (err) {
        console.log(err.message);
      }
    }
    loadAllUsers();
  }, []);

  // Navigation
  function handleRowClick(itemId) {
    setContextItem(null);
    handleSelect(itemId);
  }

  const handleRowDoubleClick = async (type, id) => {
    if (type === "google-directory") {
      window.open(`https://drive.google.com/drive/folders/${id}`, "_blank");
      return;
    }
    if (type === "directory") {
      navigate(`/directory/${id}`, {
        state: { dirContext: previousDirContext.current },
      });
      return;
    }
    const item = combinedItems.find((i) => (i.id ?? i._id) === id);
    if (item) setViewItem(item);
    if (type === "google-file") return;
    try {
      await updateFileViewTime(id);
    } catch (err) {
      console.log("err", err.message);
    }
  };

  // Item actions
  async function handleMoveToTrash(item) {
    try {
      const url = item.isDirectory
        ? `/directory/soft-delete/${item._id}`
        : `/file/soft-delete/${item._id}`;
      await softDeleteFile(url);
      await refreshUser();

      toast({
        message: "Item moved to trash",
        type: "success",
        duration: 5000,

        undoAction: {
          type: "trash",
          itemId: item._id,
          onUndo: async () => {
            await handleUndo({
              type: "trash",
              itemId: item._id,
              item,
            });
          },
        },
      });
      refreshCurrentDirectory();
      clearSelection();
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        showError("Too many requests. Please slow down.");
        return;
      }
      showError(err.message);
    }
  }

  async function handleRestoreItem(item) {
    try {
      const type = item.isDirectory ? "directory" : "file";
      await restoreFile(`/${type}/${item._id}/restore`);
      await refreshUser();
      toast({
        message: `${item.name} restored`,
        type: "success",

        undoAction: {
          type: "restore",
          itemId: item._id,
          onUndo: async () => {
            await handleUndo({
              type: "restore",
              itemId: item._id,
              item,
            });
          },
        },
      });
      getTrashItems(showError);
      clearSelection();
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        navigate("/login");
        return;
      }
      if (status === 507) {
        showError("Free up space to restore this item.");
        return;
      }
      showError(err.message);
    }
  }

  async function handleDelete(item, type = "local") {
    try {
      const url =
        item?.isDirectory && type === "local"
          ? `/directory/${item._id}`
          : `/file/${item._id ?? item.id}?type=${type}`;
      const { data } = await deleteFile(url);
      type === "google"
        ? refreshCurrentDirectory("google")
        : getTrashItems(showError);
      clearSelection();
      toast({ message: data.message, type: "success" });
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleCreateDirectory(e) {
    e.preventDefault();
    showError("");
    try {
      await axiosWithCreds.post(
        `/directory/${dirId || ""}`,
        {},
        { headers: { dirname: newDirname } },
      );
      setNewDirname("New Folder");
      setShowCreateDir(false);
      refreshCurrentDirectory();
    } catch (err) {
      showError(err.message);
    }
  }

  function openRename(item) {
    setRenameType(
      item?.webViewLink ? "google" : item.isDirectory ? "directory" : "file",
    );
    setRenameId(item._id ?? item.id);
    setRenameValue(item.name);
    setShowRename(true);
  }
  async function handleRenameSubmit(e) {
    e.preventDefault();
    showError("");
    try {
      setIsRenameLoading(true);
      const url =
        renameType === "file" || renameType === "google"
          ? `/file/${renameId}?type=${renameType}`
          : `/directory/${renameId}`;
      const body =
        renameType === "google"
          ? { fileName: renameValue }
          : renameType === "file"
            ? { fileName: renameValue }
            : { newDirName: renameValue };

      const { data } = await axiosWithCreds.patch(url, body);
      setShowRename(false);
      toast({ message: data.message, type: "success" });
      refreshCurrentDirectory(renameType);
    } catch (err) {
      showError(err.message);
    } finally {
      setIsRenameLoading(false);
    }
  }
  async function handleToggleStar(item) {
    try {
      const type = item.isDirectory ? "folder" : "file";

      const {
        data: { message },
      } = await toggleItemStar(item._id, type);

      const newStarredValue = !item.isStarred;

      if (!newStarredValue && isStarredRoute) {
        if (item.isDirectory) {
          setDirectoriesList((prev) => prev.filter((d) => d._id !== item._id));
        } else {
          setFilesList((prev) => prev.filter((f) => f._id !== item._id));
        }
      }
      setIsStarred((prev) => ({
        ...prev,
        [item._id]: !prev[item._id],
      }));
      toast({
        message,
        type: "success",

        undoAction: {
          type: "star",
          itemId: item._id,
          onUndo: async () => {
            await handleUndo({
              type: "star",
              itemId: item._id,
              item,
            });
          },
        },
      });
    } catch (error) {
      setError(error.message);
    }
  }
  async function handleDownloadFolder(item) {
    showError("");
    const type = getResourceType(item);

    // for google drive folders
    if (type.startsWith("google")) {
      window.open(
        `https://drive.google.com/drive/folders/${item.id}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    const fileId = item._id;

    const controller = new AbortController();

    downloadControllers.current[fileId] = controller;

    setDownloadQueue((prev) => [...prev.filter((f) => f._id !== fileId), item]);

    setDownloadProgressMap((prev) => ({
      ...prev,
      [fileId]: 0,
    }));

    try {
      const response = await fetch(
        `http://localhost:4000/directory/${fileId}/download`,
        {
          credentials: "include",
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const contentLength = response.headers.get("Content-Length");

      const total = Number(contentLength || 0);

      const reader = response.body.getReader();

      const chunks = [];

      let received = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);

        received += value.length;

        if (total > 0) {
          const progress = Math.round((received / total) * 100);

          setDownloadProgressMap((prev) => ({
            ...prev,
            [fileId]: progress,
          }));
        }
      }

      const blob = new Blob(chunks);

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;

      a.download = `${item.name}.zip`;

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(url);

      setDownloadProgressMap((prev) => ({
        ...prev,
        [fileId]: 100,
      }));

      // remove only AFTER download finishes
      setTimeout(() => {
        setDownloadQueue((prev) => prev.filter((f) => f._id !== fileId));

        setDownloadProgressMap((prev) => {
          const next = {
            ...prev,
          };

          delete next[fileId];

          return next;
        });
      }, 1000);
    } catch (err) {
      if (err.name === "AbortError") {
        console.log("Download cancelled");
      } else {
        console.error("Download error:", err);

        showError(err.message);
      }

      setDownloadQueue((prev) => prev.filter((f) => f._id !== fileId));

      setDownloadProgressMap((prev) => {
        const next = {
          ...prev,
        };

        delete next[fileId];

        return next;
      });
    } finally {
      delete downloadControllers.current[fileId];
    }
  }
  function handleCancelDownload(fileId) {
    const controller = downloadControllers.current[fileId];

    if (controller) {
      controller.abort();
    }
  }
  function handleDownload(item) {
    try {
      if (isGoogleDrive && isGoogleDriveRoute) {
        const url = `http://localhost:4000/auth/google-drive/download?fileId=${item.id}`;
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      // local S3 file
      window.location.href = `http://localhost:4000/file/${item._id}?action=download`;
    } catch (err) {
      showError(err.message);
    }
  }

  const handleToggleResourcePublic = async (item, role, access) => {
    setIsShareLoading(true);

    try {
      const itemId = item._id ?? item.id;
      const type = getResourceType(item);
      const isGoogleDrive = type.startsWith("google-drive");

      const restricted = access === "restricted";
      const userRole = DRIVE_ROLES[role] ?? "reader";

      let permission = null;

      if (isGoogleDriveRoute) {
        if (restricted) {
          await revokeFileAccess("google", itemId, "anyoneWithLink");
        } else {
          const { data } = await toggleDriveFilePermission(itemId, userRole);

          permission = data.permission;
        }
      } else {
        await toggleFilePublic(itemId, userRole, access, type);
      }

      const update = (list) =>
        list.map((resource) => {
          if (String(resource._id ?? resource.id) !== String(itemId)) {
            return resource;
          }

          const permissions = resource.permissions ?? [];

          const updatedPermissions = restricted
            ? permissions.filter((p) => p?.type !== "anyone")
            : [
                ...permissions.filter((p) => p?.type !== "anyone"),
                {
                  ...(permission ?? {}),
                  type: "anyone",
                  role: userRole,
                },
              ];

          return {
            ...resource,
            isPublic: restricted ? false : true,
            publicRole: restricted ? null : userRole,
            permissions: updatedPermissions,
          };
        });

      setFilesList((prev) => update(prev));
      setDirectoriesList((prev) => update(prev));

      // Keep local modal state immediately correct
      setLinkAccess(restricted ? "restricted" : "anyone");
      setLinkRole(restricted ? "reader" : userRole);

      toast({
        message: "Public Access updated",
        type: "success",
      });
    } catch (error) {
      toast({
        message: error?.message || "Something went wrong!",
        type: "error",
      });
    } finally {
      setIsShareLoading(false);
    }
  };
  useEffect(() => {
    console.log("combined", combinedItems);
  }, [combinedItems]);
  useEffect(() => {
    console.log("peopleWithAccess", peopleWithAccess);
  }, [peopleWithAccess]);
  const handleSharedRoleUpdate = async (item, type, message) => {
    setIsShareLoading(true);

    try {
      const allPermissions = item?.permissions ?? [];

      const mergedPermissions = allPermissions.map((permission) => {
        const changedPermission = peopleWithAccess.find(
          (person) => String(person.id) === String(permission.id),
        );

        if (!changedPermission) {
          return permission;
        }

        return {
          ...permission,
          role: changedPermission.role,
        };
      });

      const newPermissions = mergedPermissions.filter(
        (permission) =>
          permission?.type !== "anyone" && permission?.role !== "owner",
      );

      const previousEditablePermissions = (item?.permissions ?? []).filter(
        (permission) =>
          permission?.type !== "anyone" && permission?.role !== "owner",
      );

      const result = await updateSharedAccess({
        item,
        type,

        peopleWithAccess: newPermissions,

        prevPermissions: previousEditablePermissions,

        message,

        grantAccessById,

        revokeFileAccess,
      });

      if (!result?.changed) {
        setShareItem(null);
        return;
      }

      const updatedPeopleWithAccess = peopleWithAccess
        .map((p) => {
          const isRemoved = p.role === "remove";
          if (isRemoved) {
            return null;
          }
          return p;
        })
        .filter(Boolean);

      const update = (list) =>
        list.map((resource) => {
          const resourceId = String(resource?._id ?? resource?.id);
          if (resourceId !== String(result.itemId)) {
            return resource;
          }
          return {
            ...resource,
            permissions: updatedPeopleWithAccess,
          };
        });

      setFilesList((prev) => update(prev));
      setDirectoriesList((prev) => update(prev));

      setPeopleWithAccess(updatedPeopleWithAccess);

      setPrevPermissions(updatedPeopleWithAccess);

      setShareItem(null);

      toast({
        message: "Access updated",
        type: "success",
      });
    } catch (error) {
      console.error("handleSharedRoleUpdate:", error);

      toast({
        message: error?.message || "Something went wrong!",
        type: "error",
      });
    } finally {
      setIsShareLoading(false);
    }
  };
const insertBefore = (items, sourceItem, newItem) => {
  const index = items.findIndex(
    (item) => (item.id || item._id) === (sourceItem.id || sourceItem._id)
  );

  if (index === -1) return [...items, newItem];

  return [
    ...items.slice(0, index),
    newItem,
    ...items.slice(index),
  ];
};
async function handleCopyItem(item) {
  const type = item.isDirectory ? "folder" : "file";
  const providerType = item.webViewLink ? "google" : "local";

  try {
    const {
      message,
      data: {
        copiedItem,
        owners,
        capabilities,
        permissions,
      },
    } = await copyItem({
      item,
      type,
      providerType,
    });

    toast({
      message,
      type: "success",
    });

    const newItem = {
      ...copiedItem,
      owners,
      capabilities,
      permissions,
      isDirectory: type === "folder",
    };

    if (type === "folder") {
      setDirectoriesList((prev) =>
        insertBefore(prev, item, newItem)
      );
    } else {
      setFilesList((prev) =>
        insertBefore(prev, item, newItem)
      );
    }
  } catch (error) {
    showError(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to copy item"
    );
  }
}
  async function handleDeleteSelected() {
    for (const id of selectedItems) {
      const item = combinedItems.find((i) => (i.id ?? i._id) === id);
      if (!item) continue;
      const url = item.isDirectory
        ? `${BASE_URL}/directory/${id}`
        : `${BASE_URL}/file/${id}`;
      await axiosWithCreds.delete(url).catch(() => {});
    }
    clearSelection();
    refreshCurrentDirectory();
  }

  const listHeaderRow = (
    <div className="gd-list-header md:text-[11px]">
      <span>Name</span>
      <span>Owner</span>
      <span>Last modified</span>
      <span>File size</span>
      <span>Sort</span>
      <span />
    </div>
  );

  const hasFileSelected = [...selectedItems].some((id) => {
    const item = combinedItems.find((i) => (i.id ?? i._id) === id);
    return item && !item.isDirectory;
  });

  const selectedItem =
    selectedItems.size === 1
      ? combinedItems.find((i) => (i.id ?? i._id) === [...selectedItems][0])
      : null;

  if (needsAccess) {
    return <RequestAccess dirId={dirId} />;
  }

  return (
    <div className="directory-view">
      {user && user.uploadLimit == 0 && (
        <TopBanner
          variant="error"
          message="Payment failed. Please update your payment method. Your subscription will be automatically cancelled if payment isn't completed within 8 days."
          buttonText="Update Payment"
          onButtonClick={async () => {
            const url = await fetchPortalUrl();
            window.location.href = url;
          }}
        />
      )}

      <DriveHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        disabled={isUploading}
      />

      <div className="gd-body">
        {user.email && (
          <DriveSidebar
            enqueueItem={enqueueItem}
            setItemProgress={setItemProgress}
            completeItem={completeItem}
            handleCancelUpload={handleCancelUpload}
            setDbFileId={setDbFileId}
            refreshCurrentDirectory={refreshCurrentDirectory}
            showError={showError}
            dirId={dirId}
            dirContext={dirContext}
            onCreateFolder={() => setShowCreateDir(true)}
            onUploadFiles={() => fileInputRef.current?.click()}
            onUploadFolders={() => folderInputRef.current?.click()}
          />
        )}

        <div className="gd-main-container">
          <main
            style={{ userSelect: "none" }}
            ref={mainRef}
            className="gd-main"
            onMouseDown={handleMainMouseDown}
            onMouseMove={handleMainMouseMove}
            onMouseUp={handleMainMouseUp}
            onContextMenu={(e) => e.preventDefault()}
            onMouseLeave={handleMainMouseUp}
          >
            <DriveToolbar
              dirId={dirId}
              crumbs={crumbs}
              setCrumbs={setCrumbs}
              dirContext={dirContext}
              directoryName={directoryName}
              isSharedRoute={isSharedRoute}
              breadcrumbs={breadcrumbs}
              setBreadcrumbs={setBreadcrumbs}
              disabled={isUploading}
              viewMode={viewMode}
              onToggleView={() =>
                setViewMode((v) => (v === "grid" ? "list" : "grid"))
              }
              toggleDetailsBar={() => setShowDetails((prev) => !prev)}
            />

            {dragBox && (
              <div
                style={{
                  position: "fixed",
                  left: Math.min(dragBox.x1, dragBox.x2),
                  top: Math.min(dragBox.y1, dragBox.y2),
                  width: Math.abs(dragBox.x2 - dragBox.x1),
                  height: Math.abs(dragBox.y2 - dragBox.y1),
                  background: "rgba(26,115,232,0.1)",
                  border: "1px solid rgba(26,115,232,0.5)",
                  pointerEvents: "none",
                  zIndex: 500,
                }}
              />
            )}

            {error && (
              <div className="gd-error-banner">
                <IconInfo size={16} /> {error}
              </div>
            )}

            {isLoading ? (
              <div className="gd-loading">
                <div className="gd-spinner" />
              </div>
            ) : (
              <>
                {combinedItems.length === 0 && !dirId ? (
                  <DriveEmptyState />
                ) : isRecentRoute || isSharedRoute ? (
                  <RecentView
                    items={isSharedRoute ? combinedItems : filteredFiles}
                    isRecentRoute={isRecentRoute}
                    viewMode={viewMode}
                    selectedItems={selectedItems}
                    onSelect={handleSelect}
                    onRowClick={handleRowClick}
                    onDoubleClick={handleRowDoubleClick}
                    onContextMenu={handleContextMenu}
                    listHeaderRow={listHeaderRow}
                  />
                ) : (
                  <DefaultView
                    isGoogleDrive={isGoogleDrive}
                    isHomeRoute={isHomeRoute}
                    items={combinedItems}
                    viewMode={viewMode}
                    user={user}
                    dirId={dirId}
                    selectedItems={selectedItems}
                    onSelect={handleSelect}
                    onRowClick={handleRowClick}
                    onDoubleClick={handleRowDoubleClick}
                    onContextMenu={handleContextMenu}
                    listHeaderRow={listHeaderRow}
                  />
                )}
              </>
            )}
          </main>
        </div>

        {showDetails && (
          <DetailsSidebar
            item={selectedItem}
            selectedItemSize={selectedItems.size}
            userEmail={user.email}
            onClose={() => setShowDetails(false)}
            onShare={(item) => setShareItem(item)}
          />
        )}
      </div>

      {showCreateDir && (
        <CreateDirectoryModal
          value={newDirname}
          setNewDirname={setNewDirname}
          onCreateDirectory={handleCreateDirectory}
          onClose={() => setShowCreateDir(false)}
        />
      )}

      {showRename && (
        <RenameModal
          isRenameLoading={isRenameLoading}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onRenameSubmit={handleRenameSubmit}
          onClose={() => setShowRename(false)}
        />
      )}

      <SelectionBar
        dirId={dirId}
        combinedItems={combinedItems}
        selectedItems={selectedItems}
        hasFileSelected={hasFileSelected}
        isStarred={isStarred}
        setIsStarred={setIsStarred}
        route={route}
        onClear={() => {
          clearSelection();
          setContextItem(null);
        }}
        onStar={() => {
          selectedItems.forEach((id) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) handleToggleStar(item);
          });
        }}
        onDownload={() => {
          selectedItems.forEach((id) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item && item.isDirectory) {
              handleDownloadFolder(item);
            } else {
              handleDownload(item);
            }
          });
          clearSelection();
        }}
        onCopy={() => {
          selectedItems.forEach((id) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) {
              handleCopyItem(item);
            }
          });
          clearSelection();
        }}
        onRename={() => {
          selectedItems.forEach((id) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) openRename(item);
          });
        }}
        onShare={() => {
          const id = [...selectedItems][0];
          const item = combinedItems.find((i) => (i.id ?? i._id) === id);
          if (item) setShareItem(item);
        }}
        onTrash={() => {
          selectedItems.forEach((id) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) handleMoveToTrash(item);
          });
        }}
        onRestore={() => {
          selectedItems.forEach((id) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) handleRestoreItem(item);
          });
        }}
        onSoftDelete={() => {
          selectedItems.forEach((id) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) handleMoveToTrash(item);
          });
        }}
        onDeleteForever={(type) => {
          selectedItems.forEach((id) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) handleDelete(item, type);
          });
        }}
      />

      <ContextMenu
        open={open}
        openLeft={openLeft}
        item={contextItem}
        position={contextPos}
        isGoogleDriveRoute={isGoogleDriveRoute}
        isTrashRoute={isTrashRoute}
        dirId={dirId}
        viewMode={viewMode}
        onClose={() => {
          setOpen(false);
          setContextItem(null);
          clearSelection();
        }}
        onShare={(item) => setShareItem(item)}
        onRename={(item) => openRename(item)}
        onSoftDelete={(item) => handleMoveToTrash(item)}
        onDelete={(item, type) => handleDelete(item, type)}
        onRestore={(item) => handleRestoreItem(item)}
        onDownload={(item) => {
          if (item && item.isDirectory) {
            handleDownloadFolder(item);
          } else {
            handleDownload(item);
          }
        }}
        onCopy={(item) => handleCopyItem(item)}
        onPreview={(item) => setViewItem(item)}
      />

      {viewItem && (
        <FileViewer
          key={viewItem._id}
          item={viewItem}
          onClose={() => setViewItem(null)}
          isSharedRoute={isSharedRoute}
          files={filteredFiles}
          onNavigate={(item) => setViewItem(item)}
          onShare={(item) => {
            setShareItem(item);
            setViewItem(null);
          }}
          onRename={(item) => {
            openRename(item);
            setViewItem(null);
          }}
          onSoftDelete={(item) => {
            handleMoveToTrash(item);
            setViewItem(null);
          }}
          onDelete={(item, type) => {
            handleDelete(item, type);
            setViewItem(null);
          }}
          onRestore={(item) => {
            handleRestoreItem(item);
            setViewItem(null);
          }}
          onDownload={handleDownload}
        />
      )}

      {shareItem && (
        <ShareModal
          selectedUsers={selectedUsers}
          setSelectedUsers={setSelectedUsers}
          peopleWithAccess={peopleWithAccess}
          setPeopleWithAccess={setPeopleWithAccess}
          item={shareItem}
          allUsers={allUsers}
          onUpdateRoleAfterSave={handleSharedRoleUpdate}
          onClose={handleToggleResourcePublic}
          setShareItem={setShareItem}
          linkAccess={linkAccess}
          setLinkAccess={setLinkAccess}
          linkRole={linkRole}
          setLinkRole={setLinkRole}
          prevPermissions={prevPermissions}
          setPrevPermissions={setPrevPermissions}
          isShareLoading={isShareLoading}
          setDirectoriesList={setDirectoriesList}
          setFilesList={setFilesList}
          isGoogleDriveRoute={isGoogleDriveRoute}
          setIsShareLoading={setIsShareLoading}
        />
      )}

      <UploadTray
        dbFileId={dbFileId}
        uploadingFiles={combinedUploadQueue}
        progressMap={combinedProgressMap}
        onCancel={handleCancelCombinedUpload}
      />
      <DownloadTray
        downloads={downloadQueue}
        progressMap={downloadProgressMap}
        onCancel={handleCancelDownload}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        hidden
        onChange={handleFolderSelect}
        disabled={isFolderUploading}
      />
    </div>
  );
}
