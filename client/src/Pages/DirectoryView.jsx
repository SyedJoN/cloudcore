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
import { DRIVE_ROLES, getFileType } from "../../Utils/displayUtils";
import {
  clearPendingDriveFile,
  getPendingDriveFile,
} from "../Components/Drive/PendingGoogleDriveFile";
import { uploadGoogleDriveFile } from "../Components/Drive/uploadGoogleDriveFile";
import RecentView from "../Components/Drive/Recent/RecentView";

import { copyItem, toggleItemStar } from "../../apis/resourceApi";
import { searchUsers } from "../../apis/userApi";
import { updateSharedAccess } from "../../Utils/shareRoleAccess";
import DownloadTray from "../Components/Drive/DownloadTray";
import { useFolderUploadQueue } from "../Hooks/useFolderUploadQueue";
import { addDirectory } from "../../apis/directoryApi";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/solid";
import SortButton from "../Components/ListRow/SortButton";
import MoveModal from "../Components/Modals/MoveModal";
import { GDrivePicker, NewMenu } from "../Components/Drive/DriveSidebar";
import CreateMenu from "../Components/Drive/CreateMenu";
import ConfirmationModal from "../Components/Modals/ConfirmationModal";
import CascadeConfirmationModal from "../Components/Modals/CascadeConfirmationModal";

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

  const isHomeRoute = route === "home" || params.get("usp") === "drive_link";
  const isSharedRoute = route === "shared";
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
  const [newDirname, setNewDirname] = useState("Untitled folder");
  const [showRename, setShowRename] = useState(false);
  const [renameType, setRenameType] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareItem, setShareItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [moveItem, setMoveItem] = useState(null);
  const [isRenameLoading, setIsRenameLoading] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [userRole, setUserRole] = useState([]);
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [downloadProgressMap, setDownloadProgressMap] = useState({});
  const [createMenuPos, setCreateMenuPos] = useState({ x: 0, y: 0 });
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
    folders: "top",
  });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    message: "",
    resolve: null,
  });
  const [cascadeModal, setCascadeModal] = useState(null);

  function showCascadeConfirm(chain) {
    return new Promise((resolve) => {
      setCascadeModal({ chain, resolve });
    });
  }

  function handleCascadeCancel() {
    cascadeModal?.resolve(false);
    setCascadeModal(null);
  }

  function handleCascadeConfirm() {
    cascadeModal?.resolve(true);
    setCascadeModal(null);
  }
  const showConfirmModal = (message) => {
    return new Promise((resolve) => {
      setConfirmModal({
        open: true,
        message,
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    confirmModal.resolve?.(true);

    setConfirmModal({
      open: false,
      message: "",
      resolve: null,
    });
  };

  const handleCancel = () => {
    confirmModal.resolve?.(false);

    setConfirmModal({
      open: false,
      message: "",
      resolve: null,
    });
  };
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
    try {
      if (!undoAction) return;
      const items = undoAction?.items;

      if (undoAction.type === "trash") {
        await handleRestoreItem(items);

        const folders = items.filter((item) => item.isDirectory);
        const files = items.filter((item) => !item.isDirectory);
        setDirectoriesList((prev) => [...prev, ...folders]);

        setFilesList((prev) => [...prev, ...files]);
      }
      if (undoAction.type === "restore") {
        await handleMoveToTrash(items);
        const folders = items.filter((item) => item.isDirectory);
        const files = items.filter((item) => !item.isDirectory);

        setDirectoriesList((prev) => [...prev, ...folders]);
        setFilesList((prev) => [...prev, ...files]);
      }
      if (undoAction.type === "star") {
        await handleToggleStar(items);

        if (isStarredRoute) {
          const folders = items.filter((item) => item.isDirectory);
          const files = items.filter((item) => !item.isDirectory);

          setDirectoriesList((prev) => [...prev, ...folders]);
          setFilesList((prev) => [...prev, ...files]);
        }
      }
      toast({ message: "Action undone", type: "success" });
    } catch (error) {
      console.log("error", error);
    }
  };

  function showError(message, autoClear = false) {
    setError(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    if (autoClear) {
      errorTimeoutRef.current = setTimeout(() => setError(""), 5000);
    }
  }
  useEffect(() => {
    console.log("item", shareItem);
  }, [shareItem]);
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
    setError("");
  }, [route]);

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
    console.log("true");
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
      setFilesList((prev) =>
        prev.map((item) =>
          item._id === id
            ? { ...item, viewedByMeTime: new Date().toISOString() }
            : item,
        ),
      );
    } catch (err) {
      console.log("err", err.message);
    }
  };

  async function handleMoveToTrash(items) {
    try {
      showError("");
      await Promise.all(
        items.map((item) => {
          const url = item.isDirectory
            ? `/directory/soft-delete/${item._id}`
            : `/file/soft-delete/${item._id}`;
          return softDeleteFile(url);
        }),
      );
      await refreshUser();
      const areAllFiles = items.every((item) => !item.isDirectory);
      const areAllFolders = items.every((item) => item.isDirectory);
      const count = items.length;
      const noun = areAllFiles ? "file" : areAllFolders ? "folder" : "item";

      toast({
        message: `${count} ${noun}${count === 1 ? "" : "s"} moved to trash`,
        type: "success",
        duration: 5000,

        undoAction: {
          type: "trash",
          items: items,
          onUndo: async () => {
            await handleUndo({
              type: "trash",
              items,
            });
          },
        },
      });

      const deletedIds = new Set(items.map((item) => item._id));

      setDirectoriesList((prev) =>
        prev.filter((item) => !deletedIds.has(item._id)),
      );

      setFilesList((prev) => prev.filter((item) => !deletedIds.has(item._id)));

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

  async function handleRestoreItem(items) {
    showError("");

    try {
      await Promise.all(
        items.map((item) => {
          const type = item.isDirectory ? "directory" : "file";

          return restoreFile(`/${type}/${item._id}/restore`);
        }),
      );
      await refreshUser();
      toast({
        message: `${items.length} items restored`,
        type: "success",

        undoAction: {
          type: "restore",
          items: items,
          onUndo: async () => {
            await handleUndo({
              type: "restore",
              items,
            });
          },
        },
      });
      const restoredIds = new Set(items.map((item) => item.id ?? item._id));

      setDirectoriesList((prev) =>
        prev.filter((item) => !restoredIds.has(item.id ?? item._id)),
      );
      setFilesList((prev) =>
        prev.filter((item) => !restoredIds.has(item.id ?? item._id)),
      );
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

  async function handleDelete(items, type) {
    try {
      await Promise.all(
        items.map((item) => {
          const url =
            item?.isDirectory && type === "local"
              ? `/directory/${item._id ?? item.id}`
              : `/file/${item._id ?? item.id}?type=${type}`;
          return deleteFile(url);
        }),
      );

      clearSelection();
      const areAllFiles = items.every((item) => !item.isDirectory);
      const areAllFolders = items.every((item) => item.isDirectory);
      const count = items.length;
      const noun = areAllFiles ? "file" : areAllFolders ? "folder" : "item";

      toast({
        message: `${count} ${noun}${count === 1 ? "" : "s"} deleted permanently`,
        type: "success",
      });

      setViewItem(null);
      const deletedIds = new Set(items.map((item) => item.id ?? item._id));
      setDirectoriesList((prev) =>
        prev.filter((item) => !deletedIds.has(item.id ?? item._id)),
      );
      setFilesList((prev) =>
        prev.filter((item) => !deletedIds.has(item.id ?? item._id)),
      );
    } catch (err) {
      showError(err.message);
    }
  }

  async function handleCreateDirectory(e) {
    e.preventDefault();
    showError("");

    const type = isGoogleDriveRoute ? "google" : "local";
    try {
      const response = await addDirectory(dirId, newDirname, type);
      setShowCreateDir(false);
      setNewDirname("Untitled folder");
      setDirectoriesList((prev) => [response.data, ...prev]);
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

      if (viewItem) {
        setViewItem((prev) => ({ ...prev, name: renameValue }));
      }
      setDirectoriesList((prev) =>
        prev.map((item) =>
          (item.id ?? item._id) === renameId
            ? { ...item, name: renameValue }
            : item,
        ),
      );
      setFilesList((prev) =>
        prev.map((item) =>
          (item.id ?? item._id) === renameId
            ? {
                ...item,
                name: renameValue,
                modifiedByMeTime: new Date().toISOString(),
              }
            : item,
        ),
      );
    } catch (err) {
      showError(err.message);
    } finally {
      setIsRenameLoading(false);
    }
  }
  async function handleToggleStar(items) {
    showError("");
    try {
      await Promise.all(
        items.map((item) => {
          const type = item.isDirectory ? "folder" : "file";
          setIsStarred((prev) => ({
            ...prev,
            [item._id]: !prev[item._id],
          }));
          return toggleItemStar(item._id, type);
        }),
      );
      if (isStarredRoute) {
        const starredIds = new Set(items.map((item) => item.id ?? item._id));
        setDirectoriesList((prev) =>
          prev.filter((item) => !starredIds.has(item.id ?? item._id)),
        );
        setFilesList((prev) =>
          prev.filter((item) => !starredIds.has(item.id ?? item._id)),
        );
      }
      const areAllFiles = items.every((item) => !item.isDirectory);
      const areAllFolders = items.every((item) => item.isDirectory);
      const areAllCurrentlyStarred = items.every((item) => isStarred[item._id]);

      const count = items.length;

      const noun = areAllFiles ? "file" : areAllFolders ? "folder" : "item";

      const action = areAllCurrentlyStarred ? "removed from" : "added to";

      toast({
        message: `${count} ${noun}${count === 1 ? "" : "s"} ${action} starred`,
        type: "success",
        undoAction: {
          type: "star",
          items,
          onUndo: async () => {
            await handleUndo({
              type: "star",
              items,
            });
          },
        },
      });
    } catch (error) {
      showError(error.message);
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
      const response = await fetch(`${BASE_URL}/directory/${fileId}/download`, {
        credentials: "include",
        signal: controller.signal,
      });

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
        const url = `${BASE_URL}/auth/google-drive/download?fileId=${item.id}`;
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
      window.location.href = `${BASE_URL}/file/${item._id}?action=download`;
    } catch (err) {
      showError(err.message);
    }
  }

  const handleToggleResourcePublic = async (item, role, access) => {
    setIsShareLoading(true);
    try {
      const publicPermission = peopleWithAccess.find(
        (p) => p.type === "anyone",
      );
      const currentAccess = publicPermission ? "anyone" : "restricted";
      if (currentAccess === access) {
        if (access === "restricted") return;

        if (
          (DRIVE_ROLES[publicPermission?.role] || publicPermission?.role) ===
          (DRIVE_ROLES[role] || role)
        )
          return;
      }

      const itemId = item._id ?? item.id;
      const type = getResourceType(item);

      const restricted = access === "restricted";
      const userRole = DRIVE_ROLES[role] ?? "reader";

      const iconType =
        (item.isDirectory ??
        item.mimeType === "application/vnd.google-apps.folder")
          ? null
          : getFileType(item?.name || "");

      let permission = null;
      let isMe;
      let myRole;
      let incomingPublicRole;
      let updatedParentId;

      if (isGoogleDriveRoute) {
        if (restricted) {
          const dryRun = await revokeFileAccess(
            "google",
            itemId,
            "anyoneWithLink",
          );
          if (dryRun?.needsConfirmation) {
            const { ancestorId, ancestorName, previousRole } = dryRun.conflict;
            updatedParentId = ancestorId;
            const chain = [
              {
                id: ancestorId,
                name: ancestorName,
                fromLabel: `Anyone with the link → ${previousRole}`,
                toLabel: "restricted",
                isDirectory: true,
                iconType: null,
              },
              {
                id: itemId,
                name: item.name,
                fromLabel: `Anyone with the link → ${userRole}`,
                toLabel: "restricted",
                isDirectory:
                  item.isDirectory ||
                  item.mimeType === "application/vnd.google-apps.folder",
                iconType,
              },
            ];

            const confirmed = await showCascadeConfirm(chain);

            if (!confirmed) {
              const currentPublicRole = publicPermission?.role;
              setLinkAccess(currentPublicRole ? "anyone" : "restricted");
              setLinkRole(currentPublicRole || "reader");
              setPeopleWithAccess(prevPermissions);
              return;
            }

            await revokeFileAccess(
              "google",
              itemId,
              "anyoneWithLink",
              null,
              true,
            );
          }
        } else {
          const dryRun = await toggleDriveFilePermission(itemId, userRole);

          if (dryRun?.needsConfirmation) {
            const { ancestorId, ancestorName, ancestorRole } = dryRun.conflict;
            updatedParentId = ancestorId;

            const chain = [
              {
                id: ancestorId,
                name: ancestorName,
                fromLabel: `Anyone with the link → ${ancestorRole}`,
                toLabel: userRole,
              },
              {
                id: itemId,
                name: item.name,
                fromLabel: `Anyone with the link → ${userRole}`,
                toLabel: userRole,
              },
            ];

            const confirmed = await showCascadeConfirm(chain);

            if (!confirmed) {
              const currentPublicRole = publicPermission?.role;
              setLinkAccess(currentPublicRole ? "anyone" : "restricted");
              setLinkRole(currentPublicRole || "reader");
              setPeopleWithAccess(prevPermissions);
              return;
            }

            const data = await toggleDriveFilePermission(
              itemId,
              userRole,
              true,
            );
            permission = data.permission;
          } else {
            permission = dryRun.permission;
          }
        }
      } else {
        const incomingRole = peopleWithAccess.find(
          (p) => p.emailAddress === user.email,
        );

        const isOwnerViewing = item.owners?.some(
          (o) => o.emailAddress === user.email,
        );

        isMe = incomingRole
          ? (incomingRole?.email ?? incomingRole.emailAddress) === user.email
          : !isOwnerViewing;
        myRole = incomingRole?.role;
        incomingPublicRole = DRIVE_ROLES[role] || role;

        let confirmCascade = false;

        const dryRun = await toggleFilePublic(itemId, userRole, access, type);

        if (dryRun?.needsConfirmation) {
          const { ancestorId, ancestorName, ancestorRole } = dryRun.conflict;
          updatedParentId = ancestorId;

          const isRestricting = access === "restricted";
          const chainIconType = item.isDirectory
            ? null
            : getFileType(item?.name || "");

          const chain = [
            {
              id: ancestorId,
              name: ancestorName,
              fromLabel: `Anyone with the link → ${ancestorRole}`,
              toLabel: isRestricting ? "Restricted" : DRIVE_ROLES[role] || role,
              isDirectory: true,
              iconType: null,
            },
            {
              id: itemId,
              name: item.name,
              fromLabel: `Anyone with the link → ${DRIVE_ROLES[publicPermission?.role] || publicPermission?.role}`,
              toLabel: isRestricting ? "Restricted" : DRIVE_ROLES[role] || role,
              isDirectory: item.isDirectory,
              iconType: chainIconType,
            },
          ];

          const confirmed = await showCascadeConfirm(chain);
          if (!confirmed) {
            const currentPublicRole = publicPermission?.role;
            setLinkAccess(currentPublicRole ? "anyone" : "restricted");
            setLinkRole(currentPublicRole || "reader");
            setPeopleWithAccess(prevPermissions);
            return;
          }

          confirmCascade = true;
        }

        if (
          ((incomingPublicRole === "reader" || access === "restricted") &&
            myRole === "reader" &&
            isMe) ||
          ((incomingPublicRole === "reader" ||
            incomingPublicRole === "writer") &&
            myRole === "remove" &&
            isMe)
        ) {
          const confirmed = await showConfirmModal(
            "You will not be able to share. Are you sure?",
          );
          if (!confirmed) {
            const currentPublicRole = publicPermission?.role;
            setLinkAccess(currentPublicRole ? "anyone" : "restricted");
            setLinkRole(currentPublicRole || "reader");
            setPeopleWithAccess(prevPermissions);
            return;
          }
        }
        if (
          access === "restricted" &&
          (myRole === undefined || myRole === "remove") &&
          isMe
        ) {
          const confirmed = await showConfirmModal(
            "You will no longer have access. Are you sure?",
          );
          if (!confirmed) {
            const currentPublicRole = prevPermissions.find(
              (p) => p.type === "anyone",
            )?.role;

            setLinkAccess("anyone");
            setLinkRole(currentPublicRole);
            setPeopleWithAccess(prevPermissions);

            return;
          }
        }

      
        if (confirmCascade) {
          await toggleFilePublic(itemId, userRole, access, type, true);
        }
      }

      const allIdsToBeMatched = [
        updatedParentId,
        itemId,
        ...(isGoogleDriveRoute ? (item.childrenIds ?? []) : []),
      ].filter(Boolean);

      const update = (list) =>
        restricted && (myRole === "remove" || myRole === undefined) && isMe
          ? list.filter((resource) => {
              const resourceId = String(resource?.id ?? resource?._id);
              const parentDirId = String(
                resource?.parentDirId ?? resource?.parents?.[0],
              );

              return (
                !allIdsToBeMatched.includes(resourceId) &&
                !allIdsToBeMatched.includes(parentDirId)
              );
            })
          : list.map((resource) => {
              const resourceId = String(resource?._id ?? resource?.id);
              const parentDirId = String(
                resource?.parentDirId ?? resource?.parents?.[0],
              );

              if (
                !allIdsToBeMatched.includes(resourceId) &&
                !allIdsToBeMatched.includes(parentDirId)
              ) {
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
                capabilities: {
                  ...resource.capabilities,
                  canShare: isMe
                    ? incomingPublicRole !== "reader" || myRole !== "reader"
                    : true,
                },
                isPublic: restricted ? false : true,
                publicRole: restricted ? null : userRole,
                permissions: updatedPermissions,
              };
            });

      setFilesList((prev) => update(prev));
      setDirectoriesList((prev) => update(prev));

      const updatedPeopleWithAccess = peopleWithAccess
        .map((p) => {
          if (p?.role === "remove" && incomingPublicRole === "writer") {
            return null;
          }

          if (access === "restricted" && p?.type === "anyone") {
            return null;
          }

          if (access === "anyone" && p?.type === "anyone") {
            return {
              ...p,
              id: "anyoneWithLink",
              type: "anyone",
              role: DRIVE_ROLES[role] ?? role,
            };
          }

          return p;
        })
        .filter(Boolean);

      if (
        access === "anyone" &&
        !updatedPeopleWithAccess.some((p) => p?.type === "anyone")
      ) {
        updatedPeopleWithAccess.push({
          id: "anyoneWithLink",
          type: "anyone",
          role: DRIVE_ROLES[role] ?? role,
          allowFileDiscovery: false,
        });
      }

      setPeopleWithAccess(updatedPeopleWithAccess);

      setLinkAccess(restricted ? "restricted" : "anyone");
      setLinkRole(restricted ? "reader" : userRole);

      if (myRole === "remove") {
        const personsToRemove = peopleWithAccess.filter(
          (person) => person?.role === "remove",
        );
        const removeType = item.isDirectory ? "folder" : "file";
        const message = await Promise.all(
          personsToRemove.map((person) =>
            revokeFileAccess(removeType, itemId, person.id, person.role),
          ),
        );
        if (incomingPublicRole === "reader") {
          const update = (list) =>
            access === "restricted"
              ? list.filter(
                  (resource) =>
                    (resource.id ?? resource._id) !== (item._id ?? item.id),
                )
              : list.map((resource) => {
                  const resourceId = String(resource?._id ?? resource?.id);
                  if (resourceId !== String(item._id ?? item.id)) {
                    return resource;
                  }
                  return {
                    ...resource,
                    capabilities: {
                      ...resource.capabilities,
                      canShare: false,
                      canRename: false,
                    },
                    permissions: updatedPeopleWithAccess,
                  };
                });
          if (removeType === "folder") {
            setDirectoriesList((prev) => update(prev));
          } else {
            setFilesList((prev) => update(prev));
          }
          setPeopleWithAccess(updatedPeopleWithAccess);
          setPrevPermissions(updatedPeopleWithAccess);
          setShareItem(null);
        }
        if (incomingPublicRole === "writer") {
          const update = (list) =>
            list.map((resource) => {
              const resourceId = String(resource?._id ?? resource?.id);
              if (resourceId !== String(item._id ?? item.id)) {
                return resource;
              }
              return {
                ...resource,
                permissions: updatedPeopleWithAccess,
              };
            });
          if (removeType === "folder") {
            setDirectoriesList((prev) => update(prev));
          } else {
            setFilesList((prev) => update(prev));
          }
          setPeopleWithAccess(updatedPeopleWithAccess);
          setPrevPermissions(updatedPeopleWithAccess);
          setShareItem((prev) => ({
            ...prev,
            permissions: updatedPeopleWithAccess,
          }));
        }
        toast({
          message,
          type: "success",
        });
        return;
      }

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

  const handleSharedRoleUpdate = async (item, type, message) => {
    setIsShareLoading(true);
    const itemId = item._id ?? item.id;

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

      const prevRole = previousEditablePermissions.find(
        (p) => p.emailAddress === userRole.emailAddress,
      )?.role;

      const incomingRole = newPermissions.find(
        (p) => p.emailAddress === userRole.emailAddress,
      );

      console.log("incomingROle", incomingRole);
      const myRole = incomingRole?.role;

      const isMe = incomingRole
        ? (incomingRole?.emailAddress ?? incomingRole.emailAddress) ===
          user.email
        : false;
      console.log("isMe", isMe);
      const publicRole = linkRole;

      let confirmCascade = false;

      let updatedParentId;

      const dryRun = await updateSharedAccess({
        item,
        type,

        peopleWithAccess: newPermissions,

        prevPermissions: previousEditablePermissions,

        message,

        grantAccessById,

        revokeFileAccess,

        confirmCascade,
      });

      if (!dryRun?.changed) {
        setShareItem(null);
        return;
      }

      if (dryRun?.response?.needsConfirmation) {
        const { ancestorId, ancestorName, previousRole, requestedRole } =
          dryRun.response.conflict[0] || dryRun.response.conflict;
        updatedParentId = ancestorId;
        const iconType =
          (item.isDirectory ??
          item.mimeType === "application/vnd.google-apps.folder")
            ? null
            : getFileType(item?.name || "");

        const chain = [
          {
            id: ancestorId,
            name: ancestorName,
            fromLabel: `${previousRole}`,
            toLabel: ` → ${DRIVE_ROLES[requestedRole] || requestedRole || "remove"}`,
            isDirectory: true,
            iconType: null,
          },
          {
            id: dryRun.itemId,
            name: item.name,
            fromLabel: `${DRIVE_ROLES[prevRole] || prevRole}`,
            toLabel: ` → ${DRIVE_ROLES[myRole] || myRole}`,
            isDirectory:
              item.isDirectory ||
              item.mimeType === "application/vnd.google-apps.folder",
            iconType,
          },
        ];
        const publicPermission = peopleWithAccess.find(
          (p) => p.type === "anyone",
        );
        const confirmed = await showCascadeConfirm(chain);
        if (!confirmed) {
          const currentPublicRole = publicPermission?.role;
          setLinkAccess(currentPublicRole ? "anyone" : "restricted");
          setLinkRole(currentPublicRole || "reader");
          setPeopleWithAccess(prevPermissions);
          return;
        }

        confirmCascade = true;
      }

      if (
        publicRole &&
        publicRole === "reader" &&
        myRole === "reader" &&
        isMe
      ) {
        const confirmed = await showConfirmModal(
          "You will not be able to share. Are you sure?",
        );
        if (!confirmed) {
          setPeopleWithAccess(prevPermissions);
          return;
        }
      }
      if (linkAccess === "restricted" && myRole === "remove" && isMe) {
        const confirmed = await showConfirmModal(
          "You will no longer have access. Are you sure?",
        );
        if (!confirmed) {
          setPeopleWithAccess(prevPermissions);
          return;
        }
      }
      if (confirmCascade) {
        const result = await updateSharedAccess({
          item,
          type,

          peopleWithAccess: newPermissions,

          prevPermissions: previousEditablePermissions,

          message,

          grantAccessById,

          revokeFileAccess,

          confirmCascade,
        });

        if (!result?.changed) {
          setShareItem(null);
          return;
        }
      }

      const updatedPeopleWithAccess = peopleWithAccess
        .map((p) => {
          const isRemoved = p.role === "remove";
          if (isRemoved) {
            return null;
          }
          const isPublic = p.type === "anyone";
          if (isPublic) {
            return {
              ...p,
              role: linkRole,
            };
          }
          return p;
        })
        .filter(Boolean);
      console.log("updatedParentId", updatedParentId);
      const allIdsToBeMatched = [
        updatedParentId,
        itemId,
        ...(isGoogleDriveRoute ? (item.childrenIds ?? []) : []),
      ].filter(Boolean);

      console.log("parentChildids", allIdsToBeMatched);

      const update = (list) =>
        linkAccess === "restricted" && myRole === "remove" && isMe
          ? list.filter((resource) => {
              console.log("resource?.parentDirId", resource?.parentDirId);
              const resourceId = String(resource?.id ?? resource?._id);
              const parentDirId = String(
                resource?.parentDirId ?? resource?.parents?.[0],
              );

              return (
                !allIdsToBeMatched.includes(resourceId) &&
                !allIdsToBeMatched.includes(parentDirId)
              );
            })
          : list.map((resource) => {
              console.log({
                allIdsToBeMatched,
                resource,
              });
              const resourceId = String(resource?._id ?? resource?.id);
              const parentDirId = String(
                resource?.parentDirId ?? resource?.parents?.[0],
              );

              if (
                !allIdsToBeMatched.includes(resourceId) &&
                !allIdsToBeMatched.includes(parentDirId)
              ) {
                return resource;
              }

              return {
                ...resource,
                capabilities: {
                  ...resource.capabilities,
                  canShare: isMe
                    ? publicRole !== "reader" || myRole !== "reader"
                    : true,
                  canRename: isMe
                    ? publicRole !== "reader" || myRole !== "reader"
                    : true,
                },
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
      (item) => (item.id || item._id) === (sourceItem.id || sourceItem._id),
    );

    if (index === -1) return [...items, newItem];

    return [...items.slice(0, index), newItem, ...items.slice(index)];
  };
  async function handleCopyItem(item) {
    const type = item.isDirectory ? "folder" : "file";
    const providerType = item.webViewLink ? "google" : "local";

    try {
      const {
        message,
        data: { copiedItem, owners, capabilities, permissions },
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
        setDirectoriesList((prev) => insertBefore(prev, item, newItem));
      } else {
        setFilesList((prev) => insertBefore(prev, item, newItem));
      }
    } catch (error) {
      showError(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to copy item",
      );
    }
  }

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };
  const headerColumns =
    isHomeRoute || isGoogleDriveRoute || route === undefined
      ? [
          { label: "Name", key: "name" },
          { label: "Owner", key: null },
          { label: "Date modified", key: "modifiedTime" },
          { label: "File size", key: null },
        ]
      : isTrashRoute
        ? [
            { label: "Name", key: "name" },
            { label: "Owner", key: null },
            { label: "Date trashed", key: "trashedTime" },
            { label: "File size", key: null },
            { label: "Original Location", key: null },
          ]
        : isSharedRoute
          ? [
              { label: "Name", key: "name" },
              { label: "Shared By", key: null },
              { label: "Date Shared", key: "sharedWithMeTime" },
            ]
          : isRecentRoute
            ? [
                { label: "Name", key: null },
                { label: "", key: null },
                { label: "Owner", key: null },
                { label: "File size", key: null },
                { label: "Location", key: null },
              ]
            : [
                { label: "Name", key: null },
                { label: "Owner", key: null },
                { label: "Last modified", key: null },
                { label: "File size", key: null },
                { label: "Location", key: null },
              ];

  const listHeaderRow = (
    <div
      className={`gd-list-header ${route === "home" || route === "google-drive" || route === undefined ? "five-columns" : route === "shared" ? "four-columns" : "six-columns"} md:text-[11px]`}
    >
      {headerColumns.map((column, index) => (
        <span
          key={index}
          onClick={() => column.key && handleSort(column.key)}
          className={column.key ? "sortable-column" : "py-0 px-1.5"}
        >
          {column.label}
          {sortConfig.key === column.key &&
            (sortConfig.direction === "asc" ? (
              <div className="flex items-center justify-center w-6 h-6 bg-(--accent-blue-light) rounded-full ml-1">
                <ArrowUpIcon className="text-[#06062f] w-5 h-5" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-6 h-6 bg-(--accent-blue-light) rounded-full ml-1">
                <ArrowDownIcon className="text-[#06062f] w-5 h-5" />
              </div>
            ))}
        </span>
      ))}

      {!isRecentRoute && (
        <SortButton sortConfig={sortConfig} setSortConfig={setSortConfig} />
      )}
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
  let CREATE_MENU_WIDTH = 180;
  const handleCreateNewMenu = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    const spaceLeft = e.clientX;
    const spaceRight = window.innerWidth - e.clientX;

    let left = false;
    let x = e.clientX;

    if (spaceRight >= CREATE_MENU_WIDTH) {
      left = false;
      x = e.clientX;
    } else if (spaceLeft >= CREATE_MENU_WIDTH) {
      left = true;
      x = e.clientX - CREATE_MENU_WIDTH;
    } else {
      left = spaceLeft > spaceRight;
      x = left ? 0 : e.clientX;
    }

    setShowCreateMenu(true);
    setCreateMenuPos({ x, y: e.clientY });
  }, []);

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
      {cascadeModal && (
        <CascadeConfirmationModal
          chain={cascadeModal.chain}
          onCancel={handleCascadeCancel}
          onConfirm={handleCascadeConfirm}
          isFetching={isShareLoading}
        />
      )}
      {confirmModal.open && (
        <ConfirmationModal
          open={confirmModal.open}
          title={confirmModal.message}
          action_1="Yes"
          action_2="No"
          onAction_1={handleConfirm}
          onAction_2={handleCancel}
        />
      )}

      {showDrivePicker && (
        <GDrivePicker
          enqueueItem={enqueueItem}
          setItemProgress={setItemProgress}
          completeItem={completeItem}
          handleCancelUpload={handleCancelUpload}
          setDbFileId={setDbFileId}
          refreshCurrentDirectory={refreshCurrentDirectory}
          onClose={() => setShowDrivePicker(false)}
          open={showDrivePicker}
          setOpen={setShowDrivePicker}
          showError={showError}
        />
      )}
      <CreateMenu
        menuRef={mainRef}
        open={showCreateMenu}
        setOpen={setOpen}
        position={createMenuPos}
        onClose={() => setShowCreateMenu(false)}
        onCreateFolder={() => setShowCreateDir(true)}
        onUploadFiles={() => fileInputRef.current?.click()}
        onUploadFolders={() => folderInputRef.current?.click()}
        onUploadFromDrive={() => setShowDrivePicker(true)}
        disabled={isUploading}
      />

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
            onContextMenu={(e) => handleCreateNewMenu(e)}
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
            {moveItem && (
              <MoveModal
                currentDirId={dirId}
                item={moveItem}
                route={route}
                setDirectoriesList={setDirectoriesList}
                setFilesList={setFilesList}
                onClose={() => setMoveItem(null)}
                open={Boolean(moveItem)}
              />
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
                    items={isRecentRoute ? filteredFiles : combinedItems}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    isRecentRoute={isRecentRoute}
                    viewMode={viewMode}
                    selectedItems={selectedItems}
                    onSelect={handleSelect}
                    onRowClick={handleRowClick}
                    onDoubleClick={handleRowDoubleClick}
                    onShare={(itemId) => {
                      const item = combinedItems.find(
                        (i) => (i.id ?? i._id) === itemId,
                      );
                      if (item) setShareItem(item);
                    }}
                    onRename={(itemId) => {
                      const item = combinedItems.find(
                        (i) => (i.id ?? i._id) === itemId,
                      );
                      if (item) openRename(item);
                    }}
                    onDownload={(itemId) => {
                      const item = combinedItems.find(
                        (item) => (item.id ?? item._id) === itemId,
                      );
                      if (!item) return;
                      if (item && item.isDirectory) {
                        handleDownloadFolder(item);
                      } else {
                        handleDownload(item);
                      }

                      clearSelection();
                    }}
                    onContextMenu={handleContextMenu}
                    listHeaderRow={listHeaderRow}
                    isStarred={isStarred}
                    setIsStarred={setIsStarred}
                    route={route}
                    combinedItems={combinedItems}
                    onStar={async (itemId) => {
                      const items = combinedItems.filter(
                        (item) => (item.id ?? item._id) === itemId,
                      );

                      if (!items.length) return;

                      await handleToggleStar(items);
                    }}
                  />
                ) : (
                  <DefaultView
                    isGoogleDrive={isGoogleDrive}
                    isHomeRoute={isHomeRoute}
                    items={combinedItems}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    viewMode={viewMode}
                    dirId={dirId}
                    selectedItems={selectedItems}
                    onSelect={handleSelect}
                    onRowClick={handleRowClick}
                    onDoubleClick={handleRowDoubleClick}
                    onShare={(itemId) => {
                      const item = combinedItems.find(
                        (i) => (i.id ?? i._id) === itemId,
                      );
                      if (item) setShareItem(item);
                    }}
                    onRename={(itemId) => {
                      const item = combinedItems.find(
                        (i) => (i.id ?? i._id) === itemId,
                      );
                      if (item) openRename(item);
                    }}
                    onDownload={(itemId) => {
                      const item = combinedItems.find(
                        (item) => (item.id ?? item._id) === itemId,
                      );
                      if (!item) return;
                      if (item && item.isDirectory) {
                        handleDownloadFolder(item);
                      } else {
                        handleDownload(item);
                      }

                      clearSelection();
                    }}
                    onContextMenu={handleContextMenu}
                    listHeaderRow={listHeaderRow}
                    isStarred={isStarred}
                    setIsStarred={setIsStarred}
                    route={route}
                    combinedItems={combinedItems}
                    onStar={async (itemId) => {
                      const items = combinedItems.filter(
                        (item) => (item.id ?? item._id) === itemId,
                      );

                      if (!items.length) return;

                      await handleToggleStar(items);
                    }}
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
        route={route}
        onClear={() => {
          clearSelection();
          setContextItem(null);
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
        onTrash={async () => {
          const items = combinedItems.filter((item) =>
            selectedItems.has(item.id ?? item._id),
          );

          if (!items.length) return;
          await handleMoveToTrash(items);
        }}
        onRestore={async () => {
          const items = combinedItems.filter((item) =>
            selectedItems.has(item.id ?? item._id),
          );
          if (!items.length) return;
          await handleRestoreItem(items);
        }}
        onDeleteForever={async (type) => {
          const items = combinedItems.filter((item) =>
            selectedItems.has(item.id ?? item._id),
          );
          if (!items.length) return;
          await handleDelete(items, type);
        }}
      />

      <ContextMenu
        open={open}
        openLeft={openLeft}
        setShowCreateMenu={setShowCreateMenu}
        item={contextItem}
        position={contextPos}
        route={route}
        isStarred={isStarred}
        dirId={dirId}
        viewMode={viewMode}
        setContextItem={setContextItem}
        onClose={() => {
          setOpen(false);
          setContextItem(null);
          clearSelection();
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
        onMove={(itemId) => {
          const item = combinedItems.find((i) => (i.id ?? i._id) === itemId);
          if (item) setMoveItem(item);
        }}
        onStar={async () => {
          const items = combinedItems.filter((item) =>
            selectedItems.has(item.id ?? item._id),
          );
          if (!items.length) return;
          await handleToggleStar(items);
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
        onTrash={async () => {
          const items = combinedItems.filter((item) =>
            selectedItems.has(item.id ?? item._id),
          );

          if (!items.length) return;
          await handleMoveToTrash(items);
        }}
        onRestore={async () => {
          const items = combinedItems.filter((item) =>
            selectedItems.has(item.id ?? item._id),
          );
          if (!items.length) return;
          await handleRestoreItem(items);
        }}
        onDeleteForever={async (type) => {
          const items = combinedItems.filter((item) =>
            selectedItems.has(item.id ?? item._id),
          );
          if (!items.length) return;
          await handleDelete(items, type);
        }}
        onPreview={(item) => setViewItem(item)}
      />

      {viewItem && (
        <FileViewer
          key={viewItem._id}
          item={viewItem}
          isStarred={isStarred}
          onClose={() => setViewItem(null)}
          isSharedRoute={isSharedRoute}
          files={filteredFiles}
          onNavigate={(item) => setViewItem(item)}
          onStar={async () => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );
            if (!items.length) return;
            await handleToggleStar(items);
          }}
          onShare={() => {
            const id = [...selectedItems][0];
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) setShareItem(item);
          }}
          onRename={() => {
            selectedItems.forEach((id) => {
              const item = combinedItems.find((i) => (i.id ?? i._id) === id);
              if (item) openRename(item);
            });
          }}
          onTrash={async () => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );
            if (!items.length) return;
            await handleMoveToTrash(items);
          }}
          onDeleteForever={async (type) => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );
            if (!items.length) return;
            await handleDelete(items, type);
          }}
          onRestore={async () => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );
            if (!items.length) return;
            await handleRestoreItem(items);
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
          setUserRole={setUserRole}
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
