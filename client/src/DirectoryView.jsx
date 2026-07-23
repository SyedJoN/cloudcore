import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import DriveHeader from "./components/DriveHeader";
import DriveSidebar from "./components/DriveSidebar";
import DriveToolbar from "./components/DriveToolbar";
import GridItem from "./components/GridItem";
import ListRow from "./components/ListRow";
import ContextMenu from "./components/ContextMenu";
import ShareModal from "./components/ShareModal";
import UploadTray from "./components/UploadTray";
import RequestAccessPage from "./RequestAccessPage";
import GoogleDriveSVG from "./components/Icons/GoogleDriveSVG";
import {
  IconClose,
  IconDownload,
  IconInfo,
  IconRename,
  IconRestore,
  IconShare,
  IconTrash,
} from "./components/Icons";

import "./DirectoryView.css";
import FileViewer from "./components/FileViewer";
import {
  deleteFile,
  getSignedUploadUrl,
  notifyBackend,
  restoreFile,
  softDeleteFile,
  toggleFilePublic,
} from "../apis/fileApi";
import { useToast } from "./Contexts/ToastContext";
import { useMemo } from "react";
import { axiosWithCreds } from "../apis/axiosInstances";
import DetailsSidebar from "./components/DetailsSidebar";
import { formatSize } from "../utils/formatHelpers";
import { getDirectory } from "../apis/directoryApi";
import { googleDriveCheck } from "../apis/authApi";
import TopBanner from "./components/TopBanner";
import { fetchPortalUrl } from "../apis/subscriptionApi";
import { useAuth } from "./Contexts/AuthContext";
import { useBreadcrumb } from "./Contexts/BreadcrumbContext";
import { useGDrive } from "./Contexts/GoogleDriveAuthContext";
import SearchBar from "./components/SearchBar";
import { useSidebar } from "./Contexts/SidebarContext";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function DirectoryView() {
  const { toast } = useToast();

  const { dirId } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const grantExecutedRef = useRef(false);
  const mainContainerRef = useRef(null);
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
  const [needsAccess, setNeedsAccess] = useState(false);
  const { user, refreshUser } = useAuth();

  const [directoryName, setDirectoryName] = useState("My Drive");
  const [directoriesList, setDirectoriesList] = useState([]);
  const [filesList, setFilesList] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  const [showCreateDir, setShowCreateDir] = useState(false);
  const [newDirname, setNewDirname] = useState("New Folder");
  const [showRename, setShowRename] = useState(false);
  const [renameType, setRenameType] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareItem, setShareItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);

  const fileInputRef = useRef(null);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadXhrMap, setUploadXhrMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [isUploading, setIsUploading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [contextItem, setContextItem] = useState(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const { breadcrumbs, setBreadcrumbs } = useBreadcrumb();
  const [dragBox, setDragBox] = useState(null);
  const mainRef = useRef(null);
  const [crumbs, setCrumbs] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [dbFileId, setDbFileId] = useState("");

  useEffect(() => {
    console.log("directories", directoriesList);
  }, [directoriesList]);

  // Auth check + user fetch

  const { checkGoogleDriveAccess, isGoogleDrive, setIsGoogleDrive } =
    useGDrive();
  useEffect(() => {
    checkGoogleDriveAccess();
  }, []);

  async function getTrashItems(tab = "") {
    setIsLoading(true);
    try {
      const { data } = await axiosWithCreds.get(
        `/trash/${tab === "trash" ? dirId : ""}`,
      );

      const name = isTrashRoute ? "Trash" : data.name;
      setDirectoryName(name);
      setBreadcrumbs([]);

      setError("");
      if (!data.directories || !data.files) return;

      setDirectoriesList([...data.directories].reverse());
      setFilesList([...data.files].reverse());
    } catch (err) {
      if (err?.response?.status === 403) {
        setError(err.message);
        return;
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }
  function showError(message, autoClear = false) {
    setError(message);

    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    if (autoClear) {
      errorTimeoutRef.current = setTimeout(() => {
        setError("");
      }, 5000);
    }
  }

  async function getDirectoryItems(dirType) {
    setIsLoading(true);
    try {
      const api =
        dirType === "google-drive"
          ? "/auth/google-drive/files"
          : dirType === "shared"
            ? "/shared"
            : dirContext === "trash"
              ? `/trash/${dirId || ""}`
              : `/directory/${dirId || ""}`;

      const res = await getDirectory(api);

      const { data } = res;
      const name =
        isSharedRoute && !dirId
          ? "Shared with me"
          : dirId === "google-drive"
            ? "Google Drive"
            : data.name;

      setDirectoryName(name);
      console.log("data", data);

      const isRoot = (n) => (n ?? "").startsWith("root");
      const cleanPath = Array.isArray(data.path)
        ? data.path
            .filter((p) => !isRoot(p.name))
            .map((p) => ({
              id: p._id,
              name: p.name,
            }))
        : (data.path ?? []);
      const currentCrumb = data.path
        ? isRoot(data.name)
          ? {}
          : { id: data._id, name: data.name }
        : {};
      setCrumbs([...cleanPath, currentCrumb]);

      if (!data.directories || !data.files) return;
      setIsDeleted(
        data.directories.some((d) => d.isDeleted) ||
          data.files.some((f) => f.isDeleted),
      );

      setDirectoriesList([...data.directories].reverse());
      setFilesList([...data.files].reverse());
    } catch (err) {
      if (isGoogleDrive) {
        setIsGoogleDrive(false);
      }
      const status = err?.response?.status;

      if (status === 403) {
        setNeedsAccess(true);
      } else if (status === 401 || status === 404) {
        navigate("/login");
      } else {
        console.error(err);
        navigate("/");
      }
    } finally {
      setIsLoading(false);
    }
  }

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
    setSelectedItems(new Set());
    setSearchQuery("");
  }, [location.pathname]);

  // Navigation
  function handleRowClick(type, id) {
    setContextItem(null);
    // Single click always selects
    handleSelect(id);
  }

  function handleRowDoubleClick(type, id, isDeleted) {
    clearSelection();
    if (type === "google-directory") {
      window.open(`https://drive.google.com/drive/folders/${id}`, "_blank");
      return;
    }
    if (type === "directory") {
      navigate(`/directory/${id}`, { state: { dirContext } });
      return;
    }
    const item = [
      ...directoriesList.map((d) => ({ ...d, isDirectory: true })),
      ...filesList.map((f) => ({ ...f, isDirectory: false })),
    ].find((i) => (i.id ?? i._id) === id);
    if (item) setViewItem(item);
  }

  // Upload
  function handleFileSelect(e) {
    setError("");
    const selected = Array.from(e.target.files);

    if (user.uploadLimit !== null && user.uploadLimit == 0) {
      setError(`Uploads are paused. Please complete your payment to continue`);
      return;
    }

    if (!selected.length) return;
    const validFiles = selected.filter((file) => file.size <= user.uploadLimit);

    e.target.value = "";

    if (!validFiles.length) {
      setError("Max upload size limit reached!");
      return;
    }

    if (validFiles.length !== selected.length) {
      setError("Some files are skipped due to size limit");
    }

    const newItems = validFiles.map((file) => ({
      file,
      size: file.size,
      name: file.name,
      _id: `temp-${Date.now()}-${Math.random()}`,
      isUploading: false,
    }));
    newItems.forEach((item) =>
      setProgressMap((prev) => ({ ...prev, [item._id]: 0 })),
    );
    setUploadQueue((prev) => [...prev, ...newItems]);
    e.target.value = "";
    if (!isUploading) {
      setIsUploading(true);
      processUploadQueue([...uploadQueue, ...newItems.reverse()]);
    }
  }

  async function processUploadQueue(queue) {
    if (!queue.length) {
      setUploadQueue([]);
      setTimeout(() => {
        getDirectoryItems(!dirId && isSharedRoute ? "shared" : "local");
        setIsUploading(false);
      }, 1000);
      return;
    }

    const [current, ...rest] = queue;

    if (current.size > user.uploadLimit) {
      setError(`File ${current.name} exceeds 10MB limit`);
      await processUploadQueue(rest);
      return;
    }
    const totalStorageLeft = user.totalStorage - user.totalUsage;
    const needed = Number(current.size) - totalStorageLeft;
    if (Number(current.size) > totalStorageLeft) {
      setError(
        `Storage is full. You need ${formatSize(needed)} more storage client`,
      );
      await refreshUser();

      handleCancelUpload(current._id);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await processUploadQueue(rest);
      return;
    }
    try {
      const { uploadUrl, fileId } = await getSignedUploadUrl({
        name: current.file.name,
        size: current.file.size,
        contentType: current.file.type,
        parentDirId: dirId,
      });
      setDbFileId(fileId);
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.withCredentials = true;

      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable)
          setProgressMap((prev) => ({
            ...prev,
            [current._id]: (evt.loaded / evt.total) * 100,
          }));
      });
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          await notifyBackend(fileId);

          // success
          await refreshUser();
          await processUploadQueue(rest);
        } else {
          setError("Upload failed:", xhr.status, xhr.responseText);
          await handleCancelUpload(current._id, fileId);
          await processUploadQueue(rest);
          console.error("Upload failed:", xhr.status, xhr.responseText);
          setIsUploading(false);
        }
      };
      xhr.addEventListener("error", async () => {
        console.error("Network error during upload");
        setError("Network error during upload");
        await handleCancelUpload(current._id);
      });

      // aborted upload
      xhr.addEventListener("abort", async () => {
        console.warn("Upload aborted");
        await processUploadQueue(rest);
      });

      setUploadXhrMap((prev) => ({ ...prev, [current._id]: xhr }));
      xhr.setRequestHeader("Content-Type", current.file.type);

      xhr.send(current.file);
    } catch (error) {
      setError(error.message || "Failed fetching uploadUrl");
      await processUploadQueue(rest);
    }
  }

  async function handleCancelUpload(tempId, fileId) {
    const progress = progressMap[tempId] ?? 0;
    const url = `/file/${fileId}`;
    uploadXhrMap[tempId]?.abort();
    if (fileId) {
      try {
        await deleteFile(url);
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }

    setUploadQueue((prev) => prev.filter((i) => i._id !== tempId));

    setProgressMap((prev) => {
      const { [tempId]: _, ...rest } = prev;
      return rest;
    });

    setUploadXhrMap((prev) => {
      const copy = { ...prev };
      delete copy[tempId];
      return copy;
    });
    setIsUploading(false);
  }

  async function handleMoveToTrash(item) {
    console.log("item", item);
    try {
      const url = item.isDirectory
        ? `/directory/soft-delete/${item._id}`
        : `/file/soft-delete/${item._id}`;
      await softDeleteFile(url);
      await refreshUser();
      getDirectoryItems(!dirId && isSharedRoute ? "shared" : "local");
      clearSelection();
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError("Too many requests. Please slow down.");
        return;
      }
      setError(err.message);
    }
  }
  async function handleRestoreItem(item) {
    try {
      const type = item.isDirectory ? "directory" : "file";
      const url = `/${type}/${item._id}/restore`;
      await restoreFile(url);
      await refreshUser();
      getTrashItems();
      clearSelection();
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        navigate("/login");
        return;
      }
      if (status === 507) {
        setError("Free up space to restore this item.");
        return;
      }
      setError(err.message);
    }
  }
  async function handleDelete(item) {
    try {
      const url = item.isDirectory
        ? `/directory/${item._id}`
        : `/file/${item._id}`;
      await deleteFile(url);
      getTrashItems();
      clearSelection();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateDirectory(e) {
    e.preventDefault();
    setError("");
    try {
      await axiosWithCreds.post(
        `/directory/${dirId || ""}`,
        {},
        {
          headers: {
            dirname: newDirname,
          },
        },
      );
      setNewDirname("New Folder");
      setShowCreateDir(false);
      getDirectoryItems(!dirId && isSharedRoute ? "shared" : "local");
    } catch (err) {
      setError(err.message);
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
    setError("");
    try {
      const url =
        renameType === "file" ? `/file/${renameId}` : `/directory/${renameId}`;

      const body =
        renameType === "file"
          ? { fileName: renameValue }
          : { newDirName: renameValue };

      await axiosWithCreds.patch(url, body);

      setShowRename(false);

      getDirectoryItems(!dirId && isSharedRoute ? "shared" : "local");
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    const channel = new BroadcastChannel("file-sync");

    channel.onmessage = (event) => {
      if (event.data.type === "FILE_DELETED") {
        setFilesList((prev) => prev.filter((f) => f._id !== event.data.id));
      }
    };

    return () => channel.close();
  }, []);
  async function handleDownload(item) {
    try {
      if (dirId === "google-drive") {
        const url = `http://localhost:4000/auth/google-drive/download?fileId=${item.id}`;

        // IMPORTANT: prevent SPA/router interception
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
      setError(err.message);
    }
  }
  const [openLeft, setOpenLeft] = useState(0);
  // Context menu
  function handleContextMenu(e, id) {
    e.stopPropagation();
    e.preventDefault();
    const CONTEXT_MENU_WIDTH = 180;
    const container = mainContainerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const spaceRight = rect.width - x;
    const left = spaceRight < CONTEXT_MENU_WIDTH;
    setOpenLeft(left);
    setContextPos({ x: e.clientX - 210, y: e.clientY });

    const item = combinedItems.find((i) => (i.id ?? i._id) === id);
    setContextItem(item || null);
  }

  function handleSelect(id) {
    setSelectedItems(new Set([id]));
  }

  function clearSelection() {
    setSelectedItems(new Set());
  }

  function handleSelectAll() {
    const allIds = combinedItems.map((i) => i.id ?? i._id);
    setSelectedItems(new Set(allIds));
  }

  const handleShareItem = async (item, role, access) => {
    try {
      setIsShareLoading(true);
      const { _id, isDirectory } = item;
      const type = isDirectory ? "folder" : "file";
      const result = await toggleFilePublic(_id, role, access, type);
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
    getDirectoryItems(!dirId && isSharedRoute ? "shared" : "local");
  }

  // Derived
  const combinedItems = [
    ...directoriesList.map((d) => ({ ...d, isDirectory: true })),
    ...filesList.map((f) => ({ ...f, isDirectory: false })),
  ];
  const q = searchQuery.trim().toLowerCase();
  const filteredDirs = combinedItems.filter(
    (i) => i.isDirectory && (!q || i.name?.toLowerCase().includes(q)),
  );
  const filteredFiles = combinedItems.filter(
    (i) => !i.isDirectory && (!q || i.name?.toLowerCase().includes(q)),
  );
  const uploadingFiles = uploadQueue;

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
          {
            headers: { "Content-Type": "application/json" },
          },
        )
        .then((res) => {
          toast({
            message: "Access granted successfully",
            type: "success",
          });
          navigate(`/directory/${dirId}`, { replace: true });
        })
        .catch((err) => {
          grantExecutedRef.current = false;
          toast({
            message: "Failed to grant access",
            type: "error",
          });
        });
    }
  }, [dirId]);
  if (needsAccess) {
    return <RequestAccessPage user={user} dirId={dirId} />;
  }

  const { windowWidth } = useSidebar();

  const handleSearchToggle = () => {
    setShowSearchBar((prev) => !prev);
  };
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

      {showSearchBar && windowWidth < 768 ? (
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          handleSearchToggle={handleSearchToggle}
          classNames="sticky top-0 z-[4] border-b border-transparent flex flex-0 items-center min-h-[64px]"
        />
      ) : (
        <DriveHeader
          handleSearchToggle={handleSearchToggle}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          disabled={isUploading}
        />
      )}

      <div className="gd-body">
        {user.email && (
          <DriveSidebar
            dirId={dirId}
            isHomeRoute={isHomeRoute}
            isSharedRoute={isSharedRoute}
            isTrashRoute={isTrashRoute}
            totalStorage={user.totalStorage}
            totalUsage={user.totalUsage}
            onCreateFolder={() => setShowCreateDir(true)}
            onUploadFiles={() => fileInputRef.current?.click()}
          />
        )}
        <div ref={mainContainerRef} className="gd-main-container">
          <main
            style={{ userSelect: "none" }}
            ref={mainRef}
            className="gd-main"
            onMouseDown={(e) => {
              if (
                e.target.closest(
                  ".gd-grid-item, .gd-list-row, .gd-context-menu",
                )
              )
                return;
              clearSelection();
              setContextItem(null);
              const { clientX, clientY } = e;
              setDragBox({
                x1: clientX,
                y1: clientY,
                x2: clientX,
                y2: clientY,
              });
            }}
            onMouseMove={(e) => {
              if (!dragBox) return;
              const newBox = { ...dragBox, x2: e.clientX, y2: e.clientY };
              setDragBox(newBox);
              const selBox = {
                left: Math.min(newBox.x1, newBox.x2),
                top: Math.min(newBox.y1, newBox.y2),
                right: Math.max(newBox.x1, newBox.x2),
                bottom: Math.max(newBox.y1, newBox.y2),
              };

              const els = mainRef.current.querySelectorAll("[data-id]");
              const newSelected = new Set();
              els.forEach((el) => {
                const r = el.getBoundingClientRect();
                if (
                  r.left < selBox.right &&
                  r.right > selBox.left &&
                  r.top < selBox.bottom &&
                  r.bottom > selBox.top
                ) {
                  newSelected.add(el.dataset.id);
                }
              });
              if (newSelected.size > 0) setSelectedItems(newSelected);
            }}
            onMouseUp={() => setDragBox(null)}
            onMouseLeave={() => setDragBox(null)}
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
                {/* Google Drive virtual folder row — shown on root when authenticated */}
                {isGoogleDrive &&
                  !dirId &&
                  isHomeRoute &&
                  viewMode === "grid" && (
                    <>
                      <div className="gd-section-label">Connected storage</div>

                      <div className="gd-grid" style={{ marginBottom: 8 }}>
                        <div
                          className="gd-grid-item"
                          onClick={() => navigate("/directory/google-drive")}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="gd-grid-item-preview">
                            <GoogleDriveSVG size={48} />
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "10px 8px 10px 12px",
                              gap: 8,
                            }}
                          >
                            <GoogleDriveSVG size={16} />
                            <span className="gd-grid-item-name">
                              Google Drive
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                {/* Empty state */}
                {combinedItems.length === 0 && !dirId && (
                  <div className="gd-empty">
                    <svg
                      width="120"
                      height="120"
                      viewBox="0 0 200 200"
                      fill="none"
                    >
                      <circle cx="100" cy="100" r="80" fill="#f1f3f4" />
                      <path
                        d="M60 130 L80 90 L120 90 L140 130 Z"
                        fill="#dadce0"
                      />
                      <path d="M80 90 L100 50 L120 90" fill="#bdc1c6" />
                    </svg>
                    <h3>This folder is empty</h3>
                    <p>
                      Drop files here or use the New button to add files and
                      folders.
                    </p>
                  </div>
                )}

                {/* Folders */}
                {filteredDirs.length > 0 && (
                  <>
                    {viewMode === "grid" ? (
                      <>
                        <div className="gd-section-label">Folders</div>

                        <div className="gd-grid">
                          {filteredDirs.map((item) => (
                            <GridItem
                              key={item._id}
                              item={item}
                              dirId={dirId}
                              avatar={item.userId?.avatar}
                              owner={item.userId?.name}
                              selected={selectedItems.has(item.id ?? item._id)}
                              onSelect={handleSelect}
                              selectionActive={selectedItems.size > 0}
                              onRowClick={handleRowClick}
                              onDoubleClick={handleRowDoubleClick}
                              onContextMenu={handleContextMenu}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        {listHeaderRow}

                        <div className="gd-list">
                          {filteredDirs.map((item) => (
                            <ListRow
                              key={item._id}
                              item={item}
                              dirId={dirId}
                              avatar={item.userId?.avatar}
                              owner={item.userId?.name}
                              selected={selectedItems.has(item.id ?? item._id)}
                              onSelect={handleSelect}
                              selectionActive={selectedItems.size > 0}
                              onRowClick={handleRowClick}
                              onDoubleClick={handleRowDoubleClick}
                              onContextMenu={handleContextMenu}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Files */}
                {filteredFiles.length > 0 && (
                  <>
                    {viewMode === "grid" ? (
                      <>
                        <div
                          className="gd-section-label"
                          style={{ marginTop: filteredDirs.length ? 16 : 0 }}
                        >
                          Files
                        </div>
                        <div className="gd-grid">
                          {filteredFiles.map((item) => (
                            <GridItem
                              key={item._id}
                              item={item}
                              dirId={dirId}
                              avatar={item.userId?.avatar}
                              owner={item.userId?.name}
                              selected={selectedItems.has(item.id ?? item._id)}
                              onSelect={handleSelect}
                              selectionActive={selectedItems.size > 0}
                              onRowClick={handleRowClick}
                              onDoubleClick={handleRowDoubleClick}
                              onContextMenu={handleContextMenu}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="gd-list">
                        {!filteredDirs.length && listHeaderRow}
                        {filteredFiles.map((item) => (
                          <ListRow
                            key={item._id}
                            item={item}
                            filteredDirs={filteredDirs}
                            dirId={dirId}
                            avatar={item.userId?.avatar}
                            owner={item.userId?.name}
                            selected={selectedItems.has(item.id ?? item._id)}
                            onSelect={handleSelect}
                            selectionActive={selectedItems.size > 0}
                            onRowClick={handleRowClick}
                            onDoubleClick={handleRowDoubleClick}
                            onContextMenu={handleContextMenu}
                          />
                        ))}
                      </div>
                    )}
                  </>
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

      {/* Create Folder Modal */}
      {showCreateDir && (
        <div
          className="gd-modal-overlay"
          onClick={() => setShowCreateDir(false)}
        >
          <div className="gd-modal" onClick={(e) => e.stopPropagation()}>
            <h2>New folder</h2>
            <form onSubmit={handleCreateDirectory}>
              <input
                type="text"
                value={newDirname}
                onChange={(e) => setNewDirname(e.target.value)}
                autoFocus
                onFocus={(e) => e.target.select()}
              />
              <div className="gd-modal-actions">
                <button
                  type="button"
                  className="gd-btn gd-btn-text"
                  onClick={() => setShowCreateDir(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="gd-btn gd-btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRename && (
        <div className="gd-modal-overlay" onClick={() => setShowRename(false)}>
          <div className="gd-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Rename</h2>
            <form onSubmit={handleRenameSubmit}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                onFocus={(e) => e.target.select()}
              />
              <div className="gd-modal-actions">
                <button
                  type="button"
                  className="gd-btn gd-btn-text"
                  onClick={() => setShowRename(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="gd-btn gd-btn-primary">
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedItems.size > 0 && (
        <div className="gd-selection-bar">
          <button
            className="gd-icon-btn gd-sel-close"
            title="Clear selection"
            onClick={() => {
              clearSelection();
              setContextItem(null);
            }}
          >
            <IconClose size={18} />
          </button>
          <span className="gd-selection-count">
            {selectedItems.size} selected
          </span>
          <div className="gd-selection-actions">
            {hasFileSelected && !isDeleted && (
              <button
                className="gd-sel-action-btn"
                title="Download"
                onClick={() => {
                  selectedItems.forEach((id) => {
                    const item = combinedItems.find(
                      (i) => (i.id ?? i._id) === id,
                    );
                    if (item && !item.isDirectory) handleDownload(item);
                  });
                  clearSelection();
                }}
              >
                <IconDownload size={18} />
              </button>
            )}
            {!isGoogleDriveRoute && !isTrashRoute && !isDeleted && (
              <>
                <button
                  className="gd-sel-action-btn"
                  title="Edit"
                  onClick={() => {
                    selectedItems.forEach((id) => {
                      const item = combinedItems.find(
                        (i) => (i.id ?? i._id) === id,
                      );
                      openRename(item);
                    });
                  }}
                >
                  <IconRename size={18} />
                </button>

                <button
                  className="gd-sel-action-btn"
                  title="Share"
                  onClick={() => {
                    const id = [...selectedItems][0];
                    const item = combinedItems.find(
                      (i) => (i.id ?? i._id) === id,
                    );
                    if (item) {
                      setShareItem(item);
                    }
                  }}
                >
                  <IconShare size={18} />
                </button>

                <button
                  className="gd-sel-action-btn gd-sel-action-danger"
                  title="Trash"
                  onClick={() => {
                    selectedItems.forEach((id) => {
                      const item = combinedItems.find(
                        (i) => (i.id ?? i._id) === id,
                      );

                      handleMoveToTrash(item);
                    });
                  }}
                >
                  <IconTrash size={18} />
                </button>
              </>
            )}
            {!isGoogleDriveRoute && (isTrashRoute || isDeleted) && (
              <>
                <button
                  className="gd-sel-action-btn gd-sel-action-success"
                  title="Restore"
                  onClick={() => {
                    selectedItems.forEach((id) => {
                      const item = combinedItems.find(
                        (i) => (i.id ?? i._id) === id,
                      );
                      handleRestoreItem(item);
                    });
                  }}
                >
                  <IconRestore size={18} />
                </button>
                <button
                  className="gd-sel-action-btn gd-sel-action-danger"
                  title="Delete Forever"
                  onClick={() => {
                    selectedItems.forEach((id) => {
                      const item = combinedItems.find(
                        (i) => (i.id ?? i._id) === id,
                      );
                      handleDelete(item);
                    });
                  }}
                >
                  <IconTrash size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Context Menu */}
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

      {/* File Viewer */}

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

      {/* Share Modal */}
      {shareItem && (
        <ShareModal
          item={shareItem}
          onClose={handleShareItem}
          setShareItem={setShareItem}
          isShareLoading={isShareLoading}
          setIsShareLoading={setIsShareLoading}
        />
      )}

      {/* Upload Tray */}
      <UploadTray
        dbFileId={dbFileId}
        uploadingFiles={uploadingFiles}
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
