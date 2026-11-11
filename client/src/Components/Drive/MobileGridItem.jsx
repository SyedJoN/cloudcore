import { useCallback, useEffect, useRef, useState } from "react";

import { IconFolder, IconDots } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import FilePreview from "../File/FilePreview";
import { getFileType } from "../../../Utils/displayUtils";
import { getColor } from "../../../Utils/getProfileColor";
import { useLocation } from "react-router-dom";
import { useAuth, useGDrive } from "../../Contexts";
import "./MobileGridItem.css";

export default function MobileGridItem({
  item,
  avatar,
  owner,
  selected,
  setSelectedItems = () => {},
  selectionMode = false,
  setSelectionMode = () => {},
  onSelect,
  onRowClick,
  onDoubleClick,
  onContextMenu,
  // NEW
  pickerMode = false, // used inside the move modal: no menu / selection / long-press
  disabled = false, // greyed-out and static
  onOpen, // called when an enabled card is tapped in picker mode
}) {
  const { user } = useAuth();
  const { isGoogleDrive } = useGDrive();
  const [hasImgError, setHasImgError] = useState(false);
  const lastTap = useRef(0);

  // press state (scale + state layer)
  const [pressed, setPressed] = useState(false);
  const pressTimer = useRef(null);

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

  const modified = item.modifiedTime
    ? new Date(item.modifiedTime).getTime()
    : 0;
  const viewed = item.viewedByMeTime
    ? new Date(item.viewedByMeTime).getTime()
    : 0;

  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const handlePressStart = (e) => {
    if (disabled) return; // no press effect on greyed-out cards
    if (e.target.closest(".mgi-trailing")) return;
    clearTimeout(pressTimer.current);
    setPressed(true);
  };
  const handlePressEnd = () => {
    clearTimeout(pressTimer.current);
    // quick tap me bhi press 120ms tak dikhe
    pressTimer.current = setTimeout(() => setPressed(false), 120);
  };

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
    if (disabled) return;
    if (pickerMode) {
      onOpen?.(item);
      return;
    }
    if (selectionMode) {
      handleToggle(itemId);
      return;
    }
    onDoubleClick?.(type, itemId, item.name);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pickerMode || selectionMode) return;
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
    <div
      className={`mgi-card ${pressed ? "is-pressed" : ""} ${selected ? "selected" : ""} ${disabled ? "mgi-disabled" : ""}`}
      data-id={itemId}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerLeave={handlePressEnd}
      onPointerCancel={handlePressEnd}
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
        {!pickerMode && (
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
        )}
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
  );
}
