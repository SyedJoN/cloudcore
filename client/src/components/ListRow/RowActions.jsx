import { IconDots, IconDownload, IconRename, IconShare } from "../Icons/Icons";
import { StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

export default function RowActions({
  item,
  itemId,
  isStarred,
  isListHovered,
  isDeleted,
  isGoogleDriveRoute,
  canShare,
  canDownload,
  canRename,
  onStar,
  onDownload,
  onRename,
  onShare,
  onSelect,
  onContextMenu,
}) {
  return (
    <div className="gd-list-row-cell flex">
      <div className={`flex ${isListHovered ? "" : "visible-hidden"}`}>
        {canShare && (
          <button
            className="gd-sel-action-btn-list-row"
            title="Share"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(itemId);

              onShare?.(itemId);
            }}
          >
            <IconShare size={18} />
          </button>
        )}

        {canDownload && (
          <button
            className="gd-sel-action-btn-list-row"
            title="Download"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(itemId);
              onDownload?.(itemId);
            }}
          >
            <IconDownload size={18} />
          </button>
        )}

        {!isDeleted && canRename && (
          <button
            className="gd-sel-action-btn-list-row"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(itemId);

              onRename?.(itemId);
            }}
          >
            <IconRename size={18} />
          </button>
        )}

        {!isGoogleDriveRoute && (
          <button
            className="gd-sel-action-btn-list-row"
            title="Star"
            onClick={(e) => {
              e.stopPropagation();

              onSelect(itemId);
              onStar(itemId);
            }}
          >
            {isStarred?.[itemId] ? (
              <StarIconSolid className="w-5 h-5" />
            ) : (
              <StarIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      <button
        className="gd-sel-action-btn-list-row"
        style={{
          width: 32,
          height: 32,
          marginLeft: "auto",
          cursor: "pointer",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
          onContextMenu?.(e, itemId);
        }}
      >
        <IconDots size={16} />
      </button>
    </div>
  );
}
