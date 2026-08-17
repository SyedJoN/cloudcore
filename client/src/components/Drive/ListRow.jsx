import { IconFolder, IconDots } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import { getFileType } from "../../../Utils/displayUtils";
import { formatDate } from "../../../Utils/formatDate";
import { formatSize } from "../../../Utils/formatHelpers";
import { useGDrive } from "../../Contexts";

export default function ListRow({
  item,
  owner,
  dirId,
  onRowClick,
  onDoubleClick,
  selected,
  onSelect,
  onContextMenu,
}) {
  const { isGoogleDrive } = useGDrive();
  const isGoogleDriveRoute = location.pathname.endsWith("/google-drive");

  const type = item.isDirectory
    ? isGoogleDrive && isGoogleDriveRoute
      ? "google-directory"
      : "directory"
    : isGoogleDrive && isGoogleDriveRoute
      ? "google-file"
      : "file";
  const iconType = item.isDirectory ? null : getFileType(item?.name || "");
  const itemId = item.id ?? item._id;
  const lastModified = formatDate(item.modifiedTime || item.updatedAt);
  const size = formatSize(item.size);

  return (
    <div
      className={`gd-list-row ${selected ? "selected" : ""}`}
      data-id={itemId}
      onClick={() => onRowClick(itemId)}
      onDoubleClick={() => onDoubleClick?.(type, itemId, item.isDeleted)}
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect?.(itemId);
        onContextMenu(e, itemId);
      }}
    >
      <div className="gd-list-row-name">
        {item.isDirectory ? (
          <IconFolder size={20} style={{ color: "#5f6368", flexShrink: 0 }} />
        ) : (
          <FileBadge type={iconType} />
        )}
        <span>{item.name}</span>
      </div>

      <div className="gd-list-row-cell md:text-[11px]">{owner}</div>
      <div className="gd-list-row-cell md:text-[11px]">{lastModified}</div>
      <div className="gd-list-row-cell md:text-[11px]">{size}</div>
      <div className="gd-list-row-cell md:text-[11px]">
        {" "}
        <button
          className="gd-icon-btn"
          style={{ width: 28, height: 28 }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(itemId);
            onContextMenu(e, itemId);
          }}
        >
          <IconDots size={16} />
        </button>
      </div>
    </div>
  );
}
