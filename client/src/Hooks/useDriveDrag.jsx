import { useCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setDriveDragData } from "../../Utils/dragDrop";
import { getFileType } from "../../Utils/displayUtils";
import { IconFolder } from "../Components/Icons/Icons"; // apna sahi path
import FileBadge from "../Components/File/FileBadge"; // apna sahi path

export function useDriveDrag({ item, itemId, selectedItems, onSelect, enabled = true }) {
  const onDragStart = useCallback(
    (e) => {
      if (!enabled) {
        e.preventDefault();
        return;
      }

      const inSelection = selectedItems.has(itemId);

      const ids =
        inSelection && selectedItems.size > 1
          ? [...selectedItems].map(String)
          : [String(itemId)];

      if (!inSelection) onSelect?.(itemId);

      const iconHtml = renderToStaticMarkup(
        item.isDirectory ? (
          <IconFolder size={18} style={{ color: "#5f6368" }} />
        ) : (
          <FileBadge size={18} type={getFileType(item?.name || "")} />
        ),
      );

      setDriveDragData(e, ids, item.name, iconHtml);
    },
    [enabled, selectedItems, itemId, onSelect, item],
  );

  return { dragProps: { draggable: enabled, onDragStart } };
}