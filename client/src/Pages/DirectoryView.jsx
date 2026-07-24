import "../Styles/DirectoryView.css";
import { useEffect, useState, useRef, useMemo } from "react";
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
  DirectoryItemCollection,
  DirectoryEmptyState,
  GoogleDriveCard,
  CreateDirectoryModal,
  RenameModal,
  SelectionBar,
} from "../components/Drive";

import { IconInfo } from "../components/Icons/Icons";

import FileViewer from "../components/File/FileViewer";
import TopBanner from "../components/Banners/TopBanner";
import {
  deleteFile,
  restoreFile,
  softDeleteFile,
  toggleFilePublic,
} from "../../apis/fileApi";
import { useAuth, useGDrive, useBreadcrumb, useToast } from "../Contexts";
import { axiosWithCreds } from "../../apis/axiosInstances";
import { fetchPortalUrl } from "../../apis/subscriptionApi";

import { useDirectoryData } from "../Hooks/useDirectoryData";
import { useUploadQueue } from "../Hooks/useUploadQueue";
import { useSelectionAndContextMenu } from "../Hooks/useSelectionAndContextMenu";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function DirectoryView() {
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

  const grantUserId = useMemo(
    () => new URLSearchParams(location.search).get("grant"),
    [],
  );
  const grantRole = useMemo(
    () => new URLSearchParams(location.search).get("role"),
    [],
  );

  const isHomeRoute = location.pathname.startsWith("/home");
  const isSharedRoute =
    location.pathname.startsWith("/shared") ||
    params.get("usp") === "drive_link";
  const isTrashRoute = location.pathname.startsWith("/trash");
  const isGoogleDriveRoute = location.pathname.endsWith("/google-drive");
  const dirContext =
    location.state?.dirContext ||
    (isTrashRoute
      ? "trash"
      : isSharedRoute
        ? "shared"
        : isHomeRoute
          ? "home"
          : "local");

  const navigate = useNavigate();

  const [error, setError] = useState("");
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
  const { breadcrumbs, setBreadcrumbs } = useBreadcrumb();

  function showError(message, autoClear = false) {
    setError(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    if (autoClear) {
      errorTimeoutRef.current = setTimeout(() => setError(""), 5000);
    }
  }

  const {
    directoryName,
    isDeleted,
    isLoading,
    needsAccess,
    crumbs,
    setCrumbs,
    setFilesList,
    setDirectoriesList,
    getDirectoryItems,
    getTrashItems,
    combinedItems,
    filteredDirs,
    filteredFiles,
  } = useDirectoryData({
    dirId,
    dirContext,
    isSharedRoute,
    isTrashRoute,
    isGoogleDrive,
    setIsGoogleDrive,
    navigate,
    searchQuery,
  });

  const refreshCurrentDirectory = () =>
    getDirectoryItems(!dirId && isSharedRoute ? "shared" : "local");

  const {
    fileInputRef,
    uploadQueue,
    progressMap,
    isUploading,
    dbFileId,
    handleFileSelect,
    handleCancelUpload,
  } = useUploadQueue({
    dirId,
    user,
    refreshUser,
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
    handleMainMouseDown,
    handleMainMouseMove,
    handleMainMouseUp,
  } = useSelectionAndContextMenu({ combinedItems, mainRef });

  useEffect(() => {
    checkGoogleDriveAccess();
  }, []);

  useEffect(() => {
    if (dirId === "google-drive") getDirectoryItems("google-drive");
    else if (dirId === "shared" || (!dirId && isSharedRoute))
      getDirectoryItems("shared");
    else if (isTrashRoute && !dirId) {
      setBreadcrumbs([]);
      getDirectoryItems("local");
    } else {
      getDirectoryItems("local");
    }
    setContextItem(null);
    clearSelection();
    setSearchQuery("");
  }, [location.pathname]);

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
            usersArray: [{ id: grantUserId, relation: grantRole }],
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

  // Navigation
  function handleRowClick(_type, id) {
    setContextItem(null);
    handleSelect(id);
  }

  function handleRowDoubleClick(type, id) {
    clearSelection();
    if (type === "google-directory") {
      window.open(`https://drive.google.com/drive/folders/${id}`, "_blank");
      return;
    }
    if (type === "directory") {
      navigate(`/directory/${id}`, { state: { dirContext } });
      return;
    }
    const item = combinedItems.find((i) => (i.id ?? i._id) === id);
    if (item) setViewItem(item);
  }

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

  async function handleDelete(item) {
    try {
      const url = item.isDirectory
        ? `/directory/${item._id}`
        : `/file/${item._id}`;
      await deleteFile(url);
      getTrashItems(showError);
      clearSelection();
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
    setRenameType(item.isDirectory ? "directory" : "file");
    setRenameId(item._id);
    setRenameValue(item.name);
    setShowRename(true);
  }

  async function handleRenameSubmit(e) {
    e.preventDefault();
    showError("");
    try {
      const url =
        renameType === "file" ? `/file/${renameId}` : `/directory/${renameId}`;
      const body =
        renameType === "file"
          ? { fileName: renameValue }
          : { newDirName: renameValue };

      await axiosWithCreds.patch(url, body);
      setShowRename(false);
      refreshCurrentDirectory();
    } catch (err) {
      showError(err.message);
    }
  }

  function handleDownload(item) {
    try {
      if (dirId === "google-drive") {
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

  const handleShareItem = async (item, role, access) => {
    try {
      setIsShareLoading(true);
      const { _id, isDirectory } = item;
      const type = isDirectory ? "folder" : "file";
      await toggleFilePublic(_id, role, access, type);

      const update = (list) =>
        list.map((f) =>
          f._id === _id
            ? {
                ...f,
                isPublic: access !== "restricted",
                publicRole: access !== "restricted" ? role : undefined,
              }
            : f,
        );
      setFilesList((prev) => update(prev));
      setDirectoriesList((prev) => update(prev));
      toast({ message: "Access updated", type: "success" });
    } catch (error) {
      throw new Error(error || "Something went wrong!");
    } finally {
      setIsShareLoading(false);
    }
  };

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
    return <RequestAccess user={user} dirId={dirId} />;
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
            dirId={dirId}
            isHomeRoute={isHomeRoute}
            isSharedRoute={isSharedRoute}
            isTrashRoute={isTrashRoute}
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
            onMouseLeave={handleMainMouseUp}
          >
            <DriveToolbar
              dirId={dirId}
              crumbs={crumbs}
              setCrumbs={setCrumbs}
              dirContext={dirContext}
              directoryName={directoryName}
              isSharedRoute={isSharedRoute}
              isTrashRoute={isTrashRoute}
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
                {isGoogleDrive &&
                  !dirId &&
                  isHomeRoute &&
                  viewMode === "grid" && (
                    <GoogleDriveCard
                      onOpen={() => navigate("/directory/google-drive")}
                    />
                  )}

                {combinedItems.length === 0 && !dirId && (
                  <DirectoryEmptyState />
                )}

                <DirectoryItemCollection
                  items={filteredDirs}
                  label="Folders"
                  viewMode={viewMode}
                  dirId={dirId}
                  selectedItems={selectedItems}
                  onSelect={handleSelect}
                  onRowClick={handleRowClick}
                  onDoubleClick={handleRowDoubleClick}
                  onContextMenu={handleContextMenu}
                  listHeaderRow={listHeaderRow}
                />

                <DirectoryItemCollection
                  items={filteredFiles}
                  label="Files"
                  viewMode={viewMode}
                  dirId={dirId}
                  selectedItems={selectedItems}
                  onSelect={handleSelect}
                  onRowClick={handleRowClick}
                  onDoubleClick={handleRowDoubleClick}
                  onContextMenu={handleContextMenu}
                  listHeaderRow={listHeaderRow}
                  showListHeader={!filteredDirs.length}
                  sectionStyle={{ marginTop: filteredDirs.length ? 16 : 0 }}
                />
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
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onRenameSubmit={handleRenameSubmit}
          onClose={() => setShowRename(false)}
        />
      )}

      <SelectionBar
        selectedItems={selectedItems}
        hasFileSelected={hasFileSelected}
        isDeleted={isDeleted}
        isTrashRoute={isTrashRoute}
        isGoogleDriveRoute={isGoogleDriveRoute}
        onClear={() => {
          clearSelection();
          setContextItem(null);
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
        onDeleteForever={() => {
          selectedItems.forEach((id) => {
            const item = combinedItems.find((i) => (i.id ?? i._id) === id);
            if (item) handleDelete(item);
          });
        }}
      />

      {contextItem && (
        <ContextMenu
          openLeft={openLeft}
          item={contextItem}
          position={contextPos}
          isGoogleDriveRoute={isGoogleDriveRoute}
          isTrashRoute={isTrashRoute}
          dirId={dirId}
          isDeleted={isDeleted}
          viewMode={viewMode}
          onClose={() => {
            setContextItem(null);
            clearSelection();
          }}
          onShare={(item) => setShareItem(item)}
          onRename={(item) => openRename(item)}
          onSoftDelete={(item) => handleMoveToTrash(item)}
          onDelete={(item) => handleDelete(item)}
          onRestore={(item) => handleRestoreItem(item)}
          onDownload={(item) => handleDownload(item)}
          onPreview={(item) => setViewItem(item)}
        />
      )}

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
          onDownload={handleDownload}
        />
      )}

      {shareItem && (
        <ShareModal
          item={shareItem}
          onClose={handleShareItem}
          setShareItem={setShareItem}
          isShareLoading={isShareLoading}
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
