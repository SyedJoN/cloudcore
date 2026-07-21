// components/DetailsSidebar.jsx
import { formatSize } from "../../utils/formatHelpers";
import FilePreview from "./FilePreview";
import { IconClose, IconFolder, IconShare } from "./Icons";

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export default function DetailsSidebar({
  item,
  onClose,
  onShare,
  selectedItemSize,
  userEmail,
}) {
  if (!item && selectedItemSize < 1)
    return (
      <aside className="gd-details-sidebar gd-details-empty">
        <div className="gd-details-header">
          <span className="gd-details-title">Details</span>
        </div>
        <div className="gd-details-placeholder">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>Select an item to see its details</p>
        </div>
      </aside>
    );
  if (selectedItemSize > 1) {
    return (
      <aside className="gd-details-sidebar">
        <div className="gd-selected-items-header">
          <svg
            className="tick-icon"
            width="24px"
            height="24px"
            viewBox="0 0 24 24"
            focusable="false"
            fill="currentColor"
          >
            <path d="M0 0h24v24H0V0z" fill="none"></path>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-5.8l-2.6-2.6L6 13l4 4 8-8-1.4-1.4z"></path>
          </svg>
          <span className="selected-item-text">
            {selectedItemSize} items selected
          </span>
          <button
            className="gd-details-close-btn"
            onClick={onClose}
            title="Close details"
          >
            <IconClose size={16} />
          </button>
        </div>
      </aside>
    );
  }
  const isDir = item.isDirectory;
  const owner =
    userEmail === item.userId?.email || item.owners[0].emailAddress ? "Me" : item.userId?.name || item.owners[0].displayName || "—";
  const size = formatSize(item.size);
  const modified = formatDate(item.updatedAt || item.modifiedTime);
  const created = formatDate(item.createdAt || item.createdTime);
  const isPublic = item.isPublic;
  const publicRole = item.publicRole;

  return (
    <aside className="gd-details-sidebar">
      <div className="gd-details-header">
        <span className="gd-details-title">Details</span>
        <button className="gd-icon-btn" onClick={onClose} title="Close details">
          <IconClose size={16} />
        </button>
      </div>

      <div className="gd-details-body">
        {/* Preview */}
        <div className="gd-details-preview">
          <div className="gd-details-preview">
            {item.isDirectory ? (
              <IconFolder size={48} style={{ color: "#5f6368" }} />
            ) : (
              <FilePreview item={item} />
            )}
          </div>
        </div>

        <p className="gd-details-name">{item.name}</p>

        {/* Info section */}
        <div className="gd-details-section-label">Info</div>
        <div className="gd-details-table">
          <div className="gd-details-row">
            <span className="gd-details-key">Type</span>
            <span className="gd-details-val">
              {isDir
                ? "Folder"
                : item.name?.split(".").pop()?.toUpperCase() + " file"}
            </span>
          </div>

          <div className="gd-details-row">
            <span className="gd-details-key">Size</span>
            <span className="gd-details-val">{size}</span>
          </div>

          {isDir && item.itemCount != null && (
            <div className="gd-details-row">
              <span className="gd-details-key">Items</span>
              <span className="gd-details-val">{item.itemCount}</span>
            </div>
          )}
        </div>

        <div className="gd-details-divider" />

        {/* Dates */}
        <div className="gd-details-section-label">Activity</div>
        <div className="gd-details-table">
          <div className="gd-details-row">
            <span className="gd-details-key">Modified</span>
            <span className="gd-details-val">{modified}</span>
          </div>
          <div className="gd-details-row">
            <span className="gd-details-key">Created</span>
            <span className="gd-details-val">{created}</span>
          </div>
          <div className="gd-details-row">
            <span className="gd-details-key">Owner</span>
            <span className="gd-details-val">{owner}</span>
          </div>
        </div>

        <div className="gd-details-divider" />

        {/* Access */}
        <div className="gd-details-section-label">Access</div>
        <div className="gd-details-table">
          <div className="gd-details-row">
            <span className="gd-details-key">Visibility</span>
            <span
              className={`gd-details-badge ${isPublic ? "gd-badge-public" : "gd-badge-private"}`}
            >
              {isPublic ? `${publicRole || "viewer"} · public` : "Restricted"}
            </span>
          </div>
        </div>

        {onShare && (
          <button
            className="gd-details-share-btn"
            onClick={() => onShare(item)}
          >
            <IconShare size={14} /> Manage access
          </button>
        )}
      </div>
    </aside>
  );
}
