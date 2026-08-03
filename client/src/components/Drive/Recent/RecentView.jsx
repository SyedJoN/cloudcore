import { useState, useMemo, useEffect } from "react"; // adjust to your actual barrel export path
import RecentFilters from "./RecentFilters";
import { groupItemsByRecency } from "./RecencyBuckets";
import { applyRecentFilters, DEFAULT_RECENT_FILTERS } from "./ApplyRecentFilters";
import { GridItem, ListRow } from "..";
import { useAuth } from "../../../Contexts";


export default function RecentView({
  items,
  viewMode,
  isRecentRoute,
  dirId,
  selectedItems,
  onSelect,
  onRowClick,
  onDoubleClick,
  onContextMenu,
  listHeaderRow,
}) {
  const { user } = useAuth();
  const [filters, setFilters] = useState(DEFAULT_RECENT_FILTERS);

  const filteredItems = useMemo(
    () => applyRecentFilters(items, filters, user),
    [items, filters, user],
  );

  const groups = useMemo(() => groupItemsByRecency(filteredItems), [filteredItems]);

  const ItemComponent = viewMode === "grid" ? GridItem : ListRow;

  return (
    <div className="gd-recent">
      <RecentFilters items={items} filters={filters} onChange={setFilters} user={user} isRecentRoute={isRecentRoute} />
      {viewMode === "list" && listHeaderRow}

      {groups.length === 0 ? (
        <div className="gd-empty">
          <h3>No matching files</h3>
          <p>Try adjusting or clearing your filters.</p>
        </div>
      ) : (
        groups.map(({ label, items: groupItems }) => (
          <div key={label} className="gd-recency-group">
            <div className="gd-section-label">{label}</div>
            <div className={viewMode === "grid" ? "gd-grid" : "gd-list"}>
              {groupItems.map((item) => (
                <ItemComponent
                  key={item._id ?? item.id}
                  item={item}
                  dirId={dirId}
                  avatar={item.userId?.avatar}
                  owner={item.userId?.name}
                  selected={selectedItems.has(item.id ?? item._id)}
                  onSelect={onSelect}
                  selectionActive={selectedItems.size > 0}
                  onRowClick={onRowClick}
                  onDoubleClick={onDoubleClick}
                  onContextMenu={onContextMenu}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}