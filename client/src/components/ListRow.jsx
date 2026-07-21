import { IconFolder, IconDots } from "./Icons";
import FileBadge from "./FileBadge";
import { getFileType } from "./utils";
import { formatDate } from "../../utils/formatDate";
import { formatSize } from "../../utils/formatHelpers";

export default function ListRow({ item, owner, avatar, dirId, onRowClick, onDoubleClick, selected, onSelect, onContextMenu }) {
  const isGDrive = dirId === "google-drive";
  const type = item.isDirectory
    ? (isGDrive ? "google-directory" : "directory")
    : (isGDrive ? "google-file" : "file");
  const iconType   = item.isDirectory ? null : getFileType(item.name);
  const itemId     = item.id ?? item._id;
  const lastModified = formatDate(item.modifiedTime || item.updatedAt);
  const size = formatSize(item.size);


  return (
    <div
      className={`gd-list-row${selected ? " selected" : ""}`}
      onClick={() => onRowClick(type, itemId)}
      onDoubleClick={() => onDoubleClick?.(type, itemId)}
      onContextMenu={(e) => { e.preventDefault(); onSelect?.(itemId); onContextMenu(e, itemId); }}
    >
      <div className="gd-list-row-name">
        {item.isDirectory
          ? <IconFolder size={20} style={{ color: "#5f6368", flexShrink: 0 }} />
          : <FileBadge type={iconType} />}
        <span>{item.name}</span>
      </div>

      <div className="gd-list-row-cell">{owner}</div>
      <div className="gd-list-row-cell">{lastModified}</div>
      <div className="gd-list-row-cell">{size}</div>
      <div className="gd-list-row-cell">   <button className="gd-icon-btn" style={{ width: 28, height: 28 }}
          onClick={e => { e.stopPropagation(); onSelect?.(itemId); onContextMenu(e, itemId); }}>
          <IconDots size={16} />
        </button></div>
      
    </div>
  );
}