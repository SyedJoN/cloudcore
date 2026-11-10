
import { useEffect, useState } from "react";
import { IconFolder, IconDots } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import FilePreview from "../File/FilePreview";
import { getFileType } from "../../../Utils/displayUtils";
import { getColor } from "../../../Utils/getProfileColor";
import { formatDate } from "../../../Utils/formatDate";
import { useLocation } from "react-router-dom";
import { useAuth, useGDrive } from "../../Contexts";
import { useDriveDrag } from "../../Hooks/useDriveDrag";

const DRAG_MIME = "application/x-drive-items";

export default function GridItem({
  combinedItems,
  item,
  avatar,
  owner,
  selected,
  selectedItems,
  onSelect,
  onRowClick,
  onDoubleClick,
  onContextMenu,
  onMove,
}) {
  const { user } = useAuth();
  const [hasImgError, setHasImgError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);

  const { isGoogleDrive } = useGDrive();
  const location = useLocation();

  const isDriveRoute = location.pathname.endsWith("/drive");
  const isRecentRoute = location.pathname.endsWith("/recent");
  const isSharedRoute = location.pathname.endsWith("/shared");
  const isTrashRoute = location.pathname.endsWith("/trash");
  const isGoogleDriveRoute = location.pathname.endsWith("/google-drive");

  const showActiviyBar =
    isDriveRoute || isRecentRoute || isSharedRoute || isTrashRoute;

  const type = item.isDirectory
    ? isGoogleDrive && isGoogleDriveRoute
      ? "google-directory"
      : "directory"
    : isGoogleDrive && isGoogleDriveRoute
      ? "google-file"
      : "file";

  const itemId = item._id ?? item.id;
  const iconType = item.isDirectory ? null : getFileType(item?.name || "");

  useEffect(() => {
    const check = () => {
      setIsDragging(
        document.body.classList.contains("gd-drag-active")
      );
    };

    const observer = new MutationObserver(check);

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const { dragProps } = useDriveDrag({
    item,
    itemId,
    selectedItems,
    onSelect,
    enabled: !isTrashRoute && !isGoogleDriveRoute,
  });

  const isDraggedItem = [...(selectedItems || [])].some(
    id => String(id) === String(itemId)
  );

  const isDisabled = isDragging && isDraggedItem;

  const handleDragOver = (e) => {
    if (!item.isDirectory) return;

    e.preventDefault();
    e.stopPropagation();

    e.dataTransfer.dropEffect = "move";
    setIsDropTarget(true);
  };

  const handleDragLeave = (e) => {
    if (!item.isDirectory) return;

    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDropTarget(false);
    }
  };

const handleDrop = (e) => {
  if (!item.isDirectory) return;

  e.preventDefault();
  e.stopPropagation();
  setIsDropTarget(false);

  try {
    const ids = JSON.parse(
      e.dataTransfer.getData(DRAG_MIME) || "[]"
    );

    if (!ids.length) return;

    onMove?.(
      ids,
      item._id ?? item.id,
      item.name
    );
  } catch (error) {
    console.error("Drop error:", error);
  }
};

  const avatarEl =
    avatar && !hasImgError ? (
      <img
        src={avatar}
        alt={owner ?? user.name}
        onError={() => setHasImgError(true)}
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
        }}
      />
    ) : (
      <span
        className="gd-avatar"
        style={{
          width: 24,
          height: 24,
          background: getColor(user.name),
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {user.name?.charAt(0)?.toUpperCase()}
      </span>
    );

  const modified = item.modifiedTime
    ? new Date(item.modifiedTime).getTime()
    : 0;

  const viewed = item.viewedByMeTime
    ? new Date(item.viewedByMeTime).getTime()
    : 0;

  const isOpened = viewed > modified;

  return (
    <div
      {...dragProps}
      className={`
        gd-grid-item
        ${selected ? "selected" : ""}
        ${showActiviyBar ? "h-[260.5px]" : ""}
        ${isDisabled ? "gd-drag-disabled" : ""}
        ${isDragging && isDraggedItem ? "gd-drag-source" : ""}
        ${isDropTarget ? "gd-drop-target" : ""}
      `}
      data-id={itemId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        if (document.body.classList.contains("gd-drag-active")) return;
        onRowClick?.(itemId);
      }}
      onDoubleClick={() => {
        if (document.body.classList.contains("gd-drag-active")) return;
        onDoubleClick?.(type, itemId, item.name);
      }}
      onContextMenu={(e) => {
        if (document.body.classList.contains("gd-drag-active")) {
          e.preventDefault();
          return;
        }

        e.preventDefault();

        if (!selectedItems.has(itemId)) {
          onSelect?.(itemId);
        }

        onContextMenu?.(e, itemId);
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0px 8px 0px 12px",
          flex: "0 0 3rem",
          gap: 8,
        }}
      >
        {item.isDirectory ? (
          <IconFolder size={24} style={{ color: "#5f6368", flexShrink: 0 }} />
        ) : (
          <FileBadge type={iconType} />
        )}

        <span className="gd-grid-item-name">{item.name}</span>

        <button
          type="button"
          aria-label="More actions"
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation();

            if (document.body.classList.contains("gd-drag-active")) return;

            onSelect?.(itemId);
            onContextMenu?.(e, itemId);
          }}
          className="gd-icon-btn w-8! h-8! -mr-1.5"
        >
          <IconDots className="h-6 w-6" />
        </button>
      </div>

      <div
        className={`gd-grid-item-preview ${
          showActiviyBar ? "h-50.25" : "h-41.75"
        }`}
      >
        {item.isDirectory ? (
          <IconFolder size={48} />
        ) : (
          <FilePreview item={item} />
        )}
      </div>

      <div
        style={{
          display: showActiviyBar ? "none" : "flex",
          alignItems: "center",
          padding: "0px 8px 0px 12px",
          gap: 8,
        }}
      >
        {avatarEl}

        <span className="gd-grid-item-last-action">
          <span>You {isOpened ? "opened" : "modified"}</span>
          <span>•</span>
          <span>
            {formatDate(isOpened ? item.viewedByMeTime : item.modifiedTime)}
          </span>
        </span>
      </div>
    </div>
  );
}
