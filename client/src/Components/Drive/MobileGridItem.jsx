import { useCallback, useEffect, useRef, useState } from "react";
import { IconFolder, IconDots } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import FilePreview from "../File/FilePreview";
import { getColor } from "../../../Utils/getProfileColor";
import { useLocation } from "react-router-dom";
import { useAuth, useGDrive } from "../../Contexts";
import "./MobileGridItem.css";
import { getFileKind } from "../../../Utils/fileKind";
import { useDevice } from "../../Contexts/DeviceContext";
import { formatDate } from "../../../Utils/formatDate";

export default function MobileGridItem({
  item,
  avatar,
  owner,
  selected,
  isHomeRoute,
  setSelectedItems = () => {},
  selectionMode = false,
  setSelectionMode = () => {},
  onSelect,
  onDoubleClick,
  onContextMenu,
  // NEW
  pickerMode = false,
  disabled = false,
  onOpen,
}) {
  const { user } = useAuth();
  const { isGoogleDrive } = useGDrive();
  const location = useLocation();
  const [hasImgError, setHasImgError] = useState(false);
  const { device } = useDevice();
  const isDesktop = device === "windows";
  const isMobile = device === "mobile";
  const lastTap = useRef(0);

  const isDriveRoute = location.pathname.endsWith("/drive");
  const isRecentRoute = location.pathname.endsWith("/recent");
  const isSharedRoute = location.pathname.endsWith("/shared");
  const isTrashRoute = location.pathname.endsWith("/trash");

  const showActiviyBar =
    isDriveRoute || isRecentRoute || isSharedRoute || isTrashRoute;

  // press state (scale + state layer)
  const [pressed, setPressed] = useState(false);
  const pressTimer = useRef(null);

  const path = location.pathname;
  const isGoogleDriveRoute = path.endsWith("/google-drive");

  const type = item.isDirectory
    ? isGoogleDrive && isGoogleDriveRoute
      ? "google-directory"
      : "directory"
    : isGoogleDrive && isGoogleDriveRoute
      ? "google-file"
      : "file";

  const iconType = item.isDirectory ? null : getFileKind(item);
  const itemId = item._id ?? item.id;

  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const handlePressStart = (e) => {
    if (disabled) return; // no press effect on greyed-out cards
    if (e.target.closest(".mgi-trailing")) return;
    clearTimeout(pressTimer.current);
    setPressed(true);
  };
  const handlePressEnd = () => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setPressed(false), 120);
  };

  const handleToggle = useCallback(
    (id) => {
      console.log("kebab");

      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedItems],
  );

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
        style={{
          width: isMobile ? "26px" : "100%",
          height: isMobile ? "26px" : "100%",
        }}
        className="mgi-avatar"
        src={avatar}
        alt={owner ?? user?.name}
        onError={() => setHasImgError(true)}
      />
    ) : (
      <span
        className="mgi-avatar mgi-avatar-letter"
        style={{
          width: isMobile ? "26px" : "100%",
          height: isMobile ? "26px" : "100%",
          background: getColor(user?.name),
        }}
      >
        {user?.name?.charAt(0)?.toUpperCase()}
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
      className={`mgi-card${pressed ? " is-pressed" : ""}${selected ? " selected" : ""}${disabled ? " mgi-disabled" : ""}${isMobile && isHomeRoute ? " mobile-home" : ""}`}
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
      <div
        style={{
          display: showActiviyBar ? "none" : "flex",
          alignItems: "center",
          marginBottom: 6,
          padding:
            isMobile && isHomeRoute ? "8px 0 12px 28px" : "0px 8px 0px 12px",
          height: 40,
          gap: 16,
          mb: 2,
        }}
      >
        {avatarEl}

        <span className="gd-grid-item-last-action gap-0! pt-0! pb-0! flex flex-col items-start!">
          <span className="text-sm">
            You {isOpened ? "opened" : "modified"}
          </span>
          <span className="text-xs text-(--text-tertiary)">
            {formatDate(isOpened ? item.viewedByMeTime : item.modifiedTime)}
          </span>
        </span>
      </div>
    </div>
  );
}
