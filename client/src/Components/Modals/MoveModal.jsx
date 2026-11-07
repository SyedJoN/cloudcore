
import { useState, useEffect, useMemo, useRef } from "react";
import {
  IconFolder,
  IconClose,
  IconChevronDown,
} from "./../Icons/Icons";
import { addDirectory } from "../../../apis/directoryApi";
import FileBadge from "../File/FileBadge";
import { getFileIcon } from "../../../Utils/displayUtils";
import { moveItem } from "../../../apis/resourceApi";
import { useToast } from "../../Contexts";
import {
  FolderIcon,
  InboxIcon,
} from "@heroicons/react/24/solid";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function MoveModal({
  item,
  items,
  route,
  currentDirId,
  setDirectoriesList,
  setFilesList,
  onClose,
}) {
  const { toast } = useToast();

  // Support both single item and multiple items
  const selectedItems = useMemo(
    () => items?.length ? items : item ? [item] : [],
    [items, item],
  );

  const isBulk = selectedItems.length > 1;

  const selectedIds = useMemo(
    () => new Set(selectedItems.map((i) => String(i._id ?? i.id))),
    [selectedItems],
  );

  const [breadcrumbs, setBreadcrumbs] = useState([
    { id: null, name: "My Drive" },
  ]);

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("Untitled folder");
  const [rootDirId, setRootDirId] = useState(null);

  const isStarredRoute = route === "starred";
  const isRecentRoute = route === "recent";

  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];

  // Disable moving only when every selected item is already here
  const isSameLocation = selectedItems.every(
    (selectedItem) =>
      String(selectedItem.parentDirId ?? "") ===
      String(currentCrumb?.id ?? ""),
  );

  // Prevent selecting a folder that is one of the selected items
  const isEmpty = folders.length === 0 && files.length === 0 && !isCreating;

  const locationIcon =
    currentCrumb.name === "My Drive" ? (
      <InboxIcon className="w-5 h-5" />
    ) : (
      <FolderIcon className="w-5 h-5" />
    );

  useEffect(() => {
    loadFolders(currentCrumb.id || "");
  }, [currentCrumb.id]);

  async function loadFolders(parentId) {
    setIsLoading(true);

    try {
      const api = parentId
        ? `/directory/${parentId}`
        : `/directory/`;

      const res = await fetch(`${BASE_URL}${api}`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to load folders");
      }

      const data = await res.json();

      if (!parentId) {
        setRootDirId(data._id);
      }

      setFolders(
        (data.directories || []).filter(
          (directory) => !selectedIds.has(String(directory._id)),
        ),
      );

      setFiles(data.files || []);
    } catch (err) {
      console.error("Load folders error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function navigateInto(folder) {
    setBreadcrumbs((prev) => [
      ...prev,
      { id: folder._id, name: folder.name },
    ]);
  }

  function navigateTo(index) {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }

  async function handleCreateFolder(e) {
    e.preventDefault();

    if (!newFolderName.trim()) return;

    try {
      const response = await addDirectory(
        currentCrumb.id,
        newFolderName.trim(),
        "local",
      );

      setIsCreating(false);
      setNewFolderName("Untitled folder");

      if (
        selectedItems.some(
          (selectedItem) =>
            String(selectedItem.parentDirId ?? "") ===
            String(currentCrumb.id ?? ""),
        )
      ) {
        setDirectoriesList((prev) => [response.data, ...prev]);
      }

      setFolders((prev) => [response.data, ...prev]);
    } catch (err) {
      toast({
        message: err.message || "Failed to create folder",
        type: "error",
      });
    }
  }

  async function handleMove() {
    if (!selectedItems.length || isMoving) return;

    setIsMoving(true);

    try {
      const destinationId = currentCrumb.id || rootDirId;

      const message = await moveItem({
        items: selectedItems,
        destinationId,
        destinationName: currentCrumb.name,
      });

      onClose();

      toast({
        message,
        type: "success",
      });

      if (isRecentRoute || isStarredRoute) return;

      const movedIds = new Set(
        selectedItems.map((i) => String(i._id ?? i.id)),
      );

      setDirectoriesList((prev) =>
        prev.filter(
          (directory) =>
            !movedIds.has(String(directory._id ?? directory.id)),
        ),
      );

      setFilesList((prev) =>
        prev.filter(
          (file) => !movedIds.has(String(file._id ?? file.id)),
        ),
      );
    } catch (err) {
      toast({
        message: err.response?.data?.message ||
          err.message ||
          "Something went wrong",
        type: "error",
      });

      setIsMoving(false);
    }
  }
  const lastTap = useRef(null);
    const handleTouchEnd = (folder) => {
    const now = Date.now();

    if (now - lastTap.current < 300) {
      navigateInto(folder)
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };


  return (
    <div className="gd-modal-overlay" onClick={onClose}>
      <div
        className="mv-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mv-header">
          <h2 className="mv-title">
            {isBulk
              ? `Move ${selectedItems.length} items`
              : `Move "${selectedItems[0]?.name}"`}
          </h2>

          <button className="gd-icon-btn" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>

        <div className="mv-breadcrumb">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;

            return (
              <span key={i} className="mv-breadcrumb-item">
                {!isLast ? (
                  <>
                    <button
                      className="mv-breadcrumb-btn"
                      onClick={() => navigateTo(i)}
                    >
                      <span className="mv-breadcrumb-current">
                        {crumb.name === "My Drive" ? (
                          <InboxIcon className="w-5 h-5" />
                        ) : (
                          <FolderIcon className="text-(--text-secondary) w-5 h-5" />
                        )}

                        {crumb.name}
                      </span>
                    </button>

                    <IconChevronDown
                      size={14}
                      style={{
                        transform: "rotate(-90deg)",
                        color: "var(--text-primary)",
                        flexShrink: 0,
                      }}
                    />
                  </>
                ) : (
                  <button className="mv-breadcrumb-btn">
                    <span className="mv-breadcrumb-current">
                      {locationIcon}
                      {crumb.name}
                    </span>
                  </button>
                )}
              </span>
            );
          })}
        </div>

        <div className="mv-folder-list">
          {isLoading ? (
            <div className="mv-loading">
              <div className="gd-spinner" />
            </div>
          ) : isEmpty ? (
            <div className="mv-empty">
              No items in this location
            </div>
          ) : (
            <>
              {folders.map((folder) => (
                <div
                  key={folder._id}
                  className="mv-folder-row"
                  onDoubleClick={() => navigateInto(folder)}
                  onTouchEnd={()=> handleTouchEnd(folder)}
                >
                  <IconFolder
                    size={20}
                    style={{
                      color: "#5f6368",
                      flexShrink: 0,
                    }}
                  />

                  <span className="mv-folder-name">
                    {folder.name}
                  </span>

                  <button
                    className="mv-open-btn"
                    title="Open folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateInto(folder);
                    }}
                  >
                    <IconChevronDown
                      size={16}
                      style={{ transform: "rotate(-90deg)" }}
                    />
                  </button>
                </div>
              ))}

              {files.map((file) => (
                <div
                  key={file._id}
                  className="mv-folder-row mv-file-row"
                >
                  <FileBadge type={getFileIcon(file.name)} />

                  <span className="mv-folder-name mv-file-name">
                    {file.name}
                  </span>
                </div>
              ))}
            </>
          )}

          {isCreating && (
            <form
              className="mv-new-folder-row"
              onSubmit={handleCreateFolder}
            >
              <IconFolder
                size={20}
                style={{
                  color: "#5f6368",
                  flexShrink: 0,
                }}
              />

              <input
                className="mv-new-folder-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                onFocus={(e) => e.target.select()}
              />

              <div className="mv-new-folder-actions">
                <button
                  type="button"
                  className="gd-btn gd-btn-text"
                  onClick={() => {
                    setIsCreating(false);
                    setNewFolderName("Untitled folder");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="gd-btn gd-btn-primary"
                >
                  Create
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mv-footer">
          <button
            className="mv-new-folder-btn"
            onClick={() => setIsCreating(true)}
            disabled={isCreating || isMoving}
          >
            + New folder
          </button>

          <div className="mv-footer-actions">
            <button
              className="gd-btn gd-btn-text"
              onClick={onClose}
              disabled={isMoving}
            >
              Cancel
            </button>

            <button
              className="gd-btn gd-btn-primary"
              onClick={handleMove}
              disabled={
                isSameLocation ||
                isMoving ||
                !selectedItems.length
              }
            >
              {isMoving ? "Moving…" : "Move here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
