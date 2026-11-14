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

import { useAuth, useGDrive, useBreadcrumb, useToast } from "../Contexts";
import { axiosWithCreds } from "../../apis/axiosInstances";
import { fetchPortalUrl } from "../../apis/subscriptionApi";
import { moveItem as moveItemFunction } from "../../apis/resourceApi";

import { useDirectoryData } from "../Hooks/useDirectoryData";
import { useUploadQueue } from "../Hooks/useUploadQueue";
import { useSelectionAndContextMenu } from "../Hooks/useSelectionAndContextMenu";

import {
  clearPendingDriveFile,
  getPendingDriveFile,
} from "../Components/Drive/PendingGoogleDriveFile";
import { uploadGoogleDriveFile } from "../Components/Drive/uploadGoogleDriveFile";
import RecentView from "../Components/Drive/Recent/RecentView";

import { searchUsers } from "../../apis/userApi";
import DownloadTray from "../Components/Drive/DownloadTray";
import { useFolderUploadQueue } from "../Hooks/useFolderUploadQueue";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/solid";
import SortButton from "../Components/ListRow/SortButton";
import MoveModal from "../Components/Modals/MoveModal";
import { GDrivePicker } from "../Components/Drive/DriveSidebar";
import CreateMenu from "../Components/Drive/CreateMenu";
import ConfirmationModal from "../Components/Modals/ConfirmationModal";
import CascadeConfirmationModal from "../Components/Modals/CascadeConfirmationModal";
import { useDevice } from "../Contexts/DeviceContext";
import MobileContextMenu from "../Components/Drive/MobileContextMenu";
import FileViewerMobile from "../Components/File/FileViewerMobile";
import DriveTopBarMobile from "../Components/Drive/DriveTopbarMobile";
import MobileMoveModal from "../Components/Modals/MobileMoveModal";
import ShareModalMobile from "../Components/Modals/ShareModalMobile";
import useDriveActions from "../Hooks/useDriveActions";
import { redirectToGoogleDriveAuth } from "../Hooks/useGoogleDriveAuth";
import HomeView from "../Components/Drive/HomeView";

export default function DirectoryView({ route }) {
  const { breadcrumbs, setBreadcrumbs } = useBreadcrumb();
  const { device } = useDevice();
  const isDesktop = device === "windows";
  const isMobile = device === "mobile";
  const { user, refreshUser } = useAuth();
  const {
    checkingGoogleDrive,
    checkGoogleDriveAccess,
    isGoogleDrive,
    setIsGoogleDrive,
  } = useGDrive();
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

  const [viewMode, setViewMode] = useState("grid");

  const [searchQuery, setSearchQuery] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [createMenuPos, setCreateMenuPos] = useState({ x: 0, y: 0 });
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sortedFilesForViewer, setSortedFilesForViewer] = useState([]);
  const [inDirectory, setInDirectory] = useState(false);
  const [animate, setAnimate] = useState(false);

  const restartAnimation = () => {
    setAnimate(false);

    requestAnimationFrame(() => {
      setAnimate(true);
    });
  };

  useEffect(() => {
    if (checkingGoogleDrive) return;

    if (route === "google-drive" && isGoogleDrive === false) {
      redirectToGoogleDriveAuth();
    }
  }, [route, isGoogleDrive, checkingGoogleDrive]);

  useEffect(() => {
    if (location.pathname.startsWith("/directory") && isMobile) {
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

  //   confirmModal.resolve?.(false);

  //   setConfirmModal({
  //     open: false,
  //     message: "",
  //     resolve: null,
  //   });
  // };
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
                : "drive");
  const previousDirContext = useRef(dirContext);
  const resumedDriveUploadRef = useRef(false);

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
    rootKey,
    directoryName,
    isLoading,
    needsAccess,
    crumbs,
    setCrumbs,
    directoriesList,
    lastDirectory,
    filesList,
    setFilesList,
    setDirectoriesList,
    getDirectoryItems,
    setLastDirectory,
    combinedItems,
    filteredFiles,
  } = useDirectoryData({
    dirId,
    dirContext,
    user,
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
  const refreshCurrentDirectory = (type = "") => {
    console.log('type', type)
    getDirectoryItems(
      type === "google" || isGoogleDriveRoute
        ? "google-drive"
        : isSharedRoute
          ? "shared"
          : isStarredRoute
            ? "starred"
            : isTrashRoute
              ? "trash"
              : "drive",
    );
  };
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

  const {
    handleUndoRef,
    isActionLoading,
    isShareLoading,
    setIsShareLoading,
    handleCascadeConfirm,
    handleCascadeCancel,
    handleRowClick,
    handleRowDoubleClick,
    handleCopyItems,
    handleMoveItems,
    handlePrint,
    handleDownloadFolder,
    handleDownload,
    handleCancelDownload,
    handleConfirm,
    handleCancel,
    handleMoveToTrash,
    handleDelete,
    handleRestoreItem,
    handleCreateDirectory,
    openRename,
    handleRenameSubmit,
    handleToggleStar,
    handleToggleResourcePublic,
    handleSharedRoleUpdate,
    handleDropOnTrash,
    mobileHeaderDirName,
    showCreateDir,
    setShowCreateDir,
    newDirname,
    setNewDirname,
    showRename,
    setShowRename,
    renameValue,
    setRenameValue,
    shareItem,
    setShareItem,
    viewItem,
    setViewItem,
    moveItem,
    setMoveItem,
    downloadQueue,
    downloadProgressMap,
    prevPermissions,
    setPrevPermissions,
    peopleWithAccess,
    setPeopleWithAccess,
    path,
    setPath,
    linkRole,
    setLinkRole,
    linkAccess,
    setLinkAccess,
    setUserRole,
    cascadeModal,
    confirmModal,
  } = useDriveActions({
    dirId,
    user,
    setDirectoriesList,
    setFilesList,
    combinedItems,
    lastDirectory,
    setLastDirectory,
    isGoogleDriveRoute,
    selectedItems,
    isMobile,
    setContextItem,
    restartAnimation,
    isStarred,
    isStarredRoute,
    isTrashRoute,
    setIsStarred,
    handleSelect,
    refreshUser,
    previousDirContext,
    clearSelection,
    toast,
    setError,
    showError,
  });

  const handleMove = async (ids, destinationId, destinationName) => {
    const targetId = destinationId ?? user?.parentDirId;

    if (!targetId) {
      toast({
        message: "Could not find the destination folder",
        type: "error",
      });
      return;
    }

    const validItems = combinedItems.filter((item) =>
      ids.some((id) => String(id) === String(item._id ?? item.id)),
    );

    if (!validItems.length) return;

    await handleMoveItems(validItems, targetId, destinationName);
  };
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
    if (isHomeRoute) getDirectoryItems("home");
    else if (isGoogleDriveRoute) getDirectoryItems("google-drive");
    else if (dirContext === "trash" || isTrashRoute) getDirectoryItems("trash");
    else if (isRecentRoute) getDirectoryItems("recent");
    else if (isSharedRoute) getDirectoryItems("shared");
    else if (isStarredRoute) getDirectoryItems("starred");
    else {
      getDirectoryItems("drive");
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
    isHomeRoute,
    isStarredRoute,
    location.pathname,
  ]);

  useEffect(() => {
    const channel = new BroadcastChannel("file-sync");
    channel.onmessage = (event) => {
      if (event.data.type === "FILE_DELETED") {
        const item = event.data.item;
        setFilesList((prev) => prev.filter((f) => f._id !== event.data.id));
        toast({
          message: "item moved to trash",
          type: "success",
          duration: 5000,
          undoAction: {
            type: "trash",
            items: item,
            onUndo: () =>
              handleUndoRef.current?.({ type: "trash", items: item }),
          },
        });
      }
    };
    return () => channel.close();
  }, []);

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

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      ...prev,
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };
  useEffect(() => {
    setSortConfig(
      isSharedRoute
        ? { key: "sharedWithMeTime", direction: "desc", folders: "mixed" }
        : { key: "name", direction: "asc", folders: "top" },
    );
  }, [isSharedRoute]);
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
      {isMobile ? (
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
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
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
        className={`gd-body ${isMobile ? "mobile" : ""} ${animate ? "animation" : ""}`}
      >
        {isDesktop && user.email && (
          <DriveSidebar
            enqueueItem={enqueueItem}
            setItemProgress={setItemProgress}
            setDirectoriesList={setDirectoriesList}
            setFilesList={setFilesList}
            completeItem={completeItem}
            handleCancelUpload={handleCancelUpload}
            setDbFileId={setDbFileId}
            onDropToTrash={handleDropOnTrash}
            onMove={handleMove}
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
        <div className={`gd-main-container ${isMobile ? "mobile" : ""}`}>
          <main
            style={{ userSelect: "none" }}
            ref={mainRef}
            className={`gd-main ${isMobile ? "mobile" : ""} ${isHomeRoute ? "home" : ""}`}
            onMouseDown={handleMainMouseDown}
            onMouseMove={handleMainMouseMove}
            onMouseUp={handleMainMouseUp}
            onContextMenu={(e) => (isMobile ? null : handleCreateNewMenu(e))}
            onMouseLeave={handleMainMouseUp}
          >
            {isDesktop && (
              <DriveToolbar
                dirId={dirId}
                crumbs={crumbs}
                rootKey={rootKey}
                path={path}
                setCrumbs={setCrumbs}
                dirContext={dirContext}
                directoryName={directoryName}
                onDropToTrash={handleDropOnTrash}
                onMove={handleMove}
                isHomeRoute={isHomeRoute}
                isSharedRoute={isSharedRoute}
                breadcrumbs={breadcrumbs}
                setBreadcrumbs={setBreadcrumbs}
                disabled={isUploading}
                viewMode={viewMode}
                onDoubleClick={handleRowDoubleClick}
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
              (isMobile ? (
                <MobileMoveModal
                  currentDirId={dirId}
                  item={Array.isArray(moveItem) ? moveItem[0] : moveItem}
                  items={Array.isArray(moveItem) ? moveItem : [moveItem]}
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
                  item={Array.isArray(moveItem) ? moveItem[0] : moveItem}
                  items={Array.isArray(moveItem) ? moveItem : [moveItem]}
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
              <div className={`gd-loading ${isMobile ? "mobile" : ""}`}>
                <div className="gd-spinner" />
              </div>
            ) : (
              <>
                {combinedItems.length === 0 && !dirId ? (
                  <DriveEmptyState route={route} isMobile={isMobile} />
                ) : isRecentRoute || isSharedRoute ? (
                  <RecentView
                    items={isRecentRoute ? filteredFiles : combinedItems}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    isSharedRoute={isSharedRoute}
                    isRecentRoute={isRecentRoute}
                    isDesktop={isDesktop}
                    isMobile={isMobile}
                    viewMode={viewMode}
                    onToggleView={() =>
                      setViewMode((v) => (v === "grid" ? "list" : "grid"))
                    }
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
                ) : isHomeRoute ? (
                  <HomeView
                    files={filteredFiles}
                    folders={directoriesList}
                    setSelectedItems={setSelectedItems}
                    isHomeRoute={isHomeRoute}
                    isGoogleDrive={isGoogleDrive}
                    items={combinedItems}
                    open={open}
                    onMove={handleMove}
                    setOpen={setOpen}
                    selectionMode={selectionMode}
                    setSelectionMode={setSelectionMode}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    setSortedFilesForViewer={setSortedFilesForViewer}
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
                ) : (
                  <DefaultView
                    setSelectedItems={setSelectedItems}
                    isGoogleDrive={isGoogleDrive}
                    isHomeRoute={isHomeRoute}
                    isSharedRoute={isSharedRoute}
                    items={combinedItems}
                    isDesktop={isDesktop}
                    isMobile={isMobile}
                    open={open}
                    onMove={handleMove}
                    setOpen={setOpen}
                    selectionMode={selectionMode}
                    setSelectionMode={setSelectionMode}
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    setSortedFilesForViewer={setSortedFilesForViewer}
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
      {isMobile && (
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
      {isDesktop && (
        <SelectionBar
          dirId={dirId}
          item={selectedItem}
          items={combinedItems.filter((i) => selectedItems.has(i.id ?? i._id))}
          selectedItems={selectedItems}
          route={route}
          onClear={() => {
            clearSelection();
            setContextItem(null);
          }}
          onContextMenu={handleContextMenu}
          onDownload={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            for (const item of items) {
              try {
                if (item.isDirectory) {
                  await handleDownloadFolder(item);
                } else {
                  handleDownload(item);
                }

                await new Promise((resolve) => setTimeout(resolve, 500));
              } catch (error) {
                console.error(`Failed to download ${item.name}:`, error);
              }
            }
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
          }}
          onMove={(payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            // Move dialog receives the selected items.
            setMoveItem(items);
          }}
          onStar={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleToggleStar(items);
          }}
          onRename={(item) => {
            if (item) openRename(item);
          }}
          onShare={(payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            setShareItem(items);
          }}
          onTrash={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleMoveToTrash(items);
          }}
          onRestore={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleRestoreItem(items);
          }}
          onDeleteForever={async (type, payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleDelete(items, type);
          }}
        />
      )}

      {contextItem &&
        (isMobile ? (
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
            onPrint={handlePrint}
            onDownload={async (payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              for (const item of items) {
                try {
                  if (item.isDirectory) {
                    await handleDownloadFolder(item);
                  } else {
                    handleDownload(item);
                  }

                  await new Promise((resolve) => setTimeout(resolve, 500));
                } catch (error) {
                  console.error(`Failed to download ${item.name}:`, error);
                }
              }
            }}
            onCopy={async (payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              await handleCopyItems(items);

              if (selectionMode) {
                setSelectionMode(false);
              }
            }}
            onMove={(payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              // Move dialog receives the selected items.
              setMoveItem(items);

              if (selectionMode) {
                setSelectionMode(false);
              }
            }}
            onStar={async (payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              await handleToggleStar(items);
            }}
            onRename={(item) => {
              if (item) openRename(item);
            }}
            onShare={(payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              setShareItem(items);
            }}
            onTrash={async (payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              await handleMoveToTrash(items);

              if (selectionMode) setSelectionMode(false);
            }}
            onRestore={async (payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              await handleRestoreItem(items);

              if (selectionMode) setSelectionMode(false);
            }}
            onDeleteForever={async (type, payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              await handleDelete(items, type);

              if (selectionMode) setSelectionMode(false);
            }}
            onPreview={(item) => setViewItem([item])}
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
            onDownload={async (payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              for (const item of items) {
                try {
                  if (item.isDirectory) {
                    await handleDownloadFolder(item);
                  } else {
                    handleDownload(item);
                  }

                  await new Promise((resolve) => setTimeout(resolve, 500));
                } catch (error) {
                  console.error(`Failed to download ${item.name}:`, error);
                }
              }
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
            }}
            onMove={(payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              // Move dialog receives the selected items.
              setMoveItem(items);
            }}
            onStar={async (payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              await handleToggleStar(items);
            }}
            onRename={(item) => {
              if (item) openRename(item);
            }}
            onShare={(payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              setShareItem(items);
            }}
            onTrash={async (payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              await handleMoveToTrash(items);
            }}
            onRestore={async (payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              await handleRestoreItem(items);
            }}
            onDeleteForever={async (type, payload) => {
              const items = Array.isArray(payload)
                ? payload
                : payload
                  ? [payload]
                  : [];

              if (!items.length) return;

              await handleDelete(items, type);
            }}
            onPreview={(item) => setViewItem([item])}
          />
        ))}

      {viewItem && isMobile ? (
        <FileViewerMobile
          key={viewItem?._id}
          item={viewItem}
          isStarred={isStarred}
          onClose={() => setViewItem([])}
          onPrint={handlePrint}
          handleSelect={handleSelect}
          isSharedRoute={isSharedRoute}
          files={sortedFilesForViewer}
          onNavigate={(item) => setViewItem([item])}
          onContextMenu={handleContextMenu}
          onDownload={async (item) => {
            if (item) {
              try {
                if (item.isDirectory) {
                  await handleDownloadFolder(item);
                } else {
                  handleDownload(item);
                }
              } catch (error) {
                console.error(`Failed to download ${item.name}:`, error);
              }
            }
          }}
          onMove={(item) => {
            if (item) {
              setMoveItem(item);
            }
          }}
          onStar={async (item) => {
            if (item) {
              await handleToggleStar(item);
            }
          }}
          onRename={(item) => {
            if (item) openRename(item);
          }}
          onCopy={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleCopyItems(items);

            if (selectionMode) {
              setSelectionMode(false);
            }
          }}
          onShare={(payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            setShareItem(items);
          }}
          onTrash={async (item) => {
            if (item) {
              await handleMoveToTrash(item);
            }
          }}
          onRestore={async (item) => {
            if (item) {
              await handleRestoreItem(item);
            }
          }}
          onDeleteForever={async (type, item) => {
            if (item) {
              await handleDelete(item, type);
            }
          }}
          onPreview={(item) => setViewItem([item])}
        />
      ) : (
        <FileViewer
          key={viewItem?._id}
          item={viewItem}
          onPrint={handlePrint}
          isStarred={isStarred}
          onClose={() => setViewItem(null)}
          isSharedRoute={isSharedRoute}
          files={sortedFilesForViewer}
          onNavigate={(item) => setViewItem([item])}
          onDownload={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            for (const item of items) {
              try {
                if (item.isDirectory) {
                  await handleDownloadFolder(item);
                } else {
                  handleDownload(item);
                }

                await new Promise((resolve) => setTimeout(resolve, 500));
              } catch (error) {
                console.error(`Failed to download ${item.name}:`, error);
              }
            }
          }}
          onCopy={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleCopyItems(items);

            if (selectionMode) {
              setSelectionMode(false);
            }
          }}
          onMove={(payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            // Move dialog receives the selected items.
            setMoveItem(items);
          }}
          onStar={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleToggleStar(items);
          }}
          onRename={(item) => {
            if (item) openRename(item);
          }}
          onShare={(payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            setShareItem(items);
          }}
          onTrash={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleMoveToTrash(items);
          }}
          onRestore={async (payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleRestoreItem(items);
          }}
          onDeleteForever={async (type, payload) => {
            const items = Array.isArray(payload)
              ? payload
              : payload
                ? [payload]
                : [];

            if (!items.length) return;

            await handleDelete(items, type);
          }}
        />
      )}

      {shareItem &&
        (isMobile ? (
          <ShareModalMobile
            setDirectoriesList={setDirectoriesList}
            setFilesList={setFilesList}
            item={selectedItem}
            setViewItem={setViewItem}
            selectedUsers={selectedUsers}
            setSelectedUsers={setSelectedUsers}
            peopleWithAccess={peopleWithAccess}
            setPeopleWithAccess={setPeopleWithAccess}
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
            isGoogleDriveRoute={isGoogleDriveRoute}
            setIsShareLoading={setIsShareLoading}
          />
        ) : (
          <ShareModal
            selectedUsers={selectedUsers}
            setSelectedUsers={setSelectedUsers}
            peopleWithAccess={peopleWithAccess}
            setPeopleWithAccess={setPeopleWithAccess}
            item={selectedItem}
            items={shareItem}
            setViewItem={setViewItem}
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
        ))}

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
