import { IconFolder } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import { getFileType } from "../../../Utils/displayUtils";
import { formatDate } from "../../../Utils/formatDate";
import { formatSize } from "../../../Utils/formatHelpers";
import { useAuth, useGDrive } from "../../Contexts";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import HomeRoute from "../ListRow/HomeRoute";
import SharedRoute from "../ListRow/SharedRoute";
import RecentRoute from "../ListRow/RecentRoute";
import { FolderIcon, InboxIcon, UsersIcon } from "@heroicons/react/24/solid";
import TrashRoute from "../ListRow/TrashRoute";
import StarredRoute from "../ListRow/StarredRoute";

const currentYear = new Date().getFullYear();

const formatDateToUS = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== currentYear && {
      year: "numeric",
    }),
  });
};
export default function ListRow({
  item,
  sortConfig,
  setSortConfig,
  onStar,
  isStarred,
  setIsStarred,
  route,
  owner,
  email,
  avatar,
  onRowClick,
  onDoubleClick,
  onDownload,
  onRename,
  onShare,
  selected,
  onSelect,
  onContextMenu,
}) {
  const { isGoogleDrive } = useGDrive();
  const { user } = useAuth();

  const ownerName =
    email === (user.email || user.owners?.[0].emailAddress) ? "Me" : owner;

  const navigate = useNavigate();

  const isGoogleDriveRoute = route === "google-drive";

  const isDriveRoute = route === undefined;

  const isHomeRoute = route === "home";

  const isSharedRoute = route === "shared";

  const isTrashRoute = route === "trash";

  const isRecentRoute = route === "recent";

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

  const date = new Date(item.modifiedTime || item.updatedAt);

  const lastModifiedAt = formatDateToUS(date);

  const modifiedBy =
    (item?.lastModifyingUser?.name || item?.lastModifyingUser?.displayName) ===
    user.name
      ? "me"
      : item?.lastModifyingUser?.name || item?.lastModifyingUser?.displayName;

  const sharedWithMeTime =
    isSharedRoute && formatDateToUS(item.sharedWithMeTime);
  const trashedTime = isTrashRoute && formatDateToUS(item.trashedTime);

  const viewedTime = item.viewedByMeTime
    ? new Date(item.viewedByMeTime).getTime()
    : 0;

  const modifiedTime = item.modifiedByMeTime
    ? new Date(item.modifiedByMeTime).getTime()
    : 0;

  const myActivityDate = Math.max(viewedTime, modifiedTime);

  const myActivityTime = myActivityDate ? formatDateToUS(myActivityDate) : null;

  const myActivityType =
    viewedTime > modifiedTime ? "Opened" : modifiedTime > 0 ? "Modified" : null;

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

    route,
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
    sortConfig,
    setSortConfig,
  };

  return (
    <div
      className={`gd-list-row ${selected ? "selected" : ""} ${route === "home" || route === "google-drive" || route === undefined ? "five-columns" : route === "shared" ? "four-columns" : "six-columns"}`}
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
        <div className="flex justify-center grow-0 shrink-0 basis-14">
          {item.isDirectory ? (
            <IconFolder size={24} />
          ) : (
            <FileBadge size={24} type={iconType} />
          )}
        </div>
        <span>{item.name}</span>
      </div>

      {isHomeRoute || isGoogleDriveRoute || isDriveRoute ? (
        <HomeRoute
          {...commonRouteProps}
          owner={ownerName}
          avatar={avatar}
          modifiedBy={modifiedBy}
          lastModifiedAt={lastModifiedAt}
          size={size}
        />
      ) : isSharedRoute ? (
        <SharedRoute
          {...commonRouteProps}
          owner={ownerName}
          avatar={avatar}
          sharedWithMeTime={sharedWithMeTime}
        />
      ) : isTrashRoute ? (
        <TrashRoute
          {...commonRouteProps}
          locationIcon={locationIcon}
          owner={ownerName}
          avatar={avatar}
          trashedTime={trashedTime}
          size={size}
          locationDetails={locationDetails}
          navigate={navigate}
        />
      ) : isRecentRoute ? (
        <RecentRoute
          {...commonRouteProps}
          locationIcon={locationIcon}
          myActivityType={myActivityType}
          myActivityTime={myActivityTime}
          owner={ownerName}
          avatar={avatar}
          size={size}
          locationDetails={locationDetails}
          navigate={navigate}
        />
      ) : (
        <StarredRoute
          {...commonRouteProps}
          locationIcon={locationIcon}
          owner={ownerName}
          avatar={avatar}
          modifiedBy={modifiedBy}
          lastModifiedAt={lastModifiedAt}
          size={size}
          locationDetails={locationDetails}
          navigate={navigate}
        />
      )}
    </div>
  );
}
