import { GridItem, ListRow } from "../Drive";

/**
 * Renders a section (folders or files) in either grid or list mode.
 * Replaces the four near-duplicate blocks in the original component.
 */
export default function DirectoryItemCollection({
  items,
  label,
  viewMode,
  dirId,
  selectedItems,
  onSelect,
  onRowClick,
  onDoubleClick,
  onContextMenu,
  listHeaderRow,
  showListHeader = true,
  sectionStyle,
}) {
  if (!items.length) return null;

  const ItemComponent = viewMode === "grid" ? GridItem : ListRow;

  return (
    <>
      {viewMode === "grid" && (
        <div className="gd-section-label" style={sectionStyle}>
          {label}
        </div>
      )}
      {viewMode === "list" && showListHeader && listHeaderRow}

      <div className={viewMode === "grid" ? "gd-grid" : "gd-list"}>
        {items.map((item) => (
          <ItemComponent
            key={item._id}
            item={item}
            dirId={dirId}
            avatar={item.userId?.avatar}
            owner={item.userId?.name}
            selected={selectedItems.has(item.id ?? item._id)}
            onSelect={onSelect}
            selectionActive={selectedItems.size > 0}
            onRowClick={onRowClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    </>
  );
}