import { useState, useMemo, useEffect } from "react"; // adjust to your actual barrel export path
import RecentFilters from "./RecentFilters";
import { groupItemsByRecency } from "./RecencyBuckets.js";
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
import { Divider } from "../../Divider.jsx";

export default function RecentView({
  items,
  sortConfig,
  setSortConfig,
  viewMode,
  isMobile,
  isDesktop,
  isRecentRoute,
  onToggleView,
  isSharedRoute,
  dirId,
  isStarred,
  setIsStarred,
  selectedItems,
  onSelect,
  onRowClick,
  onDoubleClick,
  onContextMenu,
  onShare,
  onRename,
  onDownload,
  onStar,
  route,
  listHeaderRow,
}) {
  const { user } = useAuth();
  const [filters, setFilters] = useState(DEFAULT_RECENT_FILTERS);

  const filteredItems = useMemo(
    () => applyRecentFilters(items, filters, user),
    [items, filters, user],
  );

  const groups = useMemo(
    () => groupItemsByRecency(filteredItems),
    [filteredItems],
  );

  const ItemComponent = isDesktop
    ? viewMode === "grid"
      ? GridItem
      : ListRow
    : viewMode === "grid"
      ? MobileGridItem
      : MobileListRow;

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
        <div className="sort-btn pl-1">
          {isMobile ? (
            <div className="flex items-center">
              <SortButtonMobile
                sortConfig={sortConfig}
                setSortConfig={setSortConfig}
                />
              <ViewToggleMobile
                viewMode={viewMode}
                onToggleView={onToggleView}
                />
            </div>
          ) : (
            <SortButton
            isSharedRoute={isSharedRoute}
            viewMode={viewMode}
            onToggleView={onToggleView}
            sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
          )}
        </div>
      ) : null}
      {viewMode === "list" && isDesktop && listHeaderRow}

      {groups.map(({ label, items: groupItems }) => (
        <div key={label} className="gd-recency-group">
          <div className="gd-section-label">{label}</div>
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
            {groupItems.map((item) => (
              <ItemComponent
                key={item._id ?? item.id}
                item={item}
                dirId={dirId}
                avatar={item.userId?.avatar}
                owner={item.userId?.name || item.owners?.[0].displayName}
                email={item.userId?.email || item.owners?.[0]?.emailAddress}
                selected={selectedItems.has(item.id ?? item._id)}
                selectedItems={selectedItems}
                onSelect={onSelect}
                selectionActive={selectedItems.size > 0}
                onRowClick={onRowClick}
                onDownload={onDownload}
                onRename={onRename}
                onDoubleClick={onDoubleClick}
                onContextMenu={onContextMenu}
                isStarred={isStarred}
                setIsStarred={setIsStarred}
                route={route}
                onShare={onShare}
                onStar={onStar}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
