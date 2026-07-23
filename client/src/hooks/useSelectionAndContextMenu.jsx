import { useState, useCallback } from "react";

const CONTEXT_MENU_WIDTH = 180;

/**
 * Owns selection state, the drag-to-select marquee box, and context-menu
 * positioning/open logic.
 */
export function useSelectionAndContextMenu({ combinedItems, mainRef }) {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [contextItem, setContextItem] = useState(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [openLeft, setOpenLeft] = useState(false);
  const [dragBox, setDragBox] = useState(null);

  const handleSelect = useCallback((id) => setSelectedItems(new Set([id])), []);
  const clearSelection = useCallback(() => setSelectedItems(new Set()), []);

  const handleSelectAll = useCallback(() => {
    setSelectedItems(new Set(combinedItems.map((i) => i.id ?? i._id)));
  }, [combinedItems]);

  const handleContextMenu = useCallback(
    (e, id) => {
      e.stopPropagation();
      e.preventDefault();

      const spaceLeft = e.clientX;
      const spaceRight = window.innerWidth - e.clientX;

      let left = false;
      let x = e.clientX;

      if (spaceRight >= CONTEXT_MENU_WIDTH) {
        left = false;
        x = e.clientX;
      } else if (spaceLeft >= CONTEXT_MENU_WIDTH) {
        left = true;
        x = e.clientX - CONTEXT_MENU_WIDTH;
      } else {
        left = spaceLeft > spaceRight;
        x = left ? 0 : e.clientX;
      }

      setOpenLeft(left);
      setContextPos({ x, y: e.clientY });

      const item = combinedItems.find((i) => (i.id ?? i._id) === id);
      setContextItem(item || null);
    },
    [combinedItems],
  );

  const handleMainMouseDown = useCallback(
    (e) => {
      if (e.target.closest(".gd-grid-item, .gd-list-row, .gd-context-menu")) return;
      clearSelection();
      setContextItem(null);
      const { clientX, clientY } = e;
      setDragBox({ x1: clientX, y1: clientY, x2: clientX, y2: clientY });
    },
    [clearSelection],
  );

  const handleMainMouseMove = useCallback(
    (e) => {
      setDragBox((prevBox) => {
        if (!prevBox) return prevBox;

        const newBox = { ...prevBox, x2: e.clientX, y2: e.clientY };
        const selBox = {
          left: Math.min(newBox.x1, newBox.x2),
          top: Math.min(newBox.y1, newBox.y2),
          right: Math.max(newBox.x1, newBox.x2),
          bottom: Math.max(newBox.y1, newBox.y2),
        };

        const els = mainRef.current?.querySelectorAll("[data-id]") ?? [];
        const newSelected = new Set();
        els.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (
            r.left < selBox.right &&
            r.right > selBox.left &&
            r.top < selBox.bottom &&
            r.bottom > selBox.top
          ) {
            newSelected.add(el.dataset.id);
          }
        });
        if (newSelected.size > 0) setSelectedItems(newSelected);

        return newBox;
      });
    },
    [mainRef],
  );

  const handleMainMouseUp = useCallback(() => setDragBox(null), []);

  return {
    selectedItems,
    setSelectedItems,
    contextItem,
    setContextItem,
    contextPos,
    openLeft,
    dragBox,
    handleSelect,
    clearSelection,
    handleSelectAll,
    handleContextMenu,
    handleMainMouseDown,
    handleMainMouseMove,
    handleMainMouseUp,
  };
}