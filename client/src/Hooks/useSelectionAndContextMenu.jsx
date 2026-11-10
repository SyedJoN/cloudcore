import { useState, useCallback } from "react";

const CONTEXT_MENU_WIDTH = 300;

export function useSelectionAndContextMenu({
  combinedItems,
  mainRef,
  lastDirectory,
}) {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [contextItem, setContextItem] = useState(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [openLeft, setOpenLeft] = useState(false);
  const [dragBox, setDragBox] = useState(null);
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback((id) => setSelectedItems(new Set([id])), []);
  const clearSelection = useCallback(() => setSelectedItems(new Set()), []);

  const handleSelectAll = useCallback(() => {
    setSelectedItems(new Set(combinedItems.map((i) => i.id ?? i._id)));
  }, [combinedItems]);

const getId = (i) => String(i?.id ?? i?._id);
const toIdList = (v) =>
  (Array.isArray(v) ? v : [v]).filter((x) => x != null).map(String);

const handleContextMenu = useCallback(
  (e, idOrIds) => {
    e.stopPropagation();
    e.preventDefault();

    let ids = toIdList(idOrIds);

    // Right-clicking an item inside a multi-selection acts on the whole selection
    if (ids.length === 1 && selectedItems?.size > 1) {
      const selectedIds = [...selectedItems].map(String);
      if (selectedIds.includes(ids[0])) ids = selectedIds;
    }

    // Toggle off if clicking the same target (item or set of items) again
    const currentIds = (
      Array.isArray(contextItem) ? contextItem : contextItem ? [contextItem] : []
    ).map(getId);

    const sameTarget =
      ids.length === currentIds.length &&
      ids.every((id) => currentIds.includes(id));

    if (open && sameTarget) {
      setOpen(false);
      setContextItem(null);
      return;
    }

    // Menu positioning (unchanged)
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
    setOpen(true);
    setContextPos({ x, y: e.clientY });

    // Resolve each id with the original lookup rules, de-duplicating results
    // (several ids can resolve to the same lastDirectory).
    const resolved = [];
    const seen = new Set();

    for (const id of ids) {
      const parentMatch = combinedItems.find(
        (i) => String(i.parentDirId?.id ?? i.parentDirId?._id) === id,
      );
      const itemMatch = combinedItems.find((i) => getId(i) === id);
      const item = parentMatch ? lastDirectory : (itemMatch ?? lastDirectory);

      if (!item) continue;
      const key = getId(item);
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push(item);
    }

    // Single target keeps the old shape (an object); multiple becomes an array
    setContextItem(
      resolved.length > 1 ? resolved : (resolved[0] ?? lastDirectory),
    );
  },
  [open, contextItem, combinedItems, lastDirectory, selectedItems],
);

  const handleMainMouseDown = useCallback(
    (e) => {
      if (
        e.target.closest(
          ".gd-grid-item, .gd-list-row, .gd-mobile-list-row, .gd-mobile-selected-header, .gd-context-menu, .gd-modal-overlay, .gd-icon-btn, .sort-btn, .mv-screen, .mgi-card, .mlr-card, .mgi-selection-bar, .mlr-selection-bar",
        )
      ) {
        return;
      }

      clearSelection();
      setContextItem(null);

      const { clientX, clientY } = e;

      setDragBox({
        x1: clientX,
        y1: clientY,
        x2: clientX,
        y2: clientY,
      });
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
          } else {
            clearSelection();
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
    open,
    setOpen,
    handleMainMouseDown,
    handleMainMouseMove,
    handleMainMouseUp,
  };
}
