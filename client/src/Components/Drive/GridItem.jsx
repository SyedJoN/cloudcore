import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/solid";
import { IconFolder, IconDots } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import FilePreview from "../File/FilePreview";
import { getFileType } from "../../../Utils/displayUtils";
import { getColor } from "../../../Utils/getProfileColor";
import { formatDate } from "../../../Utils/formatDate";
import { useLocation } from "react-router-dom";
import { useAuth, useGDrive } from "../../Contexts";
import { MdOutlineSelectAll, MdClose } from "react-icons/md";
import { useDevice } from "../../Contexts/DeviceContext";

export default function GridItem({
  item,
  dirId,
  avatar,
  owner,
  selected,
  setSelectedItems,
  combinedItems,
  selectedItemsSize,
  showInputCircle,
  setShowInputCircle,
  handleSelectAll,
  onSelect,
  onRowClick,
  onDoubleClick,
  onContextMenu,
}) {
  const { user } = useAuth();
  const { device } = useDevice();
  const [hasImgError, setHasImgError] = useState(false);
  const { isGoogleDrive } = useGDrive();
  const lastTap = useRef(0);

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

  const iconType = item.isDirectory ? null : getFileType(item?.name || "");
  const itemId = (item._id ?? item.id) || item?.map((i)=> i._id ?? i.id) 

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

  // for mobile double click
  const handleTouchEnd = () => {
    const now = Date.now();

    if (now - lastTap.current < 300) {
      onDoubleClick?.(type, itemId, item.name);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  // add / remove, baqi selection ko nahi chherta
  const handleToggle = useCallback(
    (id) => {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedItems],
  );
   useEffect(() => {
    if (selectedItemsSize === 0) {
      setShowInputCircle(false);
    }
  }, [selectedItemsSize]);
  return (
    <>
      {showInputCircle && (
        <div className="gd-mobile-selected-header w-full h-16 flex items-center fixed top-0 left-0 bg-(--surface-container) z-400">
          <button
            onClick={() => {setSelectedItems(new Set()); setShowInputCircle(false)}}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
          >
            {selectedItemsSize >= combinedItems.length ? (
              <MdClose className="h-6 w-6" />
            ) : (
              <ChevronLeftIcon className="h-6 w-6" />
            )}
          </button>
          <div className="flex items-center justify-between flex-1">
            <p>{selectedItemsSize} Selected</p>
            <div className="flex">
              <button
                onClick={() => handleSelectAll?.()}
                aria-label="Back"
                className="flex h-11 w-11 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
              >
                <MdOutlineSelectAll className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => onContextMenu?.(e, itemId)}
                aria-label="Back"
                className="flex h-11 w-11 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
              >
                <EllipsisVerticalIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className={`gd-grid-item ${selected ? "selected" : ""} ${showActiviyBar ? "h-[260.5px]" : ""}`}
        data-id={itemId}
        onClick={() => {
          if (showInputCircle) {
            handleToggle(itemId); // selection mode: parent call nahi hoga
            return;
          }
          onRowClick?.(itemId);
        }}
        onDoubleClick={() => onDoubleClick?.(type, itemId, item.name)}
        onTouchEnd={() => {
          if (showInputCircle) return;
          handleTouchEnd();
        }}
        onContextMenu={(e) => {
          if (device === "mobile") {
            if (showInputCircle) return;
            e.preventDefault();
            e.stopPropagation();
            setSelectedItems(new Set([itemId]));
            setShowInputCircle(true);
            return;
          }

          onSelect?.(itemId);
          onContextMenu(e, itemId);
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

          {/* kebab / checkbox */}
          <button
            type="button"
            aria-label={showInputCircle ? "Select item" : "More actions"}
            onClick={(e) => {
              e.stopPropagation();
              if (showInputCircle) {
                handleToggle(itemId);
                return;
              }
              e.preventDefault();
              onSelect?.(itemId);
              onContextMenu?.(e, itemId);
            }}
            className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
          >
            {showInputCircle ? (
              <div
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center
    ${
      selected
        ? "border-blue-600 bg-blue-600"
        : "border-gray-400 bg-transparent"
    }`}
              >
                {selected && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white">
                    <path
                      d="m5 12 4 4L19 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            ) : (
              <IconDots className="h-6 w-6" />
            )}
          </button>
        </div>

        <div
          className={`gd-grid-item-preview ${showActiviyBar ? "h-50.25" : "h-41.75"}`}
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
    </>
  );
}
