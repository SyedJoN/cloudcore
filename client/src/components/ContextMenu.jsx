import { useEffect, useState } from "react";
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
} from "./Icons";
import { useToast } from "../Contexts/ToastContext";

export default function ContextMenu({
  item,
  loggedIn,
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
  if (!item) return null;
const BASE_URL = "http://localhost:4000";
  
  const [showOpenWith, setShowOpenWith] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const { toast } = useToast();
  const isOwner = item.userRole === "owner";
  const isViewer = item.userRole === "viewer" || item.publicRole === "viewer";

  const showDeleteActions = isTrashRoute && isDeleted && !dirId;

  useEffect(() => {
    function handleClick(e) {
      if (!e.target.closest(".gd-context-menu")) {
        onClose();
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [onClose]);

  function handleCopyLink() {
    const url = item.webViewLink
      ? item.webViewLink
      : item.isDirectory
        ? `${window.location.origin}/directory/${item._id}?usp=drive_link`
        : `${window.location.origin}/file/${item._id}?usp=drive_link`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ message: "Link copied to clipboard", type: "success" });
      onClose();
    });
  }
  return showDeleteActions ? (
    <div
      className="gd-context-menu"
      style={{ left: position.x, top: position.y, zIndex: 1000 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="gd-context-item"
        onClick={() => {
          onRestore(item);
          onClose();
        }}
      >
        <IconRestore size={18} />
        Restore
      </button>
      <div className="gd-context-divider" />
      <button
        className="gd-context-item danger"
        onClick={() => {
          onDelete(item);
          onClose();
        }}
      >
        <IconTrash size={18} /> Delete forever
      </button>
    </div>
  ) : (
    // Normal Actions
    <div
      className="gd-context-menu"
      style={{ left: position.x, top: position.y, zIndex: 1000 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Open with — files only */}
      {!item.isDirectory && (
        <div style={{ position: "relative" }}>
          <button
            className="gd-context-item"
            onMouseEnter={() => setShowOpenWith(true)}
            onMouseLeave={() => setShowOpenWith(false)}
          >
            <IconOpenWith size={18} />
            <span style={{ flex: 1 }}>Open with</span>
            <IconChevronRight size={16} />
          </button>

          {showOpenWith && (
            <div
              className="gd-context-menu"
              style={{
                position: "absolute",
                left: "100%",
                top: 0,
                zIndex: 1001,
                minWidth: 180,
              }}
              onMouseEnter={() => setShowOpenWith(true)}
              onMouseLeave={() => setShowOpenWith(false)}
            >
              <button
                className="gd-context-item"
                onClick={() => {
                  onPreview(item);
                  onClose();
                }}
              >
                <IconPreview size={18} /> Preview
              </button>
              <button
                className="gd-context-item"
                onClick={() => {
                  const url = item.webViewLink || `/file/${item._id}`;
                  window.open(url, "_blank");
                  onClose();
                }}
              >
                <IconNewTab size={18} /> Open in new tab
              </button>
            </div>
          )}
        </div>
      )}

      {/* Share dropdown */}
      <div style={{ position: "relative" }}>
        {!isGoogleDriveRoute && (
          <button
            className="gd-context-item"
            onMouseEnter={() => setShowShare(true)}
            onMouseLeave={() => setShowShare(false)}
          >
            <IconShare size={18} />
            <span style={{ flex: 1 }}>Share</span>
            <IconChevronRight size={16} />
          </button>
        )}
        {showShare && (
          <div
            className="gd-context-menu"
            style={{
              position: "absolute",
              left: "100%",
              top: 0,
              zIndex: 1001,
              minWidth: 180,
            }}
            onMouseEnter={() => setShowShare(true)}
            onMouseLeave={() => setShowShare(false)}
          >
            {(isOwner || !isViewer) && (
              <button
                className="gd-context-item"
                onClick={() => {
                  onShare(item);
                  onClose();
                }}
              >
                <IconShare size={18} /> Share
              </button>
            )}
            <button className="gd-context-item" onClick={handleCopyLink}>
              <IconLink size={18} />
              Copy link
            </button>
          </div>
        )}
         {isGoogleDriveRoute && (
          <button className="gd-context-item" onClick={handleCopyLink}>
            <IconLink size={18} />
            Copy link
          </button>
        )}
      </div>

      {!item.isDirectory && (
        <button
          className="gd-context-item"
          onClick={() => {
            onDownload(item);
            onClose();
          }}
        >
          <IconDownload size={18} /> Download
        </button>
      )}

      {!isGoogleDriveRoute && (isOwner || !isViewer) && loggedIn && (
        <>
          <button
            className="gd-context-item"
            onClick={() => {
              onRename(item);
              onClose();
            }}
          >
            <IconRename size={18} /> Rename
          </button>
          <div className="gd-context-divider" />
          <button
            className="gd-context-item danger"
            onClick={() => {
              onSoftDelete(item);
              onClose();
            }}
          >
            <IconTrash size={18} /> Move to trash
          </button>
        </>
      )}
    </div>
  );
}
