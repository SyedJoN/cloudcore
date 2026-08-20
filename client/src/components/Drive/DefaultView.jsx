import React, { useEffect, useMemo, useState } from "react";
import {
  applyRecentFilters,
  DEFAULT_RECENT_FILTERS,
} from "./Recent/ApplyRecentFilters";
import { GoogleDriveCard, GridItem, ListRow } from ".";
import RecentFilters from "./Recent/RecentFilters";
import { useNavigate } from "react-router-dom";
import SortButton from "../ListRow/SortButton";

const DefaultView = ({
  items,
  sortConfig,
  setSortConfig,
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
  onStar,
}) => {
  const [filters, setFilters] = useState(DEFAULT_RECENT_FILTERS);
  const navigate = useNavigate();

  const filteredItems = useMemo(
    () => applyRecentFilters(items, filters, user),
    [items, filters, user],
  );

  const sortedItems = useMemo(() => {
    const data = [...filteredItems];

    data.sort((a, b) => {
      // --------------------------------
      // FOLDERS ON TOP
      // --------------------------------
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

      // --------------------------------
      // SORT BY SELECTED COLUMN
      // --------------------------------
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "name":
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
          break;

        case "modifiedTime":
          aValue = new Date(a.modifiedTime || a.updatedAt || 0).getTime();

          bValue = new Date(b.modifiedTime || b.updatedAt || 0).getTime();
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

  const ItemComponent = viewMode === "grid" ? GridItem : ListRow;

  const FoldersOnTop = viewMode === "grid" && sortConfig.folders === "top";

  const containsDirectory = sortedItems.some((item) => item.isDirectory);

  return (
    <div className="gd-drive">
      <RecentFilters
        items={items}
        filters={filters}
        onChange={setFilters}
        user={user}
      />
      {viewMode === "grid" && (
        <div className="pb-2">
          <SortButton
            viewMode={viewMode}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
          />
        </div>
      )}

      {viewMode === "list" && listHeaderRow}

      {sortedItems.length === 0 ? (
        <div className="gd-empty">
          <h3>No matching files</h3>
          <p>Try adjusting or clearing your filters.</p>
        </div>
      ) : (
        <>
          {FoldersOnTop && containsDirectory && (
            <div className="gd-grid gd-grid-on-top">
              {sortedItems
                .filter((s) => s.isDirectory)
                .map((item) => (
                  <ItemComponent
                    key={item._id ?? item.id}
                    item={item}
                    dirId={dirId}
                    avatar={item.userId?.avatar || item.owners?.[0]?.photoLink}
                    owner={item.userId?.name || item.owners?.[0]?.displayName}
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
          )}
          <div className={viewMode === "grid" ? "gd-grid" : "gd-list"}>
            {sortedItems
              .filter((s) => (FoldersOnTop ? !s.isDirectory : s))
              .map((item) => (
                <ItemComponent
                  key={item._id ?? item.id}
                  item={item}
                  dirId={dirId}
                  avatar={item.userId?.avatar || item.owners?.[0]?.photoLink}
                  owner={item.userId?.name || item.owners?.[0]?.displayName}
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
        </>
      )}
    </div>
  );
};

export default DefaultView;
