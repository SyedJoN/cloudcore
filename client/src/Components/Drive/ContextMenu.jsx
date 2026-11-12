import { useEffect, useRef, useState } from "react";
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
import {
  Portal,
  useTransitionClass,
  useSelfMountedTransition,
} from "../../Hooks/useFloatingMenu";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { FolderOpenIcon, StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { FolderInput } from "lucide-react";

/* 
   HELPERS
 */

// Always returns an array of truthy items
function normalizeTargets(item, items) {
  const raw = items?.length ? items : item;
  return Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
}

const getId = (it) => String(it?._id ?? it?.id ?? "");

/* 
   SUB MENU
 */

function SubMenu({ open, openLeft, onMouseEnter, onMouseLeave, children }) {
  const { mounted, animate, nodeRef, onTransitionEnd } =
    useSelfMountedTransition(open);

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

/* 
   SUB MENU CONSTANTS
 */

const SUBMENU_OPEN_DELAY = 150;
const SUBMENU_CLOSE_DELAY = 120;

/* 
   HOVER INTENT
 */

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

/* 
   CONTEXT MENU CONTENT
 */

function ContextMenuContent({
  open,
  onExited,
  openLeft,
  targets,
  position,
  route,
  isStarred = {},
  dirId,
  onClose,
  onShare,
  onRename,
  onTrash,
  onDeleteForever,
  onRestore,
  onDownload,
  onCopy,
  onMove,
  onStar,
  onPreview,
}) {
  const { animate, nodeRef, onTransitionEnd } = useTransitionClass(
    open,
    onExited,
  );

  const { toast } = useToast();

  /*
   * IMPORTANT:
   * Keep these declarations ONLY here.
   * Do not redeclare them elsewhere in this component.
   */
  const [showOpenWith, setShowOpenWith] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showOrganize, setShowOrganize] = useState(false);

  const openWithHover = useHoverIntent(setShowOpenWith);
  const shareHover = useHoverIntent(setShowShare);
  const organizeHover = useHoverIntent(setShowOrganize);

  useEffect(() => {
    function handleClick(e) {
      if (
        !e.target.closest(".gd-context-menu") &&
        !e.target.closest(".gd-context-submenu") &&
        !e.target.closest(".gd-selection-bar")
      ) {
        onClose();
      }
    }

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [onClose]);

  /* 
     TARGETS
   */

  const item = targets[0];

  if (!item) {
    return null;
  }

  const isMulti = targets.length > 1;

  // Actions are enabled only if EVERY selected item allows them.
  const every = (fn) => targets.every(fn);
  const some = (fn) => targets.some(fn);

  const isGoogle = every((it) => Boolean(it.webViewLink));
  const isSharedRoute = route === "shared";
  const isGoogleDriveRoute = route === "google-drive" && isGoogle;
  const isTrashRoute = route === "trash";

  const isFile = every((it) => !it.isDirectory);

  /* 
     CAPABILITIES
   */

  const cap = (name) => every((it) => it.capabilities?.[name] === true);

  const canRead = every((it) =>
    it.webViewLink ? true : it.capabilities?.canRead === true,
  );

  const canDownload = cap("canDownload");
  const canCopy = true;
  const canMove = cap("canMove");
  const canShare = true;
  const canRename = cap("canRename");
  const canTrash = cap("canTrash");
  const canDelete = cap("canDelete");

  const isDeleted = some((it) => Boolean(it?.isDeleted));
  const allDeleted = every((it) => Boolean(it?.isDeleted));

  const showDeleteActions = isTrashRoute && allDeleted && !dirId;

  /* 
     STARRED
   */

  // everything starred -> "Remove", otherwise "Add"
  const starred = every((it) => Boolean(isStarred[it._id]));

  // onStar toggles per item, so only pass the ones that need to change
  const starTargets = starred
    ? targets
    : targets.filter((it) => !isStarred[it._id]);

  // Single item -> the item itself; multiple -> the array.
  // (Parent callbacks should accept both, e.g. [].concat(x))
  const payload = isMulti ? targets : item;

  /* 
     CLOSE WRAPPER
   */

  const close =
    (action) =>
    (...args) => {
      action?.(...args);
      onClose();
    };

  /* 
     COPY LINK
   */

  async function handleCopyLink() {
    if (isDeleted) return;

    try {
      const files = targets.filter((file) => !file.isDeleted);

      if (!files.length) return;

      const urls = files.map(
        (file) =>
          file.webViewLink ??
          (file.isDirectory
            ? `${window.location.origin}/directory/${file._id}?usp=drive_link`
            : `${window.location.origin}/file/${file._id}?usp=drive_link`),
      );

      await navigator.clipboard.writeText(urls.join(", "));

      toast({
        message:
          files.length > 1
            ? "Links copied to clipboard"
            : "Link copied to clipboard",
        type: "success",
      });

      onClose();
    } catch (error) {
      console.error("Failed to copy links:", error);

      toast({
        message: "Failed to copy link",
        type: "error",
      });
    }
  }

  /* 
     OPEN IN NEW TAB (single only)
   */

  function handleOpenInNewTab() {
    window.open(item.webViewLink || `/file/${item._id}`, "_blank");

    onClose();
  }

  /* 
     RENDER
   */

  return (
    <div
      ref={nodeRef}
      onTransitionEnd={onTransitionEnd}
      className={`gd-context-menu ${animate ? "open" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 
          TRASH MENU
     */}

      {showDeleteActions ? (
        <>
          <button
            className="gd-context-item"
            disabled={!canDelete}
            onClick={close(() => onRestore(payload))}
          >
            <IconRestore size={18} />
            Restore
          </button>

          <button
            className="gd-context-item danger"
            disabled={!canDelete}
            onClick={close(() =>
              onDeleteForever(isGoogle ? "google" : "local", payload),
            )}
          >
            <IconTrash size={18} />
            Delete forever
          </button>
        </>
      ) : (
        /* ====
           NORMAL MENU
        ==== */
        <div>
          {/* 
              OPEN WITH
              SINGLE FILE ONLY
           */}

          {!isMulti && isFile && (
            <>
              <div style={{ position: "relative" }}>
                <button
                  className="gd-context-item"
                  disabled={isDeleted || !canRead}
                  onMouseEnter={
                    !isDeleted && canRead
                      ? openWithHover.onMouseEnter
                      : undefined
                  }
                  onMouseLeave={
                    !isDeleted && canRead
                      ? openWithHover.onMouseLeave
                      : undefined
                  }
                >
                  <IconOpenWith size={18} />

                  <span style={{ flex: 1 }}>Open with</span>

                  <IconChevronRight size={16} />
                </button>

                <SubMenu
                  open={showOpenWith && !isDeleted && canRead}
                  openLeft={openLeft}
                  onMouseEnter={openWithHover.onMouseEnter}
                  onMouseLeave={openWithHover.onMouseLeave}
                >
                  <button
                    className="gd-context-item"
                    onClick={close(() => onPreview(item))}
                  >
                    <IconPreview size={18} />
                    Preview
                  </button>

                  <button
                    className="gd-context-item"
                    onClick={handleOpenInNewTab}
                  >
                    <IconNewTab size={18} />
                    Open in new tab
                  </button>
                </SubMenu>
              </div>

              <div className="gd-context-divider" />
            </>
          )}

          {/* 
              DOWNLOAD
           */}

          <button
            className="gd-context-item"
            disabled={isDeleted || !canDownload}
            onClick={close(() => onDownload(payload))}
          >
            <IconDownload size={18} />
            Download
          </button>

          {/* 
              RENAME (single only)
           */}

          {!isMulti && (
            <button
              className="gd-context-item"
              disabled={isDeleted || !canRename}
              onClick={close(() => onRename(item))}
            >
              <IconRename size={18} />
              Rename
            </button>
          )}

          {/* 
              COPY
           */}

          <button
            className="gd-context-item"
            disabled={isSharedRoute || !canCopy}
            title="Copy"
            onClick={close(() => onCopy(payload))}
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
            Make a Copy
          </button>

          <div className="gd-context-divider" />

          {/* 
              SHARE
           */}

          <div style={{ position: "relative" }}>
            <button
              className="gd-context-item"
              disabled={isDeleted || !canShare}
              onMouseEnter={
                !isDeleted && canShare ? shareHover.onMouseEnter : undefined
              }
              onMouseLeave={
                !isDeleted && canShare ? shareHover.onMouseLeave : undefined
              }
            >
              <IconShare size={18} />

              <span style={{ flex: 1 }}>Share</span>

              <IconChevronRight size={16} />
            </button>

            <SubMenu
              open={showShare && !isDeleted && canShare}
              openLeft={openLeft}
              onMouseEnter={shareHover.onMouseEnter}
              onMouseLeave={shareHover.onMouseLeave}
            >
              <button
                className="gd-context-item"
                onClick={close(() => onShare(payload))}
              >
                <IconShare size={18} />
                Share
              </button>

              <button
                className="gd-context-item"
                disabled={!canRead}
                onClick={handleCopyLink}
              >
                <IconLink size={18} />
                Copy link
              </button>
            </SubMenu>
          </div>

          {/* 
              ORGANIZE / MOVE / STAR

              Folders ALSO get this.
              Open with is the thing restricted to files.
           */}

          <div style={{ position: "relative" }}>
            <button
              className="gd-context-item"
              disabled={isDeleted || !canMove || isGoogleDriveRoute}
              onMouseEnter={
                !isDeleted && canMove && !isGoogleDriveRoute
                  ? organizeHover.onMouseEnter
                  : undefined
              }
              onMouseLeave={
                !isDeleted && canMove && !isGoogleDriveRoute
                  ? organizeHover.onMouseLeave
                  : undefined
              }
            >
              <FolderOpenIcon className="w-5 h-5" />

              <span style={{ flex: 1 }}>Organize</span>

              <IconChevronRight size={16} />
            </button>

            <SubMenu
              open={
                showOrganize && !isDeleted && canMove && !isGoogleDriveRoute
              }
              openLeft={openLeft}
              onMouseEnter={organizeHover.onMouseEnter}
              onMouseLeave={organizeHover.onMouseLeave}
            >
              {/* MOVE */}

              <button
                className="gd-context-item"
                disabled={isSharedRoute || isDeleted || !canMove}
                // single: the id, multiple: array of ids
                onClick={close(() =>
                  onMove(isMulti ? targets.map((it) => it) : item),
                )}
              >
                <FolderInput width={18} height={18} />
                Move
              </button>

              {/* STAR */}

              <button
                className="gd-context-item"
                disabled={isDeleted || isGoogleDriveRoute}
                title="Star"
                onClick={close(() => onStar(isMulti ? starTargets : item))}
              >
                {starred ? (
                  <StarIconSolid className="w-5 h-5" />
                ) : (
                  <StarIcon className="w-5 h-5" />
                )}
                {starred ? "Remove from starred" : "Add to starred"}
              </button>
            </SubMenu>
          </div>

          <div className="gd-context-divider" />

          {/* 
              MOVE TO TRASH
           */}

          {!isDeleted && !isGoogleDriveRoute && (
            <button
              className="gd-context-item danger"
              disabled={isDeleted || !canDelete || !canTrash}
              onClick={close(() => onTrash(payload))}
            >
              <IconTrash size={18} />
              Move to trash
            </button>
          )}

          {/* 
              GOOGLE DRIVE DELETE
           */}

          {isGoogleDriveRoute && (
            <button
              className="gd-context-item danger"
              disabled={isDeleted || !canDelete}
              onClick={close(() =>
                onDeleteForever(isGoogle ? "google" : "local", payload),
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

/* 
   CONTEXT MENU

   Accepts either `item` (single) or `items` (array).
 */

export default function ContextMenu({
  open,
  item = null,
  items = null,
  position,
  setShowCreateMenu,
  ...rest
}) {
  const [mounted, setMounted] = useState(false);

  const [render, setRender] = useState({
    targets: [],
    position: null,
    key: null,
  });

  const targets = normalizeTargets(item, items);
  const targetsKey = targets
    .map((it) => `${getId(it)}:${it?.isDirectory ? "dir" : "file"}`)
    .join("|");

  useEffect(() => {
    if (!open || !targets.length || !position) {
      return;
    }
    setShowCreateMenu?.(false);

    const instanceKey = `${position.x},${position.y},${targetsKey}`;

    setRender((prev) => {
      if (prev.key === instanceKey) {
        return prev;
      }

      return {
        targets,
        position,
        key: instanceKey,
      };
    });

    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetsKey, position]);

  if (!mounted) {
    return null;
  }

  return (
    <Portal>
      <ContextMenuContent
        key={render.key}
        targets={render.targets}
        position={render.position}
        open={open}
        onExited={() => setMounted(false)}
        {...rest}
      />
    </Portal>
  );
}