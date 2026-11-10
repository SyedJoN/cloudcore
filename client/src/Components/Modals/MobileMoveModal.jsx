import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { IconFolder, IconClose } from "./../Icons/Icons";
import { addDirectory } from "../../../apis/directoryApi";
import FileBadge from "../File/FileBadge";
import { getFileIcon } from "../../../Utils/displayUtils";
import { moveItem } from "../../../apis/resourceApi";
import { useToast } from "../../Contexts";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FolderPlusIcon,
} from "@heroicons/react/24/outline";
import { StarIcon, UsersIcon } from "@heroicons/react/16/solid";
import SortButton from "../ListRow/SortButton";
import { applyRecentFilters, DEFAULT_RECENT_FILTERS } from "../Drive/Recent/ApplyRecentFilters";
import SortButtonMobile from "../ListRow/SortButtonMobile";
import MobileGridItem from "../Drive/MobileGridItem";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

const norm = (v) => {
  if (v == null || v === "") return null;
  return String(typeof v === "object" ? (v._id ?? v.id) : v);
};

const TABS = [{ id: "drive", label: "My Drive" }];

const FALLBACK_SORT = { key: "name", direction: "asc", folders: "top" };

function formatModified(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date)) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const text = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `Modified ${text}`;
}

function RowMeta({ entry }) {
  const starred = entry.isStarred ?? entry.starred;
  const shared = entry.isShared ?? entry.shared;
  const modified = formatModified(
    entry.updatedAt ?? entry.modifiedAt ?? entry.createdAt,
  );
  return (
    <span className="mv-row-sub">
      {starred && <StarIcon width={14} className="mv-meta-icon" />}
      {shared && <UsersIcon width={14} className="mv-meta-icon" />}
      {modified}
    </span>
  );
}

export default function MobileMoveModal({
  item,
  items,
  route,
  currentDirId: viewedDirId,
  setDirectoriesList,
  setFilesList,
  viewMode,
  onToggleView,
  sortConfig: sortConfigProp,
  setSortConfig,
  user,
  onClose,
}) {

  const { toast } = useToast();
  const searchRef = useRef(null);
  const tabsRef = useRef(null);

  const sortConfig = sortConfigProp ?? FALLBACK_SORT;

  // Freeze the selection at open time so parent state changes can't empty it
  const [selectedItems] = useState(() =>
    items?.length ? items : item ? [item] : [],
  );
  const selectedIds = useMemo(
    () => new Set(selectedItems.map((i) => String(i._id ?? i.id))),
    [selectedItems],
  );

  // Navigation
  const [activeTab, setActiveTab] = useState("drive");
  const [breadcrumbs, setBreadcrumbs] = useState([
    { id: null, name: "My Drive" },
  ]);
  const [direction, setDirection] = useState("forward");
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];
  const isRoot = breadcrumbs.length === 1;

  // Data
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [rootDirId, setRootDirId] = useState(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("Untitled folder");
  const [isCreating, setIsCreating] = useState(false);
  const [filters] = useState(DEFAULT_RECENT_FILTERS);

  const isStarredRoute = route === "starred";
  const isRecentRoute = route === "recent";
  const isDriveTab = activeTab === "drive";

  // Move logic
  const rootId = norm(rootDirId);
  const destId = norm(currentCrumb.id) ?? rootId;
  const currentDirId = destId;

const sourceOf = (s) => {
  const own = norm(
    s.parentDirId ?? s.parentId ?? s.parent ?? s.directoryId ?? s.dirId,
  );
  return own ?? norm(viewedDirId) ?? rootId;
};
  const isSameLocation =
    selectedItems.length > 0 &&
    selectedItems.every((s) => sourceOf(s) === destId);

  const canMove =
    isDriveTab &&
    !!destId &&
    !isSameLocation &&
    !isMoving &&
    selectedItems.length > 0;

  // List data: tag, search, filter, sort
  const allEntries = useMemo(
    () => [
      ...folders.map((f) => ({ ...f, isDirectory: true })),
      ...files.map((f) => ({ ...f, isDirectory: false })),
    ],
    [folders, files],
  );

  const searchedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q
      ? allEntries.filter((e) => e.name?.toLowerCase().includes(q))
      : allEntries;
  }, [allEntries, searchQuery]);

  const filteredItems = useMemo(
    () => applyRecentFilters(searchedItems, filters, user),
    [searchedItems, filters, user],
  );

  const sortedItems = useMemo(() => {
    const data = [...filteredItems];

    data.sort((a, b) => {
      if (sortConfig.folders === "top") {
        const aIsFolder = a.isDirectory === true;
        const bIsFolder = b.isDirectory === true;
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
      }

      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "name":
          aValue = (a.sortName ?? a.name)?.toLowerCase() || "";
          bValue = (b.sortName ?? b.name)?.toLowerCase() || "";
          break;
        case "modifiedTime":
          aValue = new Date(
            a.sortModifiedTime || a.modifiedTime || a.updatedAt || 0,
          ).getTime();
          bValue = new Date(
            b.sortModifiedTime || b.modifiedTime || b.updatedAt || 0,
          ).getTime();
          break;
        case "sharedWithMeTime":
          aValue = new Date(a.sharedWithMeTime || 0).getTime();
          bValue = new Date(b.sharedWithMeTime || 0).getTime();
          break;
        case "trashedTime":
          aValue = new Date(a.trashedTime || 0).getTime();
          bValue = new Date(b.trashedTime || 0).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [filteredItems, sortConfig]);

  const FoldersOnTop = viewMode === "grid" && sortConfig.folders === "top";
  const containsDirectory = sortedItems.some((i) => i.isDirectory);
  const isEmpty = sortedItems.length === 0;

  // Load directory
  useEffect(() => {
    if (!isDriveTab) {
      setFolders([]);
      setFiles([]);
      setIsLoading(false);
      return;
    }
    loadFolders(currentCrumb.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCrumb.id, activeTab]);

  useEffect(() => {
    if (isSearching) searchRef.current?.focus();
  }, [isSearching]);

  // Sliding tab indicator
  useLayoutEffect(() => {
    const el = tabsRef.current?.querySelector(".mv-tab.active");
    if (!el) return;
    setIndicator({ left: el.offsetLeft + 32, width: el.offsetWidth - 64 });
    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTab, isRoot]);

  function requestClose() {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(onClose, 220);
  }

  async function loadFolders(parentId) {
    setIsLoading(true);
    try {
      const api = parentId ? `/directory/${parentId}` : "/directory/";
      const response = await fetch(`${BASE_URL}${api}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load folders");
      const data = await response.json();

      if (!parentId) setRootDirId(data._id);

      setFolders(
        (data.directories || []).filter((d) => !selectedIds.has(String(d._id))),
      );
      setFiles(data.files || []);
    } catch (error) {
      
      toast({
        message: error.message || "Failed to load folders",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function selectTab(id) {
    if (id === activeTab && isRoot) return;
    setDirection("forward");
    setSearchQuery("");
    setIsSearching(false);
    setBreadcrumbs([{ id: null, name: "My Drive" }]);
    setActiveTab(id);
  }

function navigateInto(folder) {
  setDirection("forward");
  setSearchQuery("");
  setIsSearching(false);
  setBreadcrumbs((prev) => [...prev, { id: folder._id ?? folder.id, name: folder.name }]);
}
  function goBack() {
    if (isSearching) {
      setIsSearching(false);
      setSearchQuery("");
      return;
    }
    if (!isRoot) {
      setDirection("back");
      setBreadcrumbs((prev) => prev.slice(0, -1));
    } else {
      requestClose();
    }
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const response = await addDirectory(
        currentCrumb.id,
        newFolderName.trim(),
        "local",
      );
      const newFolder = response.data;
      setFolders((prev) => [newFolder, ...prev]);

      if (selectedItems.some((s) => sourceOf(s) === destId)) {
        setDirectoriesList((prev) => [newFolder, ...prev]);
      }
      setShowNewFolder(false);
      setNewFolderName("Untitled folder");
    } catch (error) {
      toast({
        message:
          error.response?.data?.message ||
          error.message ||
          "Failed to create folder",
        type: "error",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleMove() {
    if (!canMove) return;
    setIsMoving(true);
    try {
      const response = await moveItem({
        items: selectedItems,
        destinationId: currentDirId,
        destinationName: currentCrumb.name,
      });

      const message =
        typeof response === "string"
          ? response
          : response?.message || "Items moved successfully";

      toast({ message, type: "success" });
      requestClose();

      if (isRecentRoute || isStarredRoute) return;

      const movedIds = new Set(selectedItems.map((i) => String(i._id ?? i.id)));
      setDirectoriesList((prev) =>
        prev.filter((d) => !movedIds.has(String(d._id ?? d.id))),
      );
      setFilesList((prev) =>
        prev.filter((f) => !movedIds.has(String(f._id ?? f.id))),
      );
    } catch (error) {
      toast({
        message:
          error.response?.data?.message ||
          error.message ||
          "Failed to move items",
        type: "error",
      });
      setIsMoving(false);
    }
  }
console.log({ destId, sources: selectedItems.map(sourceOf), selectedItems });
  // Renders one folder/file in list or grid
function renderEntry(entry) {
  const id = entry._id ?? entry.id;

  if (viewMode === "grid") {
    return (
      <MobileGridItem
        key={id}
        item={entry}
        pickerMode
        disabled={!entry.isDirectory}
        onOpen={entry.isDirectory ? navigateInto : undefined}
      />
    );
  }

  // list view stays as before
  return entry.isDirectory ? (
    <button key={id} type="button" className="mv-row" onClick={() => navigateInto(entry)}>
      <span className="mv-row-icon"><IconFolder size={32} color="#c4c7c5" /></span>
      <span className="mv-row-text">
        <span className="mv-row-name">{entry.name}</span>
        <RowMeta entry={entry} />
      </span>
    </button>
  ) : (
    <div key={id} className="mv-row disabled" aria-disabled>
      <span className="mv-row-icon mv-file-tile"><FileBadge type={getFileIcon(entry.name)} /></span>
      <span className="mv-row-text">
        <span className="mv-row-name">{entry.name}</span>
        <RowMeta entry={entry} />
      </span>
    </div>
  );
}

  return (
    <div className={`mv-screen ${isClosing ? "closing" : ""}`}>
      {/* TOP APP BAR */}
      <header className="mv-appbar">
        <button
          type="button"
          className="mv-icon-btn"
          onClick={goBack}
          aria-label={isRoot && !isSearching ? "Close" : "Back"}
        >
          {isRoot && !isSearching ? (
            <IconClose size={24} />
          ) : (
            <ArrowLeftIcon width={24} />
          )}
        </button>

        {isSearching ? (
          <input
            ref={searchRef}
            className="mv-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in Drive"
          />
        ) : (
          <div className="mv-title-mobile" key={isRoot ? "root" : currentCrumb.id}>
            {isRoot ? "Select destination" : currentCrumb.name}
          </div>
        )}

        {isSearching ? (
          searchQuery && (
            <button
              type="button"
              className="mv-icon-btn"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <IconClose size={22} />
            </button>
          )
        ) : (
          <div className="mv-options">
            <button
              type="button"
              className="mv-icon-btn"
              onClick={() => setShowNewFolder(true)}
              disabled={!isDriveTab || isMoving}
              aria-label="New folder"
            >
              <FolderPlusIcon width={24} />
            </button>
            <button
              type="button"
              className="mv-icon-btn"
              onClick={() => setIsSearching(true)}
              aria-label="Search"
            >
              <MagnifyingGlassIcon width={24} />
            </button>
          </div>
        )}
      </header>

      {/* TABS (root only) */}
      <div className={`mv-tabs-wrap ${isRoot && !isSearching ? "open" : ""}`}>
        <nav className="mv-tabs" ref={tabsRef}>
          <div className="mv-tabs-inner">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`mv-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => selectTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            <span
              className="mv-tab-indicator"
              style={{
                width: indicator.width,
                transform: `translateX(${indicator.left}px)`,
              }}
            />
          </div>
        </nav>
      </div>

      {/* LIST */}
      <main className="mv-content">
        <div className="mv-sort-btn py-2 px-5">
          <SortButtonMobile
            viewMode={viewMode}
            onToggleView={onToggleView}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
          />
        </div>

        {isLoading ? (
          <div className="mv-loading">
            <div className="mv-spinner" />
          </div>
        ) : (
          <div
            key={`${activeTab}-${currentCrumb.id ?? "root"}`}
            className={`mv-list mv-slide-${direction}`}
          >
            {isEmpty ? (
              <div className="mv-empty">
                <IconFolder size={64} color="#5f6368" />
                <p>
                  {searchQuery
                    ? "No results found"
                    : isDriveTab
                      ? "This folder is empty"
                      : "Nothing here yet"}
                </p>
              </div>
            ) : FoldersOnTop ? (
              <>
                {containsDirectory && (
                  <>
                    <div className="mv-grid">
                      {sortedItems.filter((i) => i.isDirectory).map(renderEntry)}
                    </div>
                  </>
                )}
                {sortedItems.some((i) => !i.isDirectory) && (
                  <>
        
                    <div className="mv-grid">
                      {sortedItems
                        .filter((i) => !i.isDirectory)
                        .map(renderEntry)}
                    </div>
                  </>
                )}
              </>
            ) : viewMode === "grid" ? (
              <div className="mv-grid">{sortedItems.map(renderEntry)}</div>
            ) : (
              sortedItems.map(renderEntry)
            )}
          </div>
        )}
      </main>

      {/* BOTTOM BAR */}
      <footer className="mv-bottom-bar">
        <button
          type="button"
          className="mv-btn-cancel"
          onClick={requestClose}
          disabled={isMoving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="mv-btn-move"
          onClick={handleMove}
          disabled={!canMove}
        >
          {isMoving ? "Moving…" : "Move"}
        </button>
      </footer>

      {/* NEW FOLDER DIALOG */}
      {showNewFolder && (
        <div
          className="mv-dialog-scrim"
          onClick={() => setShowNewFolder(false)}
        >
          <form
            className="mv-dialog"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateFolder}
          >
            <h2>New folder</h2>
            <input
              className="mv-dialog-input"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onFocus={(e) => e.target.select()}
              autoFocus
            />
            <div className="mv-dialog-actions">
              <button
                type="button"
                className="mv-dialog-btn"
                onClick={() => setShowNewFolder(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="mv-dialog-btn"
                disabled={!newFolderName.trim() || isCreating}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}