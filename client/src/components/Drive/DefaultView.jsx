import React, { useEffect, useMemo, useState } from "react";
import {
  applyRecentFilters,
  DEFAULT_RECENT_FILTERS,
} from "./Recent/ApplyRecentFilters";
import { groupItemsByType } from "./Recent/RecencyBuckets";
import { GoogleDriveCard, GridItem, ListRow } from ".";
import RecentFilters from "./Recent/RecentFilters";
import { useNavigate } from "react-router-dom";

const DefaultView = ({
  items,
  combinedItems,
  viewMode,
  isGoogleDrive,
  isHomeRoute,
  dirId,
  user,
  selectedItems,
  onSelect,
  onRowClick,
  onDoubleClick,
  onDownload,
  onRename,
  onShare,
  onContextMenu,
  listHeaderRow,
  isStarred,
  setIsStarred,
  route,
  onStar
}) => {
  const [filters, setFilters] = useState(DEFAULT_RECENT_FILTERS);
  const navigate = useNavigate();

  const filteredItems = useMemo(
    () => applyRecentFilters(items, filters, user),
    [items, filters, user],
  );

  const groups = useMemo(
    () => groupItemsByType(filteredItems),
    [filteredItems],
  );

  const ItemComponent = viewMode === "grid" ? GridItem : ListRow;

  return (
    <>
      <div className="gd-drive">
        <RecentFilters
          items={items}
          filters={filters}
          onChange={setFilters}
          user={user}
        />
        {isGoogleDrive && !dirId && isHomeRoute && viewMode === "grid" && (
          <GoogleDriveCard onOpen={() => navigate("/google-drive")} />
        )}
        {viewMode === "list" && listHeaderRow}
        {groups.length === 0 ? (
          <div className="gd-empty">
            <h3>No matching files</h3>

            <p>Try adjusting or clearing your filters.</p>
          </div>
        ) : (
          groups.map(({ label, items: groupItems }) => (
            <div key={label} className="gd-drive-group">
              <div className="gd-section-label">{label}</div>

              <div className={viewMode === "grid" ? "gd-grid" : "gd-list"}>
                {groupItems.map((item) => (
                  <ItemComponent
                    key={item._id ?? item.id}
                    item={item}
                    dirId={dirId}
                    avatar={item.userId?.avatar}
                    owner={item.userId?.name || item.owners?.[0].displayName}
                    selected={selectedItems.has(item.id ?? item._id)}
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
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default DefaultView;
