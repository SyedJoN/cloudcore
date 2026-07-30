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
  dirId,
  combinedItems,
  selectedItems,
  hasFileSelected,
  isDeleted,
  isTrashRoute,
  isGoogleDriveRoute,
  onClear,
  onDownload,
  onRename,
  onShare,
  onRestore,
  onSoftDelete,
  onDeleteForever,
}) {
  if (selectedItems.size === 0) return null;
  const { toast } = useToast();

  const item = combinedItems.find((item) =>
    selectedItems.has(item.id ?? item._id),
  );

  const userRole = item.userRole;
  const isFile = !item.isDirectory;
  const publicRole = item.publicRole;

  const isOwner = userRole === "owner";
  const isViewer = userRole === "viewer" || publicRole === "viewer";
  const canEdit = isOwner || !isViewer;

  const trashRoute = isTrashRoute && isDeleted && !dirId;
  const showFileActions = isFile;

  function handleCopyLink() {
    const url =
      item?.webViewLink ??
      (item?.isDirectory
        ? `${window.location.origin}/directory/${item?._id}?usp=drive_link`
        : `${window.location.origin}/file/${item?._id}?usp=drive_link`);

    navigator.clipboard.writeText(url).then(() => {
      toast({ message: "Link copied to clipboard", type: "success" });
    });
  }

  return (
    <div className="gd-selection-bar">
      <button
        className="gd-icon-btn gd-sel-close"
        title="Clear selection"
        onClick={onClear}
      >
        <IconClose size={18} />
      </button>
      <span className="gd-selection-count">{selectedItems.size} selected</span>

      <div className="gd-selection-actions">
        {!isTrashRoute && (
          <>
            {showFileActions && (
              <button
                className="gd-sel-action-btn"
                title="Download"
                onClick={onDownload}
              >
                <IconDownload size={18} />
              </button>
            )}

            <button
              className="gd-sel-action-btn"
              title="Share"
              onClick={onShare}
            >
              <IconShare size={18} />
            </button>
          </>
        )}
        {!isGoogleDriveRoute && (isOwner || canEdit) && !trashRoute && (
          <button className="gd-sel-action-btn" title="Edit" onClick={onRename}>
            <IconRename size={18} />
          </button>
        )}
        {/* for google just show copy link */}
        {!trashRoute && (
          <button
            className="gd-sel-action-btn"
            title="Copy link"
            onClick={handleCopyLink}
          >
            <IconLink size={18} />
          </button>
        )}

        {trashRoute && (
          <>
            <button
              className="gd-sel-action-btn gd-sel-action-success"
              title="Restore"
              onClick={onRestore}
            >
              <IconRestore size={18} />
            </button>
            <button
              className="gd-sel-action-btn gd-sel-action-danger"
              title="Delete Forever"
              onClick={onDeleteForever}
            >
              <IconTrash size={18} />
            </button>
          </>
        )}
        {!isGoogleDriveRoute && !isDeleted && (isOwner || canEdit) && (
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Move to trash"
            onClick={onSoftDelete}
          >
            <IconTrash size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
