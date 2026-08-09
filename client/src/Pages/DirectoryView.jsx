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
import { toggleItemStar } from "../../apis/resourceApi";
import { searchUsers } from "../../apis/userApi";
import { updateSharedAccess } from "../../Utils/shareRoleAccess";

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
  const [prevRole, setPrevRole] = useState([]);
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
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

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

  function showError(message, autoClear = false) {
    setError(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    if (autoClear) {
      errorTimeoutRef.current = setTimeout(() => setError(""), 5000);
    }
  }
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
    isDeleted,
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
      type === "google" ? "google-drive" : isSharedRoute ? "shared" : "root",
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
        const data = await searchUsers(user.id);
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
  const [isRenameLoading, setIsRenameLoading] = useState(false);
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

      if (!newStarredValue) {
        if (item.isDirectory) {
          setDirectoriesList((prev) => prev.filter((d) => d._id !== item._id));
        } else {
          setFilesList((prev) => prev.filter((f) => f._id !== item._id));
        }
      }

      toast({ message, type: "success" });
    } catch (error) {
      setError(error.message);
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

      if (isGoogleDrive) {
        if (restricted) {
          await revokeFileAccess("google", itemId);
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

const handleSharedRoleUpdate = async (
  item,
  type,
  message,
) => {
  setIsShareLoading(true);

  try {
    const result = await updateSharedAccess({
      item,
      type,
      peopleWithAccess,
      prevRole,
      message,
      grantAccessById,
      revokeFileAccess,
    });

    
    if (!result.changed) {
      setShareItem(null);
      return;
    }

   
    const updateResource = (list) =>
      list.map((resource) => {
        const resourceId = String(
          resource._id ?? resource.id,
        );

        if (resourceId !== result.itemId) {
          return resource;
        }

        const nonUserPermissions = (
          resource.permissions ?? []
        ).filter(
          (permission) =>
            permission.type !== "user",
        );

        return {
          ...resource,
          permissions: [
            ...nonUserPermissions,
            ...result.permissions,
          ],
        };
      });


    setFilesList(updateResource);
    setDirectoriesList(updateResource);

    setPeopleWithAccess(result.permissions);
    setPrevRole(result.permissions);
    setShareItem(null);

    toast({
      message: "Access updated",
      type: "success",
    });
  } catch (error) {
    toast({
      message:
        error?.message ||
        "Something went wrong!",
      type: "error",
    });
  } finally {
    setIsShareLoading(false);
  }
};



  useEffect(() => {
    console.log("combinedItems", combinedItems);
  }, [combinedItems]);
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
        isDeleted={isDeleted}
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
            if (item && !item.isDirectory) handleDownload(item);
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
        isDeleted={isDeleted}
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
        onDownload={(item) => handleDownload(item)}
        onPreview={(item) => setViewItem(item)}
      />

      {viewItem && (
        <FileViewer
          key={viewItem._id}
          item={viewItem}
          isDeleted={isDeleted}
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
          prevRole={prevRole}
          setPrevRole={setPrevRole}
          isShareLoading={isShareLoading}
          setDirectoriesList={setDirectoriesList}
          setFilesList={setFilesList}
          isGoogleDriveRoute={isGoogleDriveRoute}
          setIsShareLoading={setIsShareLoading}
        />
      )}

      <UploadTray
        dbFileId={dbFileId}
        uploadingFiles={uploadQueue}
        progressMap={progressMap}
        onCancel={handleCancelUpload}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelect}
        disabled={isUploading}
      />
    </div>
  );
}
