
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

/* ============================================================
   TRANSITION
============================================================ */

function useTransitionClass(open, onExited) {
  const [animate, setAnimate] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => {
        setAnimate(true);
      });

      return () => cancelAnimationFrame(id);
    }

    setAnimate(false);
  }, [open]);

  function onTransitionEnd(e) {
    if (e.target !== nodeRef.current) return;
    if (e.propertyName !== "transform") return;

    if (!open) {
      onExited?.();
    }
  }

  return {
    animate,
    nodeRef,
    onTransitionEnd,
  };
}

/* ============================================================
   SELF MOUNTED TRANSITION
============================================================ */

function useSelfMountedTransition(open) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
    }
  }, [open]);

  const transition = useTransitionClass(open, () => {
    setMounted(false);
  });

  return {
    mounted,
    ...transition,
  };
}

/* ============================================================
   SUB MENU
============================================================ */

function SubMenu({
  open,
  openLeft,
  onMouseEnter,
  onMouseLeave,
  children,
}) {
  const {
    mounted,
    animate,
    nodeRef,
    onTransitionEnd,
  } = useSelfMountedTransition(open);

  if (!mounted) {
    return null;
  }

  return (
    <div
      ref={nodeRef}
      onTransitionEnd={onTransitionEnd}
      className={`gd-context-menu gd-context-submenu min-w-45 lg:min-w-75 ${
        openLeft ? "right-75" : "left-full"
      } ${animate ? "open" : ""}`}
      style={{
        position: "absolute",
        top: 0,
        zIndex: 1001,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

/* ============================================================
   SUB MENU CONSTANTS
============================================================ */

const SUBMENU_OPEN_DELAY = 150;
const SUBMENU_CLOSE_DELAY = 120;

/* ============================================================
   HOVER INTENT
============================================================ */

function useHoverIntent(setOpen) {
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
    };
  }, []);

  return {
    onMouseEnter: () => {
      clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        setOpen(true);
      }, SUBMENU_OPEN_DELAY);
    },

    onMouseLeave: () => {
      clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        setOpen(false);
      }, SUBMENU_CLOSE_DELAY);
    },
  };
}

/* ============================================================
   CONTEXT MENU CONTENT
============================================================ */

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
}) {
  const {
    animate,
    nodeRef,
    onTransitionEnd,
  } = useTransitionClass(open, onExited);

  const { toast } = useToast();

  const [showOpenWith, setShowOpenWith] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const openWithHover = useHoverIntent(setShowOpenWith);
  const shareHover = useHoverIntent(setShowShare);

  /* ============================================================
     ITEM
  ============================================================ */

  if (!item) {
    return null;
  }

  const isGoogle = Boolean(item.webViewLink);
  const isFile = !item.isDirectory;

  const showFileActions = isFile;

  /* ============================================================
     CAPABILITIES

     IMPORTANT:
     Authorization comes ONLY from item.capabilities.

     This works for:
       - local files
       - local folders
       - Google Drive files
       - Google Drive folders

     No owner/permission lookup is required here.
  ============================================================ */

  const capabilities = item.capabilities ?? {};

  const canRead = capabilities.canRead === true;

  const canDownload =
    capabilities.canDownload === true;

  const canShare =
    capabilities.canShare === true;

  const canRename =
    capabilities.canRename === true;

  const canTrash =
    capabilities.canTrash === true;

  const canDelete =
    capabilities.canDelete === true;

  /* ============================================================
     ROUTES / STATE
  ============================================================ */

  const isDeleted = item?.isDeleted;

  const showDeleteActions =
    isTrashRoute &&
    isDeleted &&
    !dirId;

  const showNormalActions =
    !isTrashRoute &&
    !isDeleted;

  /* ============================================================
     CLOSE WRAPPER
  ============================================================ */

  const close =
    (action) =>
    (...args) => {
      action?.(...args);
      onClose();
    };

  /* ============================================================
     CLICK OUTSIDE
  ============================================================ */

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

    return () => {
      document.removeEventListener(
        "click",
        handleClick,
        true,
      );
    };
  }, [onClose]);

  /* ============================================================
     COPY LINK
  ============================================================ */

  async function handleCopyLink() {
    const url =
      item.webViewLink ??
      (item.isDirectory
        ? `${window.location.origin}/directory/${item._id}?usp=drive_link`
        : `${window.location.origin}/file/${item._id}?usp=drive_link`);

    try {
      await navigator.clipboard.writeText(url);

      toast({
        message: "Link copied to clipboard",
        type: "success",
      });

      onClose();
    } catch (error) {
      console.error(
        "Failed to copy link:",
        error,
      );

      toast({
        message: "Failed to copy link",
        type: "error",
      });
    }
  }

  /* ============================================================
     OPEN IN NEW TAB
  ============================================================ */

  function handleOpenInNewTab() {
    window.open(
      item.webViewLink ||
        `/file/${item._id}`,
      "_blank",
    );

    onClose();
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div
      ref={nodeRef}
      onTransitionEnd={onTransitionEnd}
      className={`gd-context-menu jon ${
        animate ? "open" : ""
      }`}
      style={{
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ======================================================
          TRASH / DELETED MENU
      ====================================================== */}

      {showDeleteActions ? (
        <>
          {/* Restore */}

          {canDelete && (
            <button
              className="gd-context-item"
              onClick={close(() =>
                onRestore(item)
              )}
            >
              <IconRestore size={18} />
              Restore
            </button>
          )}

          {/* Delete forever */}

          {canDelete && (
            <>
              <div className="gd-context-divider" />

              <button
                className="gd-context-item danger"
                onClick={close(() =>
                  onDelete(
                    item,
                    isGoogle
                      ? "google"
                      : "local",
                  )
                )}
              >
                <IconTrash size={18} />
                Delete forever
              </button>
            </>
          )}
        </>
      ) : (
        <div>
          {/* ==================================================
              OPEN WITH
          ================================================== */}

          {showFileActions &&
            !isDeleted &&
            canRead && (
              <div
                style={{
                  position: "relative",
                }}
              >
                <button
                  className="gd-context-item"
                  onMouseEnter={
                    openWithHover.onMouseEnter
                  }
                  onMouseLeave={
                    openWithHover.onMouseLeave
                  }
                >
                  <IconOpenWith size={18} />

                  <span
                    style={{
                      flex: 1,
                    }}
                  >
                    Open with
                  </span>

                  <IconChevronRight size={16} />
                </button>

                <SubMenu
                  open={showOpenWith}
                  openLeft={openLeft}
                  onMouseEnter={
                    openWithHover.onMouseEnter
                  }
                  onMouseLeave={
                    openWithHover.onMouseLeave
                  }
                >
                  {/* Preview */}

                  <button
                    className="gd-context-item"
                    onClick={close(() =>
                      onPreview(item)
                    )}
                  >
                    <IconPreview size={18} />
                    Preview
                  </button>

                  {/* New tab */}

                  <button
                    className="gd-context-item"
                    onClick={
                      handleOpenInNewTab
                    }
                  >
                    <IconNewTab size={18} />
                    Open in new tab
                  </button>
                </SubMenu>
              </div>
            )}

          {/* ==================================================
              SHARE
          ================================================== */}

          {!isDeleted && canShare && (
            <div
              style={{
                position: "relative",
              }}
            >
              <button
                className="gd-context-item"
                onMouseEnter={
                  shareHover.onMouseEnter
                }
                onMouseLeave={
                  shareHover.onMouseLeave
                }
              >
                <IconShare size={18} />

                <span
                  style={{
                    flex: 1,
                  }}
                >
                  Share
                </span>

                <IconChevronRight size={16} />
              </button>

              <SubMenu
                open={showShare}
                openLeft={openLeft}
                onMouseEnter={
                  shareHover.onMouseEnter
                }
                onMouseLeave={
                  shareHover.onMouseLeave
                }
              >
                {/* Share */}

                <button
                  className="gd-context-item"
                  onClick={close(() =>
                    onShare(item)
                  )}
                >
                  <IconShare size={18} />
                  Share
                </button>

                {/* Copy link */}

                {canRead && (
                  <button
                    className="gd-context-item"
                    onClick={handleCopyLink}
                  >
                    <IconLink size={18} />
                    Copy link
                  </button>
                )}
              </SubMenu>
            </div>
          )}

          {/* ==================================================
              COPY LINK

              If user can read but cannot share, they
              should still be able to copy the link.
          ================================================== */}

          {!isDeleted &&
            canRead &&
            !canShare && (
              <button
                className="gd-context-item"
                onClick={handleCopyLink}
              >
                <IconLink size={18} />
                Copy link
              </button>
            )}

          {/* ==================================================
              DOWNLOAD
          ================================================== */}

          {showFileActions &&
            !isDeleted &&
            canDownload && (
              <button
                className="gd-context-item"
                onClick={close(() =>
                  onDownload(item)
                )}
              >
                <IconDownload size={18} />
                Download
              </button>
            )}

          {/* ==================================================
              RENAME
          ================================================== */}

          {!isDeleted &&
            canRename && (
              <>
                <button
                  className="gd-context-item"
                  onClick={close(() =>
                    onRename(item)
                  )}
                >
                  <IconRename size={18} />
                  Rename
                </button>

                {/* Divider only when trash is available */}

                {canTrash && (
                  <div className="gd-context-divider" />
                )}
              </>
            )}

          {/* ==================================================
              MOVE TO TRASH
          ================================================== */}

          {!isDeleted &&
            canTrash && (
              <button
                className="gd-context-item danger"
                onClick={close(() =>
                  onSoftDelete(item)
                )}
              >
                <IconTrash size={18} />
                Move to trash
              </button>
            )}

          {/* ==================================================
              DELETE / REMOVE

              canDelete comes from backend capabilities.

              Owner:
                canDelete = true

              Shared user:
                canDelete depends on backend capability.

              No manual role checking here.
          ================================================== */}

          {!isDeleted &&
            !canTrash &&
            canDelete && (
              <button
                className="gd-context-item danger"
                onClick={close(() =>
                  onDelete(
                    item,
                    isGoogle
                      ? "google"
                      : "local",
                  )
                )}
              >
                <IconTrash size={18} />
                Remove
              </button>
            )}

          {/* ==================================================
              GOOGLE DRIVE DELETE

              Kept only for the Google Drive route if you
              want the action specifically labelled
              "Delete forever".

              Authorization still comes from canDelete.
          ================================================== */}

          {isGoogleDriveRoute &&
            !isDeleted &&
            canDelete && (
              <button
                className="gd-context-item danger"
                onClick={close(() =>
                  onDelete(
                    item,
                    "google",
                  )
                )}
              >
                <IconTrash size={18} />
                Delete forever
              </button>
            )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CONTEXT MENU
============================================================ */

export default function ContextMenu({
  open,
  item,
  position,
  ...rest
}) {
  const [mounted, setMounted] =
    useState(false);

  const [render, setRender] = useState({
    item: null,
    position: null,
    key: null,
  });

  useEffect(() => {
    if (!open || !item || !position) {
      return;
    }

    const instanceKey = `${position.x},${position.y},${
      item?._id ?? ""
    },${
      item?.isDirectory
        ? "dir"
        : "file"
    }`;

    setRender((prev) => {
      if (prev.key === instanceKey) {
        return prev;
      }

      return {
        item,
        position,
        key: instanceKey,
      };
    });

    setMounted(true);
  }, [open, item, position]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <ContextMenuContent
      key={render.key}
      item={render.item}
      position={render.position}
      open={open}
      onExited={() =>
        setMounted(false)
      }
      {...rest}
    />,
    document.body,
  );
}
