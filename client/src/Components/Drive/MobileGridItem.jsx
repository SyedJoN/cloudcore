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
import "./MobileGridItem.css";

export default function MobileGridItem({
  item,
  avatar,
  owner,
  selected,
  setSelectedItems,
  selectionMode,
  setSelectionMode,
  onSelect,
  onRowClick,
  onDoubleClick,
  onContextMenu,
}) {
  const { user } = useAuth();
  const { isGoogleDrive } = useGDrive();
  const [hasImgError, setHasImgError] = useState(false);
  const lastTap = useRef(0);

  const location = useLocation();
  const path = location.pathname;
  const isGoogleDriveRoute = path.endsWith("/google-drive");

  const type = item.isDirectory
    ? isGoogleDrive && isGoogleDriveRoute
      ? "google-directory"
      : "directory"
    : isGoogleDrive && isGoogleDriveRoute
      ? "google-file"
      : "file";

  const iconType = item.isDirectory ? null : getFileType(item?.name || "");
  const itemId = item._id ?? item.id;

  const modified = item.modifiedTime ? new Date(item.modifiedTime).getTime() : 0;
  const viewed = item.viewedByMeTime ? new Date(item.viewedByMeTime).getTime() : 0;

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

   const handleTouchEnd = () => {
    if (selectionMode) return;
    const now = Date.now();

    if (now - lastTap.current < 300) {
      onDoubleClick?.(type, itemId, item.name);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };


  const handleClick = () => {
    if (selectionMode) {
      handleToggle(itemId);
      return;
    }
    onRowClick?.(itemId);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectionMode) return;
    setSelectedItems(new Set([itemId]));
    setSelectionMode(true);
  };

  const handleKebab = (e) => {
    e.stopPropagation();
    if (selectionMode) {
      handleToggle(itemId);
      return;
    }
    e.preventDefault();
    onSelect?.(itemId);
    onContextMenu?.(e, itemId);
  };

  const avatarEl =
    avatar && !hasImgError ? (
      <img
        className="mgi-avatar"
        src={avatar}
        alt={owner ?? user?.name}
        onError={() => setHasImgError(true)}
      />
    ) : (
      <span
        className="mgi-avatar mgi-avatar-letter"
        style={{ background: getColor(user?.name) }}
      >
        {user?.name?.charAt(0)?.toUpperCase()}
      </span>
    );

  return (
    <>
      {/* {selectionMode && (
        <div className="mgi-selection-bar">
          <button
            type="button"
            className="mgi-bar-btn"
            aria-label="Exit selection"
            onClick={() => {
              setSelectedItems(new Set());
              setSelectionMode(false);
            }}
          >
            {selectedItemsSize >= combinedItems.length ? (
              <MdClose className="h-6 w-6" />
            ) : (
              <ChevronLeftIcon className="h-6 w-6" />
            )}
          </button>
          <p className="mgi-bar-count">{selectedItemsSize} selected</p>
          <button
            type="button"
            className="mgi-bar-btn"
            aria-label="Select all"
            onClick={() => handleSelectAll?.()}
          >
            <MdOutlineSelectAll className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="mgi-bar-btn"
            aria-label="More actions"
            onClick={(e) => onContextMenu?.(e, itemId)}
          >
            <EllipsisVerticalIcon className="h-6 w-6" />
          </button>
        </div>
      )} */}

      <div
        className={`mgi-card ${selected ? "selected" : ""}`}
        data-id={itemId}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
      >
        {/* Header: small icon + name + menu */}
        <div className="mgi-head">
          <span className="mgi-head-icon">
            {item.isDirectory ? (
              <IconFolder size={20} style={{ color: "#c4c7c5" }} />
            ) : (
              <FileBadge type={iconType} />
            )}
          </span>
          <span className="mgi-name">{item.name}</span>
          <button
            type="button"
            className="mgi-trailing"
            aria-label={selectionMode ? "Select item" : "More actions"}
            onClick={handleKebab}
          >
            {selectionMode ? (
              <span className={`mgi-check ${selected ? "on" : ""}`}>
                {selected && (
                  <svg viewBox="0 0 24 24" width="12" height="12">
                    <path
                      d="m5 12 4 4L19 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            ) : (
              <IconDots className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Preview: big folder icon, or the file thumbnail */}
        <div className="mgi-preview">
          {item.isDirectory ? (
            <IconFolder size={100} />
          ) : (
            <FilePreview item={item} />
          )}
        </div>

      </div>
    </>
  );
}