import {
  IconClose,
  IconDownload,
  IconRename,
  IconRestore,
  IconShare,
  IconTrash,
} from "../../components/Icons/Icons";

export default function SelectionBar({
  selectedItems,
  hasFileSelected,
  isDeleted,
  isTrashRoute,
  isGoogleDriveRoute,
  onClear,
  onDownload,
  onRename,
  onShare,
  onTrash,
  onRestore,
  onDeleteForever,
}) {
  if (selectedItems.size === 0) return null;

  return (
    <div className="gd-selection-bar">
      <button className="gd-icon-btn gd-sel-close" title="Clear selection" onClick={onClear}>
        <IconClose size={18} />
      </button>
      <span className="gd-selection-count">{selectedItems.size} selected</span>

      <div className="gd-selection-actions">
        {hasFileSelected && !isDeleted && (
          <button className="gd-sel-action-btn" title="Download" onClick={onDownload}>
            <IconDownload size={18} />
          </button>
        )}

        {!isGoogleDriveRoute && !isTrashRoute && !isDeleted && (
          <>
            <button className="gd-sel-action-btn" title="Edit" onClick={onRename}>
              <IconRename size={18} />
            </button>
            <button className="gd-sel-action-btn" title="Share" onClick={onShare}>
              <IconShare size={18} />
            </button>
            <button
              className="gd-sel-action-btn gd-sel-action-danger"
              title="Trash"
              onClick={onTrash}
            >
              <IconTrash size={18} />
            </button>
          </>
        )}

        {!isGoogleDriveRoute && (isTrashRoute || isDeleted) && (
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
      </div>
    </div>
  );
}