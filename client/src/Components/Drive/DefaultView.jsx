import React, { useEffect, useMemo, useState } from "react";
import {
  applyRecentFilters,
  DEFAULT_RECENT_FILTERS,
} from "./Recent/ApplyRecentFilters";
import { GoogleDriveCard, GridItem, ListRow } from ".";
import RecentFilters from "./Recent/RecentFilters";
import { useNavigate } from "react-router-dom";
import SortButton from "../ListRow/SortButton";
import { useAuth } from "../../Contexts";
import { useDevice } from "../../Contexts/DeviceContext";
import MobileListRow from "./MobileListRow";
import MobileGridItem from "./MobileGridItem";
import SortButtonMobile from "../ListRow/SortButtonMobile";

const DefaultView = ({
  items,
  sortConfig,
  setSortConfig,
  combinedItems,
  viewMode,
  isGoogleDrive,
  isHomeRoute,
  dirId,
  selectedItems,
  setSelectedItems,
  handleSelectAll,
  onSelect,
  onToggleView,
  onRowClick,
  onDoubleClick,
  showInputCircle,
  setShowInputCircle,
  onDownload,
  onRename,
  onShare,
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

  const ItemComponent =
    device === "windows"
      ? viewMode === "grid"
        ? GridItem
        : ListRow
      : viewMode === "grid"
        ? MobileGridItem
        : MobileListRow;

  const FoldersOnTop =
    device === "windows" && viewMode === "grid" && sortConfig.folders === "top";

  const containsDirectory = sortedItems.some((item) => item.isDirectory);

  const isGoogleDriveRoute = route === "google-drive";

  return (
    <div className="gd-drive">
      {device === "windows" && (
        <RecentFilters
          items={items}
          filters={filters}
          onChange={setFilters}
          user={user}
        />
      )}
      {device === "windows"
        ? viewMode === "grid"
        : true && (
            <div className="sort-btn pb-2 -mx-1.5 py-2">
              {device === "mobile" ? (
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

      {device === "windows" ? viewMode === "list" && listHeaderRow : null}

      {sortedItems.length === 0 ? (
        <div className="gd-empty">
          <h3>No matching files</h3>
          <p>Try adjusting or clearing your filters.</p>
        </div>
      ) : (
        <>
          {FoldersOnTop && containsDirectory && (
            <div
              className={`gd-grid ${device === "mobile" ? "" : "gd-grid-on-top"}`}
            >
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
                    handleSelectAll={handleSelectAll}
                    showInputCircle={showInputCircle}
                    setShowInputCircle={setShowInputCircle}
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
    ? device === "mobile"
      ? "mgi-grid"
      : "gd-grid"
    : device === "mobile"
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
                  selectedItemsSize={selectedItems.size}
                  handleSelectAll={handleSelectAll}
                  showInputCircle={showInputCircle}
                  setShowInputCircle={setShowInputCircle}
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
