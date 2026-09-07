
import {
  IconClose,
  IconDownload,
  IconRename,
  IconRestore,
  IconShare,
  IconLink,
  IconTrash,
} from "../../Components/Icons/Icons";
import { useToast } from "../../Contexts";


export default function SelectionBar({
  combinedItems,
  selectedItems,
  route,
  onClear,
  onDownload,
  onRename,
  onShare,
  onRestore,
  onTrash,
  onDeleteForever,
}) {
  if (selectedItems.size === 0) {
    return null;
  }

  const { toast } = useToast();

  // SELECTED ITEM
  const item = combinedItems.find((item) =>
    selectedItems.has(item.id ?? item._id)
  );

  if (!item) {
    return null;
  }

  // ITEM TYPE / ROUTE
  const isGoogle = Boolean(item.webViewLink);
  const isTrashRoute = route === "trash";
  const isSharedRoute = route === "shared";
  const isGoogleDriveRoute = route === "google-drive";
  const isDeleted = Boolean(item.isDeleted);

  // CAPABILITIES
  const capabilities = item.capabilities || {};

  const canDownload = capabilities.canDownload === true;
  const canRename = capabilities.canRename === true;
  const canDelete = capabilities.canDelete === true;
  const canTrash = capabilities.canTrash === true;

  // SHARE
  const canShare = true;


  // COPY LINK


  const handleCopyLink = async () => {
    if (isDeleted) {
      return;
    }

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
    } catch (error) {
      console.error("Failed to copy link:", error);

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
            onClick={onRestore}
          >
            <IconRestore size={18} />
          </button>

          {/* DELETE FOREVER */}
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Delete Forever"
            disabled={!canDelete}
            onClick={() =>
              onDeleteForever(isGoogle ? "google" : "local")
            }
          >
            <IconTrash size={18} />
          </button>
        </div>
      </div>
    );
  }


  // NORMAL ROUTES


  const downloadDisabled =
    isDeleted || !canDownload;

  const shareDisabled =
    isDeleted || !canShare;

  const copyLinkDisabled =
    isDeleted

  const renameDisabled =
    isDeleted || !canRename;

  const trashDisabled =
    isDeleted ||
    isGoogle ||
    isSharedRoute ||
    !canTrash;

  const removeDisabled =
    isDeleted ||
    isGoogle ||
    !isSharedRoute ||
    !canDelete;

  const googleDeleteDisabled =
    isDeleted ||
    !isGoogleDriveRoute ||
    !canDelete;

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
        {/* DOWNLOAD */}
        <button
          className="gd-sel-action-btn"
          title="Download"
          disabled={downloadDisabled}
          onClick={onDownload}
        >
          <IconDownload size={18} />
        </button>

        {/* SHARE */}
        <button
          className="gd-sel-action-btn"
          title="Share"
          disabled={shareDisabled}
          onClick={onShare}
        >
          <IconShare size={18} />
        </button>

        {/* COPY LINK */}
        <button
          className="gd-sel-action-btn"
          title="Copy link"
          disabled={copyLinkDisabled}
          onClick={handleCopyLink}
        >
          <IconLink size={18} />
        </button>

        {/* RENAME / EDIT */}
        <button
          className="gd-sel-action-btn"
          title="Edit"
          disabled={renameDisabled}
          onClick={onRename}
        >
          <IconRename size={18} />
        </button>

        {/* MOVE TO TRASH */}
        {!isGoogle && !isSharedRoute && !isGoogleDriveRoute && (
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Move to trash"
            disabled={trashDisabled}
            onClick={onTrash}
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
      </div>
    </div>
  );
}
