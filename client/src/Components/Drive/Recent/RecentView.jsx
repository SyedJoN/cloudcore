
import { useState, useMemo } from "react";
import RecentFilters from "./RecentFilters";
import { groupByTime, groupItemsByRecency } from "./RecencyBuckets.js";
import {
  applyRecentFilters,
  DEFAULT_RECENT_FILTERS,
} from "./ApplyRecentFilters";

import { GridItem, ListRow } from "..";
import { useAuth } from "../../../Contexts";

import SortButton from "../../ListRow/SortButton.jsx";
import SortButtonMobile from "../../ListRow/SortButtonMobile.jsx";
import ViewToggleMobile from "../ViewToggleMobile.jsx";

import MobileGridItem from "../MobileGridItem.jsx";
import MobileListRow from "../MobileListRow.jsx";
import MobileSharedListRow from "../MobileSharedListRow.jsx";

import { MdClose } from "react-icons/md";
import {
  ChevronLeftIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/solid";
import { MdOutlineSelectAll } from "react-icons/md";

import { sortItems } from "../../../../Utils/sortItems.js";
import { getSortTime } from "../../../../Utils/getSortTime.js";

export default function RecentView({
  items,
  sortConfig,
  setSortConfig,
  viewMode,
  isMobile,
  isDesktop,
  isRecentRoute,
  onToggleView,
  setSelectedItems,
  selectionMode,
  setSelectionMode,
  isSharedRoute,
  dirId,
  isStarred,
  setIsStarred,
  selectedItems,
  onSelect,
  onRowClick,
  onDoubleClick,
  onContextMenu,
  onMultiContextMenu,
  onShare,
  onRename,
  onDownload,
  onStar,
  route,
  listHeaderRow,
  combinedItems = [],
  handleSelectAll,
  handleDropOnTrash,
  onMove,
  clearSelection,
}) {
  const { user } = useAuth();

  const [filters, setFilters] = useState(DEFAULT_RECENT_FILTERS);

  // Apply filters
  const filteredItems = useMemo(
    () => applyRecentFilters(items, filters, user),
    [items, filters, user]
  );

  // Sort and group items
  const groups = useMemo(() => {
    const isNameSort = sortConfig.key === "name";

    // Name sorting: no recency grouping
    if (isNameSort) {
      const sorted = sortItems(filteredItems, sortConfig);

      if (sortConfig.folders === "top") {
        return [
          {
            label: "",
            items: [
              ...sorted.filter((item) => item.isDirectory),
              ...sorted.filter((item) => !item.isDirectory),
            ],
          },
        ];
      }

      return [{ label: "", items: sorted }];
    }

    // Date sorting
    const sorted = sortItems(filteredItems, {
      ...sortConfig,
      folders: "mixed",
    });

    // Shared route uses selected sort date
    // Recent route uses its normal recency grouping
    const grouped = isSharedRoute
      ? groupByTime(sorted, (item) =>
          getSortTime(item, sortConfig.key)
        )
      : groupItemsByRecency(sorted);

    // Folders on top: apply to BOTH Recent and Shared routes
    if (sortConfig.folders === "top") {
      return grouped.map((group) => ({
        ...group,
        items: [
          ...group.items.filter((item) => item.isDirectory),
          ...group.items.filter((item) => !item.isDirectory),
        ],
      }));
    }

    return grouped;
  }, [filteredItems, sortConfig, isSharedRoute]);

  // Separate folder and file components
  const FoldersOnTop =
    isDesktop &&
    viewMode === "grid" &&
    sortConfig.folders === "top";

  const ItemComponent = isDesktop
    ? viewMode === "grid"
      ? GridItem
      : ListRow
    : viewMode === "grid"
      ? MobileGridItem
      : isSharedRoute
        ? MobileSharedListRow
        : MobileListRow;

  // Shared props for both folder and file rendering
  const getItemProps = (item) => ({
    item,
    dirId,
    avatar: item.userId?.avatar || item.owners?.[0]?.photoLink,
    owner:
      item.userId?.name ||
      item.owners?.[0]?.displayName,
    email:
      item.userId?.email ||
      item.owners?.[0]?.emailAddress,
    selected: selectedItems.has(item.id ?? item._id),
    selectedItems,
    selectionMode,
    setSelectionMode,
    setSelectedItems,
    selectionActive: selectedItems.size > 0,
    onSelect,
    onRowClick,
    onDoubleClick,
    onContextMenu,
    onDownload,
    onRename,
    isStarred,
    setIsStarred,
    route,
    onShare,
    onStar,
    clearSelection,
    combinedItems,
    handleSelectAll,
    handleDropOnTrash,
    onMove,
    selectedItemsSize: selectedItems.size,
    sortKey: sortConfig?.key,
  });

  const renderItem = (item) => (
    <ItemComponent
      key={item._id ?? item.id}
      {...getItemProps(item)}
    />
  );

  return (
    <div className="gd-recent">
      {isDesktop && (
        <RecentFilters
          items={items}
          filters={filters}
          onChange={setFilters}
          user={user}
          isRecentRoute={isRecentRoute}
        />
      )}

      {(isDesktop && viewMode === "grid" && !isRecentRoute) ||
      (isMobile && !isRecentRoute) ? (
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
                <p className="mlr-bar-count">
                  {selectedItems.size} selected
                </p>

                <div className="flex">
                  <button
                    onClick={() => handleSelectAll?.()}
                    aria-label="Select all"
                    className="mlr-bar-btn"
                  >
                    <MdOutlineSelectAll className="h-6 w-6" />
                  </button>

                  <button
                    onClick={onMultiContextMenu}
                    aria-label="More options"
                    className="mlr-bar-btn"
                  >
                    <EllipsisVerticalIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="sort-btn pl-1">
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
              isSharedRoute={isSharedRoute}
              isDesktop={isDesktop}
              />
            )}
          </div>
        </>
      ) : null}

      {viewMode === "list" && isDesktop && listHeaderRow}

      {groups.length === 0 ||
      groups.every((group) => group.items.length === 0) ? (
        <div className="gd-empty">
          <h3>No matching files</h3>
          <p>Try adjusting or clearing your filters.</p>
        </div>
      ) : (
        groups.map(({ label, items: groupItems }, groupIndex) => {
          const folders = groupItems.filter(
            (item) => item.isDirectory
          );

          const files = groupItems.filter(
            (item) => !item.isDirectory
          );

          return (
            <div
              key={label || `group-${groupIndex}`}
              className="gd-recency-group"
            >
              {label && (
                <div className="gd-section-label">
                  {label}
                </div>
              )}

              {/* Folders on top - same grid rendering style as DefaultView */}
              {FoldersOnTop && folders.length > 0 && (
                <div className="gd-grid gd-grid-on-top">
                  {folders.map(renderItem)}
                </div>
              )}

              {/* Remaining files */}
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
                {(FoldersOnTop ? files : groupItems).map(renderItem)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
