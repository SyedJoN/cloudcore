import "../Styles/DirectoryView.css";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import {
  DriveHeader,
  DriveSidebar,
  DriveBottomBar,
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
import { useDevice } from "../Contexts/DeviceContext";
import MobileContextMenu from "../Components/Drive/MobileContextMenu";
import FileViewerMobile from "../Components/File/FileViewerMobile";
import DriveTopBarMobile from "../Components/Drive/DriveTopbarMobile";
import MobileMoveModal from "../Components/Modals/MobileMoveModal";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function DirectoryView({ route }) {
  const { breadcrumbs, setBreadcrumbs } = useBreadcrumb();
  const { device } = useDevice();
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
    [location.search],
  );
  const grantRole = useMemo(
    () => new URLSearchParams(location.search).get("role"),
    [location.search],
  );

  const isHomeRoute = route === "home" || params.get("usp") === "drive_link";
  const isSharedRoute = route === "shared";
  const isTrashRoute = route === "trash";
  const isGoogleDriveRoute = route === "google-drive" && isGoogleDrive;
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
  const [isActionLoading, setIsActionLoading] = useState(false);
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [inDirectory, setInDirectory] = useState(false);
  const [mobileHeaderDirName, setMobileHeaderDirName] = useState("");
  const [animate, setAnimate] = useState(false);

  const restartAnimation = () => {
    setAnimate(false);

    requestAnimationFrame(() => {
      setAnimate(true);
    });
  };

  useEffect(() => {
    if (location.pathname.startsWith("/directory") && device === "mobile") {
      setAnimate(true);
      setInDirectory(true);
    } else {
      setInDirectory(false);
    }
  }, [location.pathname, device]);

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
        if (!isTrashRoute) {
          setDirectoriesList((prev) => [...prev, ...folders]);

          setFilesList((prev) => [...prev, ...files]);
        }
      }
      if (undoAction.type === "restore") {
        await handleMoveToTrash(items);
        const folders = items.filter((item) => item.isDirectory);
        const files = items.filter((item) => !item.isDirectory);

        if (isTrashRoute) {
          setDirectoriesList((prev) => [...prev, ...folders]);
          setFilesList((prev) => [...prev, ...files]);
        }
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
    lastDirectory,
    setLastDirectory,
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

  const [path, setPath] = useState([]);
  const refreshCurrentDirectory = (type = "") =>
    getDirectoryItems(
      type === "google" || isGoogleDrive
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
    setSelectedItems,
    contextItem,
    setContextItem,
    contextPos,
    openLeft,
    dragBox,
    handleSelect,
    handleSelectAll,
    clearSelection,
    handleContextMenu,
    open,
    setOpen,
    handleMainMouseDown,
    handleMainMouseMove,
    handleMainMouseUp,
  } = useSelectionAndContextMenu({ combinedItems, mainRef, lastDirectory });

  useEffect(() => {
    if (selectedItems.size === 0) {
      setSelectionMode(false);
    }
  }, [selectedItems]);
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
  }, [isGoogleDrive, isGoogleDriveRoute]);

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
            provider: u.provider,
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

  const handleRowDoubleClick = async (type, id, name) => {
    if (type === "google-directory") {
      window.open(`https://drive.google.com/drive/folders/${id}`, "_blank");
      return;
    }
    if (type === "directory") {
      navigate(`/directory/${id}`, {
        state: { dirContext: previousDirContext.current },
      });
      if (device === "mobile") {
        setPath((prev) => [...prev, { id, name }]);
        restartAnimation();
        setMobileHeaderDirName(name);
      }
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

      const fileIds = items.filter((i) => !i.isDirectory).map((i) => i._id);
      const dirIds = items.filter((i) => i.isDirectory).map((i) => i._id);

      const responses = await Promise.all([
        fileIds.length ? softDeleteFile("/file/soft-delete", fileIds) : null,
        dirIds.length ? softDeleteFile("/directory/soft-delete", dirIds) : null,
      ]);

      const trashedIds = new Set(
        responses.filter(Boolean).flatMap((r) => r.trashedIds),
      );
      const trashed = items.filter((i) => trashedIds.has(String(i._id)));

      if (trashed.length) {
        await refreshUser();

        const noun = trashed.every((i) => !i.isDirectory)
          ? "file"
          : trashed.every((i) => i.isDirectory)
            ? "folder"
            : "item";
        const count = trashed.length;

        toast({
          message: `${count} ${noun}${count === 1 ? "" : "s"} moved to trash`,
          type: "success",
          duration: 5000,
          undoAction: {
            type: "trash",
            items: trashed,
            onUndo: () => handleUndo({ type: "trash", items: trashed }),
          },
        });

        setDirectoriesList((prev) =>
          prev.filter((i) => !trashedIds.has(String(i._id))),
        );
        setFilesList((prev) =>
          prev.filter((i) => !trashedIds.has(String(i._id))),
        );
      }

      if (trashed.length < items.length) {
        showError(
          `${items.length - trashed.length} item(s) couldn't be moved to trash`,
        );
      }

      clearSelection();
    } catch (err) {
      if (err.response?.status === 429) {
        showError("Too many requests. Please slow down.");
        return;
      }
      showError(err.response?.data?.message ?? err.message);
    }
  }

  async function handleRestoreItem(items) {
    showError("");

    const fileIds = items.filter((i) => !i.isDirectory).map((i) => i._id);
    const dirIds = items.filter((i) => i.isDirectory).map((i) => i._id);

    // allSettled: if files fail (e.g. storage full) folders can still succeed
    const results = await Promise.allSettled([
      fileIds.length ? restoreFile("/file/restore", fileIds) : null,
      dirIds.length ? restoreFile("/directory/restore", dirIds) : null,
    ]);

    const restoredIds = new Set(
      results
        .filter((r) => r.status === "fulfilled" && r.value)
        .flatMap((r) => r.value.restoredIds.map(String)),
    );
    const restored = items.filter((i) =>
      restoredIds.has(String(i._id ?? i.id)),
    );

    if (restored.length) {
      await refreshUser();

      toast({
        message: `${restored.length} item${restored.length === 1 ? "" : "s"} restored`,
        type: "success",
        undoAction: {
          type: "restore",
          items: restored,
          onUndo: () => handleUndo({ type: "restore", items: restored }),
        },
      });

      setDirectoriesList((prev) =>
        prev.filter((i) => !restoredIds.has(String(i.id ?? i._id))),
      );
      setFilesList((prev) =>
        prev.filter((i) => !restoredIds.has(String(i.id ?? i._id))),
      );
    }

    // report the first failure, if any
    const failure = results.find((r) => r.status === "rejected");
    if (failure) {
      const status = failure.reason?.response?.status;
      if (status === 401) {
        navigate("/login");
        return;
      }
      showError(
        status === 507
          ? (failure.reason.response.data?.message ??
              "Free up space to restore these items.")
          : (failure.reason?.response?.data?.message ??
              failure.reason?.message),
      );
    }

    clearSelection();
  }
  async function handleDelete(items, type) {
    try {
      showError("");

      const fileIds = items
        .filter((i) => !i.isDirectory)
        .map((i) => i._id ?? i.id);

      const dirIds = items
        .filter((i) => i.isDirectory)
        .map((i) => i._id ?? i.id);

      const responses = await Promise.all([
        fileIds.length ? deleteFile(`/file?type=${type}`, fileIds, type) : null,

        dirIds.length ? deleteFile("/directory", dirIds) : null,
      ]);

      const deletedIds = new Set(
        responses.filter(Boolean).flatMap((r) => r.deletedIds ?? []),
      );

      const deleted = items.filter((i) =>
        deletedIds.has(String(i._id ?? i.id)),
      );

      if (deleted.length) {
        await refreshUser();

        const areAllFiles = deleted.every((i) => !i.isDirectory);
        const areAllFolders = deleted.every((i) => i.isDirectory);
        const noun = areAllFiles ? "file" : areAllFolders ? "folder" : "item";

        toast({
          message: `${deleted.length} ${noun}${deleted.length === 1 ? "" : "s"} deleted permanently`,
          type: "success",
        });

        setViewItem(null);

        setDirectoriesList((prev) =>
          prev.filter((i) => !deletedIds.has(String(i._id ?? i.id))),
        );

        setFilesList((prev) =>
          prev.filter((i) => !deletedIds.has(String(i._id ?? i.id))),
        );
      }

      if (deleted.length < items.length) {
        showError(
          `${items.length - deleted.length} item(s) couldn't be deleted`,
        );
      }

      clearSelection();
    } catch (err) {
      if (err.response?.status === 429) {
        showError("Too many requests. Please slow down.");
        return;
      }

      showError(err.response?.data?.message ?? err.message);
    }
  }
  async function handleCreateDirectory(e) {
    e.preventDefault();
    showError("");
    setIsActionLoading(true);

    const type = isGoogleDriveRoute ? "google" : "local";
    try {
      const response = await addDirectory(dirId, newDirname, type);
      setShowCreateDir(false);
      setNewDirname("Untitled folder");
      setDirectoriesList((prev) => [response.data, ...prev]);
    } catch (err) {
      showError(err.message);
    } finally {
      setIsActionLoading(false);
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
      setIsActionLoading(true);
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

      if (device === "mobile") {
        setPath((prev) =>
          prev.map((item) =>
            item.id === renameId ? { ...item, name: renameValue } : item,
          ),
        );
        setLastDirectory((prev) =>
          prev._id === renameId ? { ...prev, name: renameValue } : prev,
        );
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
      setIsActionLoading(false);
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
      let url;

      if (isGoogleDriveRoute) {
        url = `${BASE_URL}/auth/google-drive/download?fileId=${item.id}`;
      } else {
        url = `${BASE_URL}/file/${item._id}?action=download`;
      }

      const a = document.createElement("a");

      a.href = url;
      a.style.display = "none";

      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Download error:", err);
      showError(err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Put this OUTSIDE the component (module level)
  // Accepts UI keys ("viewer"/"editor") AND Drive keys ("reader"/"writer")
  // and always returns a Drive role: "reader" | "writer".
  // ─────────────────────────────────────────────────────────────
  const toDriveRole = (r) => {
    const mapped = DRIVE_ROLES[r] ?? r; // viewer->reader, editor->writer, writer->writer
    return mapped === "writer" ? "writer" : "reader";
  };

  const isAnyone = (p) => p?.type === "anyone";

  // ─────────────────────────────────────────────────────────────
  // Inside DirectoryView, replace the existing handler with this
  // ─────────────────────────────────────────────────────────────
  const handleToggleResourcePublic = async (item, role, access) => {
    setIsShareLoading(true);

    const isMultiShare = selectedItems.size > 1;

    try {
      const restricted = access === "restricted";
      const userRole = toDriveRole(role);

      // In multi mode `peopleWithAccess` is the COMMON permission set, so the
      // per-item permissions are the only correct source of truth there.
      const currentPermissions = isMultiShare
        ? (item.permissions ?? [])
        : peopleWithAccess;

      const publicPermission = currentPermissions.find(isAnyone);
      const currentAccess = publicPermission ? "anyone" : "restricted";
      const currentRole = publicPermission
        ? toDriveRole(publicPermission.role)
        : null;

      // Nothing to do
      if (currentAccess === access) {
        if (restricted) return;
        if (currentRole === userRole) return;
      }

      const itemId = item._id ?? item.id;
      const type = getResourceType(item);
      const isFolder =
        Boolean(item.isDirectory) ||
        item.mimeType === "application/vnd.google-apps.folder";
      const iconType = isFolder ? null : getFileType(item?.name || "");

      // Revert the modal UI when the user cancels a confirmation.
      // (Multi mode has no shared link state, so nothing to revert.)
      const revertLinkState = () => {
        if (isMultiShare) return;
        setLinkAccess(publicPermission ? "anyone" : "restricted");
        setLinkRole(currentRole || "reader");
        setPeopleWithAccess(prevPermissions);
      };

      const buildChain = ({
        ancestorId,
        ancestorName,
        ancestorRole,
        toLabel,
      }) => [
        {
          id: ancestorId,
          name: ancestorName,
          fromLabel: `Anyone with the link → ${ancestorRole}`,
          toLabel,
          isDirectory: true,
          iconType: null,
        },
        {
          id: itemId,
          name: item.name,
          fromLabel: `Anyone with the link → ${currentRole ?? "restricted"}`,
          toLabel,
          isDirectory: isFolder,
          iconType,
        },
      ];

      let permission = null;
      let isMe;
      let myRole;
      let updatedParentId;

      /* ───────────── Google Drive route ───────────── */
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

            const confirmed = await showCascadeConfirm(
              buildChain({
                ancestorId,
                ancestorName,
                ancestorRole: previousRole,
                toLabel: "restricted",
              }),
            );

            if (!confirmed) {
              revertLinkState();
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

            const confirmed = await showCascadeConfirm(
              buildChain({
                ancestorId,
                ancestorName,
                ancestorRole,
                toLabel: userRole,
              }),
            );

            if (!confirmed) {
              revertLinkState();
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
        /* ───────────── Local route ───────────── */
        const incomingRole = currentPermissions.find(
          (p) => p.emailAddress === user.email,
        );
        const isOwnerViewing = item.owners?.some(
          (o) => o.emailAddress === user.email,
        );

        isMe = incomingRole ? true : !isOwnerViewing;
        myRole = incomingRole?.role;

        // Will lose ability to share
        if (
          isMe &&
          (((userRole === "reader" || restricted) && myRole === "reader") ||
            myRole === "remove")
        ) {
          const confirmed = await showConfirmModal(
            "You will not be able to share. Are you sure?",
          );
          if (!confirmed) {
            revertLinkState();
            return;
          }
        }

        // Will lose all access
        if (
          restricted &&
          isMe &&
          (myRole === undefined || myRole === "remove")
        ) {
          const confirmed = await showConfirmModal(
            "You will no longer have access. Are you sure?",
          );
          if (!confirmed) {
            revertLinkState();
            return;
          }
        }

        let result = await toggleFilePublic(itemId, userRole, access, type);

        if (result?.needsConfirmation) {
          const { ancestorId, ancestorName, ancestorRole } = result.conflict;
          updatedParentId = ancestorId;

          const confirmed = await showCascadeConfirm(
            buildChain({
              ancestorId,
              ancestorName,
              ancestorRole,
              toLabel: restricted ? "Restricted" : userRole,
            }),
          );

          if (!confirmed) {
            revertLinkState();
            return;
          }

          result = await toggleFilePublic(itemId, userRole, access, type, true);
        }

        // Use the server permission (with its id) if the API returns one
        permission = result?.permission ?? null;
      }

      /* ───────────── Update lists ───────────── */
      const allIdsToBeMatched = [
        updatedParentId,
        itemId,
        ...(isGoogleDriveRoute ? (item.childrenIds ?? []) : []),
      ]
        .filter(Boolean)
        .map(String);

      const matches = (resource) => {
        const resourceId = String(resource?._id ?? resource?.id);
        const parentDirId = String(
          resource?.parentDirId ?? resource?.parents?.[0],
        );
        return (
          allIdsToBeMatched.includes(resourceId) ||
          allIdsToBeMatched.includes(parentDirId)
        );
      };

      const lostAccess =
        restricted && isMe && (myRole === "remove" || myRole === undefined);

      const applyLinkUpdate = (list) =>
        lostAccess
          ? list.filter((resource) => !matches(resource))
          : list.map((resource) => {
              if (!matches(resource)) return resource;

              const others = (resource.permissions ?? []).filter(
                (p) => !isAnyone(p),
              );

              return {
                ...resource,
                capabilities: {
                  ...resource.capabilities,
                  canShare: isMe
                    ? userRole !== "reader" || myRole !== "reader"
                    : true,
                },
                isPublic: !restricted,
                publicRole: restricted ? null : userRole,
                permissions: restricted
                  ? others
                  : [
                      ...others,
                      { ...(permission ?? {}), type: "anyone", role: userRole },
                    ],
              };
            });

      setFilesList(applyLinkUpdate);
      setDirectoriesList(applyLinkUpdate);

      /* ───────────── Update modal state (single mode only) ───────────── */
      const updatedPeopleWithAccess = peopleWithAccess
        .map((p) => {
          if (p?.role === "remove" && userRole === "writer") return null;
          if (restricted && isAnyone(p)) return null;
          if (!restricted && isAnyone(p)) {
            return {
              ...p,
              id: "anyoneWithLink",
              type: "anyone",
              role: userRole,
            };
          }
          return p;
        })
        .filter(Boolean);

      if (!restricted && !updatedPeopleWithAccess.some(isAnyone)) {
        updatedPeopleWithAccess.push({
          id: "anyoneWithLink",
          type: "anyone",
          role: userRole,
          allowFileDiscovery: false,
        });
      }

      if (!isMultiShare) {
        setPeopleWithAccess(updatedPeopleWithAccess);
        setPrevPermissions(updatedPeopleWithAccess); // keeps "Pending changes" from showing
        setLinkAccess(restricted ? "restricted" : "anyone");
        setLinkRole(restricted ? "reader" : userRole);
      }

      /* ───────────── User chose to drop their own "remove" pending change ───────────── */
      if (!isMultiShare && myRole === "remove") {
        const personsToRemove = peopleWithAccess.filter(
          (p) => p?.role === "remove",
        );
        const removeType = item.isDirectory ? "folder" : "file";

        const messages = await Promise.all(
          personsToRemove.map((person) =>
            revokeFileAccess(removeType, itemId, person.id, person.role),
          ),
        );

        const setList =
          removeType === "folder" ? setDirectoriesList : setFilesList;
        const sameItem = (resource) =>
          String(resource?._id ?? resource?.id) === String(itemId);

        if (userRole === "reader") {
          setList((prev) =>
            restricted
              ? prev.filter((r) => !sameItem(r))
              : prev.map((r) =>
                  sameItem(r)
                    ? {
                        ...r,
                        capabilities: {
                          ...r.capabilities,
                          canShare: false,
                          canRename: false,
                        },
                        permissions: updatedPeopleWithAccess,
                      }
                    : r,
                ),
          );
          setPeopleWithAccess(updatedPeopleWithAccess);
          setPrevPermissions(updatedPeopleWithAccess);
          setShareItem(null);
        } else {
          setList((prev) =>
            prev.map((r) =>
              sameItem(r) ? { ...r, permissions: updatedPeopleWithAccess } : r,
            ),
          );
          setPeopleWithAccess(updatedPeopleWithAccess);
          setPrevPermissions(updatedPeopleWithAccess);
          setShareItem((prev) =>
            Array.isArray(prev)
              ? prev
              : prev
                ? { ...prev, permissions: updatedPeopleWithAccess }
                : prev,
          );
        }

        toast({ message: messages, type: "success" }); // unchanged from original
        return;
      }

      toast({ message: "Public Access updated", type: "success" });
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
    let confirmCascade = false;

    let updatedParentId;

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

      const myRole = incomingRole?.role;

      const isMe = incomingRole
        ? (incomingRole?.emailAddress ?? incomingRole.emailAddress) ===
          user.email
        : false;
      const publicRole = linkRole;

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

      const allIdsToBeMatched = [
        updatedParentId,
        itemId,
        ...(isGoogleDriveRoute ? (item.childrenIds ?? []) : []),
      ].filter(Boolean);

      const update = (list) =>
        linkAccess === "restricted" && myRole === "remove" && isMe
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
  async function handleCopyItems(items) {
    try {
      showError("");

      const providerType = items.some((item) => item?.webViewLink)
        ? "google"
        : "local";

      const {
        message,
        data: { copiedItems },
      } = await copyItem({
        items,
        providerType,
      });

      toast({
        message,
        type: "success",
      });

      const isInsideItem =
        device === "mobile" &&
        items.some((item) => String(item._id) === String(lastDirectory?._id));

      if (isInsideItem) return;

      const newFolders = [];
      const newFiles = [];

      copiedItems.forEach((result, index) => {
        const item = items[index];
        const type = item.isDirectory ? "folder" : "file";

        const newItem = {
          ...result.copiedItem,
          owners: result.owners || [],
          capabilities: result.capabilities || {},
          permissions: result.permissions || [],
          sortName: item.name,
          sortModifiedTime: item.modifiedTime || item.updatedAt,
          isDirectory: type === "folder",
        };

        if (type === "folder") {
          newFolders.push(newItem);
        } else {
          newFiles.push(newItem);
        }
      });

      if (newFolders.length) {
        setDirectoriesList((prev) => [...newFolders, ...prev]);
      }

      if (newFiles.length) {
        setFilesList((prev) => [...newFiles, ...prev]);
      }
    } catch (error) {
      showError(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to copy items",
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
    return item && !item?.isDirectory;
  });

  const selectedId = [...selectedItems][0];

  const selectedItem =
    selectedItems.size === 1
      ? combinedItems.find((i) => (i.id ?? i._id) === selectedId) ||
        combinedItems.find(
          (i) => (i.parentDirId?.id ?? i.parentDirId?._id) === selectedId,
        )?.parentDirId
      : null;

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
      {device === "mobile" ? (
        <DriveTopBarMobile
          dirId={dirId}
          dirContext={dirContext}
          crumbs={crumbs}
          setCrumbs={setCrumbs}
          dirName={mobileHeaderDirName}
          handleSelect={handleSelect}
          path={path}
          setPath={setPath}
          inDirectory={inDirectory}
          setInDirectory={setInDirectory}
          restartAnimation={restartAnimation}
          disabled={isUploading}
          onShare={(itemId) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === itemId);
            if (item) setShareItem(item);
          }}
          onRename={(itemId) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === itemId);
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
        <DriveHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          disabled={isUploading}
        />
      )}

      <div
        className={`gd-body ${device === "mobile" ? "mobile" : ""} ${animate ? "animation" : ""}`}
      >
        {device === "windows" && user.email && (
          <DriveSidebar
            enqueueItem={enqueueItem}
            setItemProgress={setItemProgress}
            setDirectoriesList={setDirectoriesList}
            setFilesList={setFilesList}
            completeItem={completeItem}
            handleCancelUpload={handleCancelUpload}
            setDbFileId={setDbFileId}
            refreshCurrentDirectory={refreshCurrentDirectory}
            showError={showError}
            dirId={dirId}
            dirContext={dirContext}
            isGoogleDriveRoute={isGoogleDriveRoute}
            onCreateFolder={() => setShowCreateDir(true)}
            onUploadFiles={() => fileInputRef.current?.click()}
            onUploadFolders={() => folderInputRef.current?.click()}
          />
        )}
        <div
          className={`gd-main-container ${device === "mobile" ? "mobile" : ""}`}
        >
          <main
            style={{ userSelect: "none" }}
            ref={mainRef}
            className={`gd-main ${device === "mobile" ? "mobile" : ""}`}
            onMouseDown={handleMainMouseDown}
            onMouseMove={handleMainMouseMove}
            onMouseUp={handleMainMouseUp}
            onContextMenu={(e) => handleCreateNewMenu(e)}
            onMouseLeave={handleMainMouseUp}
          >
            {device === "windows" && (
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
            )}

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
                <IconInfo size={16} />
                {error?.message || String(error)}
              </div>
            )}
            {moveItem &&
              (device === "mobile" ? (
                <MobileMoveModal
                  currentDirId={dirId}
                  item={selectedItem}
                  items={combinedItems.filter((i) =>
                    selectedItems.has(i.id ?? i._id),
                  )}
                  route={route}
                  viewMode={viewMode}
                  onToggleView={() =>
                    setViewMode((v) => (v === "grid" ? "list" : "grid"))
                  }
                  sortConfig={sortConfig}
                  setSortConfig={setSortConfig}
                  setDirectoriesList={setDirectoriesList}
                  setFilesList={setFilesList}
                  onClose={() => setMoveItem(null)}
                />
              ) : (
                <MoveModal
                  currentDirId={dirId}
                  item={selectedItem}
                  items={combinedItems.filter((i) =>
                    selectedItems.has(i.id ?? i._id),
                  )}
                  route={route}
                  viewMode={viewMode}
                  onToggleView={() =>
                    setViewMode((v) => (v === "grid" ? "list" : "grid"))
                  }
                  sortConfig={sortConfig}
                  setSortConfig={setSortConfig}
                  setDirectoriesList={setDirectoriesList}
                  setFilesList={setFilesList}
                  onClose={() => setMoveItem(null)}
                />
              ))}

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
                    setSelectedItems={setSelectedItems}
                    isGoogleDrive={isGoogleDrive}
                    isHomeRoute={isHomeRoute}
                    items={combinedItems}
                    open={open}
                    setOpen={setOpen}
                    selectionMode={selectionMode}
                    setSelectionMode={setSelectionMode}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    viewMode={viewMode}
                    dirId={dirId}
                    selectedItems={selectedItems}
                    handleSelectAll={handleSelectAll}
                    onSelect={handleSelect}
                    onToggleView={() =>
                      setViewMode((v) => (v === "grid" ? "list" : "grid"))
                    }
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
                    setContextItem={setContextItem}
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
                    clearSelection={clearSelection}
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
      {device === "mobile" && (
        <DriveBottomBar
          enqueueItem={enqueueItem}
          setItemProgress={setItemProgress}
          completeItem={completeItem}
          handleCancelUpload={handleCancelUpload}
          setDbFileId={setDbFileId}
          refreshCurrentDirectory={refreshCurrentDirectory}
          showError={showError}
          dirId={dirId}
          isGoogleDriveRoute={isGoogleDriveRoute}
          dirContext={dirContext}
          onCreateFolder={() => setShowCreateDir(true)}
          onUploadFiles={() => fileInputRef.current?.click()}
          onUploadFolders={() => folderInputRef.current?.click()}
        />
      )}

      {showCreateDir && (
        <CreateDirectoryModal
          value={newDirname}
          setNewDirname={setNewDirname}
          onCreateDirectory={handleCreateDirectory}
          isDirectoryCreationLoading={isActionLoading}
          onClose={() => setShowCreateDir(false)}
        />
      )}

      {showRename && (
        <RenameModal
          isRenameLoading={isActionLoading}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onRenameSubmit={handleRenameSubmit}
          onClose={() => setShowRename(false)}
        />
      )}
      {device === "windows" && (
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
          onDownload={async () => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );

            if (!items.length && selectedItems.has(lastDirectory._id)) {
              items.push(lastDirectory);
            }

            if (!items.length) return;

            for (const item of items) {
              if (item.isDirectory) {
                await handleDownloadFolder(item);
              } else {
                handleDownload(item);
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            clearSelection();
          }}
          onCopy={() => {
            setContextItem(null);

            selectedItems.forEach((id) => {
              const item = combinedItems.find((i) => (i.id ?? i._id) === id);
              if (item) {
                handleCopyItems(item);
              }
            });
            clearSelection();
          }}
          onRename={() => {
            setContextItem(null);

            selectedItems.forEach((id) => {
              const item = combinedItems.find((i) => (i.id ?? i._id) === id);
              if (item) openRename(item);
            });
          }}
          onShare={() => {
            setContextItem(null);

            const id = [...selectedItems][0];
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) setShareItem(item);
          }}
          onTrash={async () => {
            setContextItem(null);

            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );

            if (!items.length) return;
            await handleMoveToTrash(items);
          }}
          onRestore={async () => {
            setContextItem(null);

            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );
            if (!items.length) return;
            await handleRestoreItem(items);
          }}
          onDeleteForever={async (type) => {
            setContextItem(null);

            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );
            if (!items.length) return;
            await handleDelete(items, type);
          }}
        />
      )}

      {contextItem &&
        (device === "mobile" ? (
          <MobileContextMenu
            open={open}
            openLeft={openLeft}
            setShowCreateMenu={setShowCreateMenu}
            item={contextItem}
            items={combinedItems.filter((i) =>
              selectedItems.has(i.id ?? i._id),
            )}
            position={contextPos}
            route={route}
            isStarred={isStarred}
            handleSelect={handleSelect}
            dirId={dirId}
            viewMode={viewMode}
            setContextItem={setContextItem}
            onClose={() => {
              setOpen(false);
            }}
            onDownload={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length && selectedItems.has(lastDirectory._id)) {
                items.push(lastDirectory);
              }

              if (!items.length) return;

              for (const item of items) {
                if (item.isDirectory) {
                  await handleDownloadFolder(item);
                } else {
                  handleDownload(item);
                }

                await new Promise((resolve) => setTimeout(resolve, 500));
              }

              if (selectionMode) setSelectionMode(false);
            }}
            onCopy={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length && selectedItems.has(lastDirectory._id)) {
                items.push(lastDirectory);
              }

              if (!items.length) return;

              await handleCopyItems(items);
              if (selectionMode) setSelectionMode(false);
            }}
            onMove={() => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length && selectedItems.has(lastDirectory._id)) {
                items.push(lastDirectory);
              }

              if (!items.length) return;

              setMoveItem(items);
              if (selectionMode) setSelectionMode(false);
            }}
            onStar={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (items.length === 0 && selectedItems.has(lastDirectory._id)) {
                items.push(lastDirectory);
              }

              if (items.length) await handleToggleStar(items);
            }}
            onRename={(item) => {
              if (item) openRename(item);
            }}
            onShare={() => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length && selectedItems.has(lastDirectory._id)) {
                items.push(lastDirectory);
              }

              if (items.length) setShareItem(items);
            }}
            onTrash={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length && selectedItems.has(lastDirectory._id)) {
                items.push(lastDirectory);
              }

              if (!items.length) return;

              await handleMoveToTrash(items);
              if (selectionMode) setSelectionMode(false);
            }}
            onRestore={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length && selectedItems.has(lastDirectory._id)) {
                items.push(lastDirectory);
              }

              if (!items.length) return;

              await handleRestoreItem(items);
              if (selectionMode) setSelectionMode(false);
            }}
            onDeleteForever={async (type) => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length && selectedItems.has(lastDirectory._id)) {
                items.push(lastDirectory);
              }

              if (!items.length) return;

              await handleDelete(items, type);
              if (selectionMode) setSelectionMode(false);
            }}
            onPreview={(item) => setViewItem(item)}
          />
        ) : (
          <ContextMenu
            open={open}
            openLeft={openLeft}
            setShowCreateMenu={setShowCreateMenu}
            item={selectedItem}
            items={combinedItems.filter((i) =>
              selectedItems.has(i.id ?? i._id),
            )}
            position={contextPos}
            route={route}
            isStarred={isStarred}
            dirId={dirId}
            viewMode={viewMode}
            setContextItem={setContextItem}
            onClose={() => {
              if (contextItem || open) {
                setOpen(false);
                setContextItem(null);
              }
            }}
            onDownload={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length) return;

              for (const item of items) {
                if (item.isDirectory) {
                  await handleDownloadFolder(item);
                } else {
                  handleDownload(item);
                }

                await new Promise((resolve) => setTimeout(resolve, 500));
              }

              clearSelection();
            }}
            onCopy={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length) return;

              await handleCopyItems(items);
              clearSelection();
            }}
            onMove={() => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length) return;

              setMoveItem(items);
            }}
            onStar={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (items.length) await handleToggleStar(items);
            }}
            onRename={() => {
              selectedItems.forEach((id) => {
                const item = combinedItems.find((i) => (i.id ?? i._id) === id);

                if (item) openRename(item);
              });
            }}
            onShare={() => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (!items.length && selectedItems.has(lastDirectory._id)) {
                items.push(lastDirectory);
              }

              if (items.length) setShareItem(items);
            }}
            onTrash={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (items.length) await handleMoveToTrash(items);
            }}
            onRestore={async () => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (items.length) await handleRestoreItem(items);
            }}
            onDeleteForever={async (type) => {
              const items = combinedItems.filter((item) =>
                selectedItems.has(item.id ?? item._id),
              );

              if (items.length) await handleDelete(items, type);
            }}
            onPreview={(item) => setViewItem(item)}
          />
        ))}

      {viewItem && device === "mobile" ? (
        <FileViewerMobile
          key={viewItem?._id}
          item={viewItem}
          isStarred={isStarred}
          onClose={() => setViewItem(null)}
          isSharedRoute={isSharedRoute}
          files={filteredFiles}
          onNavigate={(item) => setViewItem(item)}
          onMove={(item) => {
            if (item) setMoveItem(item);
          }}
          onDownload={async () => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );

            if (!items.length) return;

            for (const item of items) {
              if (item.isDirectory) {
                await handleDownloadFolder(item);
              } else {
                handleDownload(item);
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }}
          onStar={async (item) => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );

            if (items.length === 0 && selectedItems.has(lastDirectory._id)) {
              items.push(lastDirectory);
            }

            if (!items.length) return;
            await handleToggleStar(items);
          }}
          onRename={(item) => {
            if (item) openRename(item);
          }}
          onShare={() => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );

            if (items.length === 0 && selectedItems.has(lastDirectory._id)) {
              items.push(lastDirectory);
            }

            if (!items.length) return;
            setShareItem(items);
          }}
          onTrash={async () => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );

            if (items.length === 0 && selectedItems.has(lastDirectory._id)) {
              items.push(lastDirectory);
            }

            if (!items.length) return;
            await handleMoveToTrash(items);
          }}
          onRestore={async () => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );
            if (items.length === 0 && selectedItems.has(lastDirectory._id)) {
              items.push(lastDirectory);
            }
            if (!items.length) return;
            await handleRestoreItem(items);
          }}
          onDeleteForever={async (type) => {
            const items = combinedItems.filter((item) =>
              selectedItems.has(item.id ?? item._id),
            );
            if (items.length === 0 && selectedItems.has(lastDirectory._id)) {
              items.push(lastDirectory);
            }
            if (!items.length) return;
            await handleDelete(items, type);
          }}
          onPreview={(item) => setViewItem(item)}
        />
      ) : (
        <FileViewer
          key={viewItem?._id}
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
          item={selectedItem}
          items={shareItem}
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
