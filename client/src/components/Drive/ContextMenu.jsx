import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconShare,
  IconDownload,
  IconRename,
  IconTrash,
  IconChevronRight,
  IconOpenWith,
  IconPreview,
  IconNewTab,
  IconLink,
  IconRestore,
} from "../Icons/Icons";
import { useToast } from "../../Contexts/ToastContext";

function useTransitionClass(open, onExited) {
  const [animate, setAnimate] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
    setAnimate(false);
  }, [open]);

  function onTransitionEnd(e) {
    if (e.target !== nodeRef.current) return;
    if (e.propertyName !== "transform") return;
    if (!open) onExited?.();
  }

  return { animate, nodeRef, onTransitionEnd };
}

function useSelfMountedTransition(open) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const transition = useTransitionClass(open, () => setMounted(false));
  return { mounted, ...transition };
}

function SubMenu({ open, openLeft, onMouseEnter, onMouseLeave, children }) {
  const { mounted, animate, nodeRef, onTransitionEnd } =
    useSelfMountedTransition(open);

  if (!mounted) return null;

  return (
    <div
      ref={nodeRef}
      onTransitionEnd={onTransitionEnd}
      className={`gd-context-menu gd-context-submenu min-w-45 lg:min-w-75 ${
        openLeft ? "right-75" : "left-full"
      } ${animate ? "open" : ""}`}
      style={{ position: "absolute", top: 0, zIndex: 1001 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}
const SUBMENU_OPEN_DELAY = 150;
const SUBMENU_CLOSE_DELAY = 120;

function useHoverIntent(setOpen) {
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return {
    onMouseEnter: () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setOpen(true), SUBMENU_OPEN_DELAY);
    },
    onMouseLeave: () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setOpen(false), SUBMENU_CLOSE_DELAY);
    },
  };
}
function ContextMenuContent({
  open,
  onExited,
  openLeft,
  item,
  position,
  isGoogleDriveRoute,
  isTrashRoute,
  dirId,
  onClose,
  onShare,
  onRename,
  onSoftDelete,
  onDelete,
  onRestore,
  onDownload,
  onPreview,
  isDeleted,
}) {
  const [showOpenWith, setShowOpenWith] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const openWithHover = useHoverIntent(setShowOpenWith);
  const shareHover = useHoverIntent(setShowShare);
  const { animate, nodeRef, onTransitionEnd } = useTransitionClass(
    open,
    onExited,
  );
  const { toast } = useToast();

  const type = item?.webViewLink ? "google" : "local";
  const isOwner = item?.userRole === "owner";
  const isViewer = item?.userRole === "viewer" || item?.publicRole === "viewer";
  const canEdit = isOwner || !isViewer;

  const showDeleteActions = isTrashRoute && isDeleted && !dirId;
  const showFileActions = Boolean(item) && !item?.isDirectory;

  useEffect(() => {
    function handleClick(e) {
      if (
        !e.target.closest(".gd-context-menu") &&
        !e.target.closest(".gd-context-submenu")
      ) {
        onClose();
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [onClose]);

  const close =
    (action) =>
    (...args) => {
      action?.(...args);
      onClose();
    };

  function handleCopyLink() {
    const url =
      item?.webViewLink ??
      (item?.isDirectory
        ? `${window.location.origin}/directory/${item?._id}?usp=drive_link`
        : `${window.location.origin}/file/${item?._id}?usp=drive_link`);

    navigator.clipboard.writeText(url).then(() => {
      toast({ message: "Link copied to clipboard", type: "success" });
      onClose();
    });
  }

  function handleOpenInNewTab() {
    window.open(item?.webViewLink || `/file/${item?._id}`, "_blank");
    onClose();
  }

  return (
    <div
      ref={nodeRef}
      onTransitionEnd={onTransitionEnd}
      className={`gd-context-menu jon ${animate ? "open" : ""}`}
      style={{ left: position.x, top: position.y, zIndex: 1000 }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {showDeleteActions ? (
        <>
          <button
            className="gd-context-item"
            onClick={close(() => onRestore(item))}
          >
            <IconRestore size={18} />
            Restore
          </button>
          <div className="gd-context-divider" />
          <button
            className="gd-context-item danger"
            onClick={close(() => onDelete(item, type))}
          >
            <IconTrash size={18} /> Delete forever
          </button>
        </>
      ) : (
        <div>
          {/* Open with */}
          {showFileActions && !isDeleted && (
            <div style={{ position: "relative" }}>
              <button
                className="gd-context-item"
                onMouseEnter={openWithHover.onMouseEnter}
                onMouseLeave={openWithHover.onMouseLeave}
              >
                <IconOpenWith size={18} />
                <span style={{ flex: 1 }}>Open with</span>
                <IconChevronRight size={16} />
              </button>

              <SubMenu
                open={showOpenWith}
                openLeft={openLeft}
                onMouseEnter={openWithHover.onMouseEnter}
                onMouseLeave={openWithHover.onMouseLeave}
              >
                <button
                  className="gd-context-item"
                  onClick={close(() => onPreview(item))}
                >
                  <IconPreview size={18} /> Preview
                </button>
                <button
                  className="gd-context-item"
                  onClick={handleOpenInNewTab}
                >
                  <IconNewTab size={18} /> Open in new tab
                </button>
              </SubMenu>
            </div>
          )}

          {/* Share / copy link */}
          <div style={{ position: "relative" }}>
            {item && !isDeleted && (
              <>
                <button
                  className="gd-context-item"
                  onMouseEnter={shareHover.onMouseEnter}
                  onMouseLeave={shareHover.onMouseLeave}
                >
                  <IconShare size={18} />
                  <span style={{ flex: 1 }}>Share</span>
                  <IconChevronRight size={16} />
                </button>

                <SubMenu
                  open={showShare}
                  openLeft={openLeft}
                  onMouseEnter={shareHover.onMouseEnter}
                  onMouseLeave={shareHover.onMouseLeave}
                >
                  <button
                    className="gd-context-item"
                    onClick={close(() => onShare(item))}
                  >
                    <IconShare size={18} /> Share
                  </button>

                  <button className="gd-context-item" onClick={handleCopyLink}>
                    <IconLink size={18} />
                    Copy link
                  </button>
                </SubMenu>
              </>
            )}
          </div>

          {/* Download */}
          {showFileActions && !isDeleted && (
            <button
              className="gd-context-item"
              onClick={close(() => onDownload(item))}
            >
              <IconDownload size={18} /> Download
            </button>
          )}

          {/* Rename / trash */}
          {canEdit && item && !isDeleted && (
            <>
              <button
                className="gd-context-item"
                onClick={close(() => onRename(item))}
              >
                <IconRename size={18} /> Rename
              </button>
              <div className="gd-context-divider" />
            </>
          )}
          {canEdit && isDeleted && (
            <>
              <button
                className="gd-context-item"
                onClick={close(() => onRestore(item))}
              >
                <IconRestore size={18} />
                Restore
              </button>
              <div className="gd-context-divider" />

              <button
                className="gd-context-item danger"
                onClick={close(() => onDelete(item, type))}
              >
                <IconTrash size={18} /> Delete Forever
              </button>
            </>
          )}
          {isGoogleDriveRoute &&
               <button
                className="gd-context-item danger"
                onClick={close(() => onDelete(item, type))}
                
              >
                <IconTrash size={18} /> Delete Forever
              </button>
          }
          {canEdit && item && !isDeleted && !isGoogleDriveRoute && (
            <button
              className="gd-context-item danger"
              onClick={close(() => onSoftDelete(item))}
            >
              <IconTrash size={18} /> Move to trash
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ContextMenu({ open, item, position, ...rest }) {
  const [mounted, setMounted] = useState(false);
  const [render, setRender] = useState({
    item: null,
    position: null,
    key: null,
  });

  useEffect(() => {
    if (!open || !item) return;
    const instanceKey = `${position.x},${position.y},${item?._id ?? ""},${
      item?.isDirectory ? "dir" : "file"
    }`;
    setRender((prev) =>
      prev.key === instanceKey ? prev : { item, position, key: instanceKey },
    );
    setMounted(true);
  }, [open, item, position]);

  if (!mounted) return null;

  return createPortal(
    <ContextMenuContent
      key={render.key}
      item={render.item}
      position={render.position}
      open={open}
      onExited={() => setMounted(false)}
      {...rest}
    />,
    document.body,
  );
}
