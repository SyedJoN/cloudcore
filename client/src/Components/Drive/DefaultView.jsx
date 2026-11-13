import { useEffect, useMemo, useState } from "react";
import {
  applyRecentFilters,
  DEFAULT_RECENT_FILTERS,
} from "./Recent/ApplyRecentFilters";
import { GridItem, ListRow } from ".";
import {
  ChevronLeftIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/solid";
import RecentFilters from "./Recent/RecentFilters";
import SortButton from "../ListRow/SortButton";
import { useAuth } from "../../Contexts";
import { useDevice } from "../../Contexts/DeviceContext";
import MobileListRow from "./MobileListRow";
import MobileGridItem from "./MobileGridItem";
import SortButtonMobile from "../ListRow/SortButtonMobile";
import { MdOutlineSelectAll, MdClose } from "react-icons/md";

const DefaultView = ({
  items,
  sortConfig,
  setSortConfig,
  setSortedFilesForViewer,
  combinedItems,
  viewMode,
  isGoogleDrive,
  dirId,
  selectedItems,
  setSelectedItems,
  handleDropOnTrash,
  handleSelectAll,
  onSelect,
  onToggleView,
  onRowClick,
  onDoubleClick,
  selectionMode,
  setSelectionMode,
  onDownload,
  onRename,
  onShare,
  onMove,
  onContextMenu,
  listHeaderRow,
  isStarred,
  setIsStarred,
  route,
  onStar,
  clearSelection,
}) => {
  const [filters, setFilters] = useState(DEFAULT_RECENT_FILTERS);
  const { user } = useAuth();
  const { device } = useDevice();

  const isDesktop = device === "windows";
  const isMobile = device === "mobile";

  const filteredItems = useMemo(
    () => applyRecentFilters(items, filters, user),
    [items, filters, user],
  );

  const sortedItems = useMemo(() => {
    const data = [...filteredItems];

    data.sort((a, b) => {
      if (sortConfig.folders === "top") {
        const aIsFolder = a.isDirectory === true;
        const bIsFolder = b.isDirectory === true;

        if (aIsFolder && !bIsFolder) {
          return -1;
        }

        if (!aIsFolder && bIsFolder) {
          return 1;
        }
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

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }

      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }

      return 0;
    });

    return data;
  }, [filteredItems, sortConfig]);

  useEffect(() => {
    setSortedFilesForViewer(sortedItems.filter((i) => !i.isDirectory));
  }, [sortedItems]);

  const ItemComponent = isDesktop
    ? viewMode === "grid"
      ? GridItem
      : ListRow
    : viewMode === "grid"
      ? MobileGridItem
      : MobileListRow;

  const FoldersOnTop =
    isDesktop && viewMode === "grid" && sortConfig.folders === "top";

  const containsDirectory = sortedItems.some((item) => item.isDirectory);

  const isGoogleDriveRoute = route === "google-drive";
  const handleMultiContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const selectedIds = new Set([...selectedItems].map(String));
    const getId = (i) => String(i?.id ?? i?._id);

    const ids = combinedItems
      .map(getId)
      .filter((id) => selectedIds.has(String(id)));

    if (!ids.length) return;

    onContextMenu?.(e, ids);
  };
  return (
    <div className="gd-drive">
      {isDesktop && (
        <RecentFilters
          items={items}
          filters={filters}
          onChange={setFilters}
          user={user}
        />
      )}
      {(isDesktop ? viewMode === "grid" : true) && (
        <div className="sort-btn pb-2 -mx-1.5 py-2">
          {isMobile ? (
            <SortButtonMobile
              viewMode={viewMode}
              onToggleView={onToggleView}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
          ) : (
            <SortButton
              viewMode={viewMode}
              onToggleView={onToggleView}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
          )}
        </div>
      )}
      {isDesktop ? viewMode === "list" && listHeaderRow : null}

      {sortedItems.length === 0 ? (
        <div className="gd-empty">
          <h3>No matching files</h3>
          <p>Try adjusting or clearing your filters.</p>
        </div>
      ) : (
        <>
          {selectionMode && (
            <div className="mlr-selection-bar">
              <button
                onClick={() => {
                  setSelectedItems(new Set());
                  setSelectionMode(false);
                }}
                aria-label="Back"
                className="mlr-bar-btn"
              >
                {selectedItems.size >= combinedItems.length ? (
                  <MdClose className="h-6 w-6" />
                ) : (
                  <ChevronLeftIcon className="h-6 w-6" />
                )}
              </button>
              <div className="flex items-center justify-between flex-1">
                <p className="mlr-bar-count">{selectedItems.size} selected</p>
                <div className="flex">
                  <button
                    onClick={() => handleSelectAll?.()}
                    aria-label="Back"
                    className="mlr-bar-btn"
                  >
                    <MdOutlineSelectAll className="h-6 w-6" />
                  </button>
                  <button
                    onClick={handleMultiContextMenu}
                    aria-label="Back"
                    className="mlr-bar-btn"
                  >
                    <EllipsisVerticalIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {FoldersOnTop && containsDirectory && (
            <div className={`gd-grid ${isMobile ? "" : "gd-grid-on-top"}`}>
              {sortedItems
                .filter((s) => s.isDirectory)
                .map((item) => (
                  <ItemComponent
                    key={item._id ?? item.id}
                    item={item}
                    combinedItems={combinedItems}
                    dirId={dirId}
                    avatar={
                      isGoogleDrive
                        ? user.avatar
                        : item.userId?.avatar || item.owners?.[0]?.photoLink
                    }
                    owner={item.userId?.name || item.owners?.[0]?.displayName}
                    email={item.userId?.email || item.owners?.[0]?.emailAddress}
                    selected={selectedItems.has(item.id ?? item._id)}
                    setSelectedItems={setSelectedItems}
                    selectedItemsSize={selectedItems.size}
                    selectedItems={selectedItems}
                    handleSelectAll={handleSelectAll}
                    handleDropOnTrash={handleDropOnTrash}
                    selectionMode={selectionMode}
                    setSelectionMode={setSelectionMode}
                    onMove={(ids, destinationId, destinationName) => {
                      onMove?.(ids, destinationId, destinationName);
                    }}
                    onSelect={onSelect}
                    onDownload={onDownload}
                    onRename={onRename}
                    selectionActive={selectedItems.size > 0}
                    onRowClick={onRowClick}
                    onDoubleClick={onDoubleClick}
                    onContextMenu={onContextMenu}
                    isStarred={isStarred}
                    setIsStarred={setIsStarred}
                    route={route}
                    onShare={onShare}
                    onStar={onStar}
                    clearSelection={clearSelection}
                  />
                ))}
            </div>
          )}
          <div
            className={
              viewMode === "grid"
                ? isMobile
                  ? "mgi-grid"
                  : "gd-grid"
                : isMobile
                  ? "gd-list mobile"
                  : "gd-list"
            }
          >
            {sortedItems
              .filter((s) => (FoldersOnTop ? !s.isDirectory : s))
              .map((item) => (
                <ItemComponent
                  key={item._id ?? item.id}
                  item={item}
                  combinedItems={combinedItems}
                  dirId={dirId}
                  avatar={
                    isGoogleDriveRoute
                      ? user.avatar
                      : item.userId?.avatar || item.owners?.[0]?.photoLink
                  }
                  owner={item.userId?.name || item.owners?.[0]?.displayName}
                  email={item.userId?.email || item.owners?.[0]?.emailAddress}
                  selected={selectedItems.has(item.id ?? item._id)}
                  setSelectedItems={setSelectedItems}
                  selectedItems={selectedItems}
                  selectedItemsSize={selectedItems.size}
                  handleSelectAll={handleSelectAll}
                  handleDropOnTrash={handleDropOnTrash}
                  selectionMode={selectionMode}
                  setSelectionMode={setSelectionMode}
                  onMove={(ids, destinationId, destinationName) => {
                    onMove?.(ids, destinationId, destinationName);
                  }}
                  onSelect={onSelect}
                  onDownload={onDownload}
                  onRename={onRename}
                  selectionActive={selectedItems.size > 0}
                  onRowClick={onRowClick}
                  onDoubleClick={onDoubleClick}
                  onContextMenu={onContextMenu}
                  isStarred={isStarred}
                  setIsStarred={setIsStarred}
                  route={route}
                  onShare={onShare}
                  onStar={onStar}
                  clearSelection={clearSelection}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
};

export default DefaultView;
