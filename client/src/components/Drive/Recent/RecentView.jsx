import { useState, useMemo, useEffect } from "react"; // adjust to your actual barrel export path
import RecentFilters from "./RecentFilters";
import { groupItemsByRecency } from "./RecencyBuckets.js";
import {
  applyRecentFilters,
  DEFAULT_RECENT_FILTERS,
} from "./ApplyRecentFilters";
import { GridItem, ListRow } from "..";
import { useAuth } from "../../../Contexts";

export default function RecentView({
  items,
  sortConfig,
  viewMode,
  isRecentRoute,
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
const sortedItems = useMemo(() => {
  return groups.map((group) => {
    const sortedGroupItems = [...group.items].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "name":
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
          break;

        case "modifiedTime":
          aValue = new Date(
            a.modifiedTime || a.updatedAt
          ).getTime();
          bValue = new Date(
            b.modifiedTime || b.updatedAt
          ).getTime();
          break;

        case "sharedWithMeTime":
          aValue = new Date(a.sharedWithMeTime).getTime();
          bValue = new Date(b.sharedWithMeTime).getTime();
          break;

        case "trashedTime":
          aValue = new Date(a.trashedTime).getTime();
          bValue = new Date(b.trashedTime).getTime();
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

    return {
      ...group,
      items: sortedGroupItems,
    };
  });
}, [groups, sortConfig]);

  const ItemComponent = viewMode === "grid" ? GridItem : ListRow;

  return (
    <div className="gd-recent">
      <RecentFilters
        items={items}
        filters={filters}
        onChange={setFilters}
        user={user}
        isRecentRoute={isRecentRoute}
      />
      {viewMode === "list" && listHeaderRow}

      {sortedItems.length === 0 ? (
        <div className="gd-empty">
          <h3>No matching files</h3>
          <p>Try adjusting or clearing your filters.</p>
        </div>
      ) : (
        sortedItems.map(({ label, items: groupItems }) => (
          <div key={label} className="gd-recency-group">
            <div className="gd-section-label">{label}</div>
            <div className={viewMode === "grid" ? "gd-grid" : "gd-list"}>
              {groupItems.map((item) => (
                <ItemComponent
                  key={item._id ?? item.id}
                  item={item}
                  dirId={dirId}
                  avatar={item.userId?.avatar}
                  owner={item.userId?.name || item.owners?.[0].displayName}
                  email={item.userId?.email || item.owners?.[0]?.emailAddress}
                  selected={selectedItems.has(item.id ?? item._id)}
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
        ))
      )}
    </div>
  );
}
