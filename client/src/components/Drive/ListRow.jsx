import { IconFolder } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import { getFileType } from "../../../Utils/displayUtils";
import { formatDate } from "../../../Utils/formatDate";
import { formatSize } from "../../../Utils/formatHelpers";
import { useGDrive } from "../../Contexts";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import HomeRoute from "../ListRow/HomeRoute";
import SharedRoute from "../ListRow/SharedRoute";
import RecentRoute from "../ListRow/RecentRoute";
import { FolderIcon, InboxIcon, UsersIcon } from "@heroicons/react/24/solid";
import TrashRoute from "../ListRow/TrashRoute";

export default function ListRow({
  item,
  onStar,
  isStarred,
  setIsStarred,
  route,
  owner,
  dirId,
  onRowClick,
  onDoubleClick,
  onDownload,
  handleSelect,
  onRename,
  onShare,
  selected,
  onSelect,
  onContextMenu,
}) {
  const { isGoogleDrive } = useGDrive();

  const navigate = useNavigate();
  const location = useLocation();

  const isGoogleDriveRoute = route === "google-drive";

  const isDriveRoute = route === undefined;

  const isHomeRoute = route === "home";

  const isSharedRoute = route === "shared";

  const isRecentRoute = route === "recent";

  const isTrashRoute = route === "trash";

  const [isListHovered, setIsListHovered] = useState(false);

  const path = item.path || [];

  const lastPathItem = path[path.length - 1];

  const pathId = item.isShared
    ? "/shared"
    : lastPathItem?.name?.startsWith("root")
      ? "/"
      : `/directory/${lastPathItem?._id}`;

  const pathName = item.isShared
    ? "Shared with me"
    : lastPathItem?.name?.startsWith("root")
      ? "My Drive"
      : lastPathItem?.name;

  const locationIcon =
    pathName === "Shared with me" ? (
      <UsersIcon className="w-5 h-5" />
    ) : pathName === "My Drive" ? (
      <InboxIcon className="w-5 h-5" />
    ) : (
      <FolderIcon className="w-5 h-5" />
    );

  const locationDetails = {
    pathId,
    name: pathName,
  };

  const type = item.isDirectory
    ? isGoogleDrive && isGoogleDriveRoute
      ? "google-directory"
      : "directory"
    : isGoogleDrive && isGoogleDriveRoute
      ? "google-file"
      : "file";

  const iconType = item.isDirectory ? null : getFileType(item?.name || "");

  const itemId = item.id ?? item._id;

  const lastModified = formatDate(item.modifiedTime || item.updatedAt);
  const sharedWithMeTime = formatDate(item.sharedWithMeTime);
  const trashedTime = formatDate(item.trashedTime);

  const size = formatSize(item.size);

  const capabilities = item.capabilities || {};

  const canRead = capabilities.canRead === true;
  const canShare = true;
  const canDownload = capabilities.canDownload === true;
  const canCopy = capabilities.canCopy === true;
  const canRename = capabilities.canRename === true;
  const canMove = capabilities.canMove === true;
  const canDelete = capabilities.canDelete === true;
  const canTrash = capabilities.canTrash === true;
  const canChangeRole = capabilities.canChangeRole === true;

  const isDeleted = item?.isDeleted;

  const commonRouteProps = {
    item,
    itemId,

    isStarred,
    setIsStarred,

    isListHovered,
    isDeleted,

    isGoogleDriveRoute,

    canRead,
    canShare,
    canDownload,
    canCopy,
    canRename,
    canMove,
    canDelete,
    canTrash,
    canChangeRole,

    onStar,
    onDownload,
    onRename,
    onShare,
    onSelect,
    onContextMenu,

    selected,
  };

  return (
    <div
      className={`gd-list-row ${selected ? "selected" : ""}`}
      data-id={itemId}
      onClick={() => onRowClick(itemId)}
      onMouseEnter={() => setIsListHovered(true)}
      onMouseLeave={() => setIsListHovered(false)}
      onDoubleClick={() => onDoubleClick?.(type, itemId, item.isDeleted)}
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect?.(itemId);
        onContextMenu?.(e, itemId);
      }}
    >
      <div className="gd-list-row-name">
        {item.isDirectory ? (
          <IconFolder
            size={20}
            style={{
              color: "#5f6368",
              flexShrink: 0,
            }}
          />
        ) : (
          <FileBadge type={iconType} />
        )}

        <span>{item.name}</span>
      </div>

      {isHomeRoute || isGoogleDriveRoute || isDriveRoute ? (
        <HomeRoute
          {...commonRouteProps}
          owner={owner}
          lastModified={lastModified}
          size={size}
        />
      ) : isSharedRoute ? (
        <SharedRoute
          {...commonRouteProps}
          owner={owner}
          sharedWithMeTime={sharedWithMeTime}
        />
      ) : isTrashRoute ? (
        <TrashRoute 
         {...commonRouteProps}
          locationIcon={locationIcon}
          owner={owner}
          trashedTime={trashedTime}
          size={size}
          locationDetails={locationDetails}
          navigate={navigate}
        />
      ) : (
        <RecentRoute
          {...commonRouteProps}
          locationIcon={locationIcon}
          owner={owner}
          lastModified={lastModified}
          size={size}
          locationDetails={locationDetails}
          navigate={navigate}
        />
      )}
    </div>
  );
}
