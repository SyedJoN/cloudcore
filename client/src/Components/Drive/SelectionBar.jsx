import { getCountLabel } from "../../../Utils/displayUtils";
import {
  IconClose,
  IconDownload,
  IconRestore,
  IconShare,
  IconLink,
  IconTrash,
  IconDots,
} from "../../Components/Icons/Icons";
import { FolderInput } from "lucide-react";

import { useToast } from "../../Contexts";

export default function SelectionBar({
  selectedItems,
  route,
  item: itemProp = null,
  items = null,
  onClear,
  onDownload,
  onContextMenu,
  onShare,
  onMove,
  onRestore,
  onTrash,
  onDeleteForever,
}) {
  if (selectedItems.size === 0) {
    return null;
  }

  const { toast } = useToast();

  const raw = items?.length ? items : itemProp;
  const targets = Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];

  const isMulti = targets.length > 1;
  const item = targets[0];
  console.log('targets', targets)

  // Actions are enabled only if EVERY selected item allows them.
  const every = (fn) => targets.every(fn);
  const some = (fn) => targets.some(fn);

  const payload = isMulti ? targets : item;

  // run action, then close the sheet
  const run =
    (action) =>
    (...args) => {
      action?.(...args);
      onClear();
    };

  if (!item) {
    return null;
  }

  // ITEM TYPE / ROUTE
  const isGoogle = every((it) => Boolean(it.webViewLink));

  const isTrashRoute = route === "trash";
  const isSharedRoute = route === "shared";
  const isGoogleDriveRoute = route === "google-drive" && isGoogle;
  const isDeleted = some((it) => Boolean(it?.isDeleted));

  // CAPABILITIES
  const capabilities = item.capabilities || {};

  const canDownload = capabilities.canDownload === true;
  const canRename = capabilities.canRename === true;
  const canDelete = capabilities.canDelete === true;
  const canTrash = capabilities.canTrash === true;
  const canMove = capabilities.canMove === true;

  // SHARE
  const canShare = true;

  // COPY LINK

  const handleCopyLink = async (ids) => {
    if (isDeleted) return;

    try {
      const selectedIds = Array.isArray(ids) ? ids : [ids];

      const files = selectedIds
        .map((id) => targets.find((it) => it._id === id))
        .filter(Boolean)
        .filter((file) => !file.isDeleted);

      if (!files.length) return;

      const urls = files.map((file) => {
        return (
          file.webViewLink ??
          (file.isDirectory
            ? `${window.location.origin}/directory/${file._id}?usp=drive_link`
            : `${window.location.origin}/file/${file._id}?usp=drive_link`)
        );
      });

      await navigator.clipboard.writeText(urls.join(", "));

      toast({
        message:
          files.length > 1
            ? "Links copied to clipboard"
            : "Link copied to clipboard",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to copy links:", error);

      toast({
        message: "Failed to copy link",
        type: "error",
      });
    }
  };

  // TRASH ROUTE

  if (isTrashRoute) {
    return (
      <div className="gd-selection-bar">
        {/* CLEAR SELECTION */}
        <button
          className="gd-icon-btn gd-sel-close"
          title="Clear selection"
          onClick={onClear}
        >
          <IconClose size={18} />
        </button>

        <span className="gd-selection-count">
          {selectedItems.size} selected
        </span>

        <div className="gd-selection-actions">
          {/* RESTORE */}
          <button
            className="gd-sel-action-btn gd-sel-action-success"
            title="Restore"
            disabled={!canDelete}
            onClick={() => onRestore(payload)}
          >
            <IconRestore size={18} />
          </button>

          {/* DELETE FOREVER */}
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Delete Forever"
            disabled={!canDelete}
            onClick={() => onDeleteForever(isGoogle ? "google" : "local", payload)}
          >
            <IconTrash size={18} />
          </button>
        </div>
      </div>
    );
  }

  // NORMAL ROUTES

  const downloadDisabled = isDeleted || !canDownload;
  const moveDisabled = isDeleted || !canMove;
  const shareDisabled = isDeleted || !canShare;

  const copyLinkDisabled = isDeleted;

  const trashDisabled = isDeleted || isGoogle || isSharedRoute || !canTrash;

  const removeDisabled = isDeleted || isGoogle || !isSharedRoute || !canDelete;

  const googleDeleteDisabled = isDeleted || !isGoogleDriveRoute || !canDelete;

  return (
    <div className="gd-selection-bar">
      {/* CLEAR SELECTION */}
      <button
        className="gd-icon-btn gd-sel-close"
        title="Clear selection"
        onClick={onClear}
      >
        <IconClose size={18} />
      </button>

      <span className="gd-selection-count">{selectedItems.size} selected</span>

      <div className="gd-selection-actions">
        {/* SHARE */}
        <button
          className="gd-sel-action-btn"
          title="Share"
          disabled={shareDisabled}
          onClick={() => onShare(payload)}
        >
          <IconShare size={18} />
        </button>

        {/* DOWNLOAD */}
        <button
          className="gd-sel-action-btn"
          title="Download"
          disabled={downloadDisabled}
          onClick={() => onDownload(payload)}
        >
          <IconDownload size={18} />
        </button>
        {/* MOVE */}
        <button
          className="gd-sel-action-btn"
          title="Move"
          disabled={moveDisabled}
          onClick={() => {
            onMove(isMulti ? targets.map((it) => it) : item);
          }}
        >
          <FolderInput size={18} />
        </button>

        {/* MOVE TO TRASH */}
        {!isGoogle && !isSharedRoute && !isGoogleDriveRoute && (
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Move to trash"
            disabled={trashDisabled}
            onClick={() => onTrash(payload)}
          >
            <IconTrash size={18} />
          </button>
        )}

        {/* REMOVE FROM SHARED */}
        {!isGoogle && isSharedRoute && (
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Remove"
            disabled={removeDisabled}
            onClick={onDeleteForever}
          >
            <IconTrash size={18} />
          </button>
        )}

        {/* GOOGLE DRIVE DELETE */}
        {isGoogleDriveRoute && (
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Delete"
            disabled={googleDeleteDisabled}
            onClick={() => onDeleteForever("google")}
          >
            <IconTrash size={18} />
          </button>
        )}
        {/* COPY LINK */}
        <button
          className="gd-sel-action-btn"
          title="Copy link"
          disabled={copyLinkDisabled}
          onClick={() =>
            handleCopyLink(isMulti ? targets.map((it) => it._id) : item._id)
          }
        >
          <IconLink size={18} />
        </button>
        {/* Context Menu */}
        <button
          className="gd-sel-action-btn"
          title="Copy link"
          onClick={(e) =>
            onContextMenu?.(
              e,
              isMulti
                ? targets.map((it) => it._id ?? it.id)
                : item._id,
            )
          }
        >
          <IconDots size={18} />
        </button>
      </div>
    </div>
  );
}
