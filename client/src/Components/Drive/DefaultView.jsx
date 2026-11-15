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
import ViewToggleMobile from "./ViewToggleMobile";
import { sortItems } from "../../../Utils/sortItems";

const DefaultView = ({
  items,
  sortConfig,
  setSortConfig,
  setSortedFilesForViewer,
  combinedItems,
  isSharedRoute,
  isTrashRoute,
  isDriveRoute,
  isGoogleDriveRoute,
  isRecentRoute,
  viewMode,
  dirId,
  isDesktop,
  isMobile,
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
  onMultiContextMenu,
  listHeaderRow,
  isStarred,
  setIsStarred,
  route,
  onStar,
  clearSelection,
}) => {
  const [filters, setFilters] = useState(DEFAULT_RECENT_FILTERS);
  const { user } = useAuth();

  const filteredItems = useMemo(
    () => applyRecentFilters(items, filters, user),
    [items, filters, user],
  );
  const sortedItems = useMemo(
    () => sortItems(filteredItems, sortConfig),
    [filteredItems, sortConfig],
  );

  const sortedFiles = useMemo(
    () => sortedItems.filter((i) => !i.isDirectory),
    [sortedItems],
  );

  useEffect(() => {
    setSortedFilesForViewer(sortedFiles);
  }, [sortedFiles]);

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
            <div className="flex items-center">
              <SortButtonMobile
                sortConfig={sortConfig}
                setSortConfig={setSortConfig}
                isSharedRoute={isSharedRoute}
                isDesktop={isDesktop}
              />
              <ViewToggleMobile
                viewMode={viewMode}
                onToggleView={onToggleView}
              />
            </div>
          ) : (
            <SortButton
              viewMode={viewMode}
              onToggleView={onToggleView}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
              isDesktop={isDesktop}
              isSharedRoute={isSharedRoute}
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
                    onClick={onMultiContextMenu}
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
                      isGoogleDriveRoute
                        ? user.avatar
                        : item.userId?.avatar || item.owners?.[0]?.photoLink
                    }
                    owner={item.userId?.name || item.owners?.[0]?.displayName}
                    email={item.userId?.email || item.owners?.[0]?.emailAddress}
                    isDriveRoute={isDriveRoute}
                    isGoogleDriveRoute={isGoogleDriveRoute}
                    isTrashRoute={isTrashRoute}
                    isSharedRoute={isSharedRoute}
                    isRecentRoute={isRecentRoute}
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
                      isDriveRoute={isDriveRoute}
                    isGoogleDriveRoute={isGoogleDriveRoute}
                    isTrashRoute={isTrashRoute}
                    isSharedRoute={isSharedRoute}
                    isRecentRoute={isRecentRoute}
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
