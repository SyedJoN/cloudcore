import { useRef, useState, useCallback } from "react";
import { hasDriveDrag, readDriveDrag } from "../../Utils/dragDrop";

export function useDropZone(onDropIds, { enabled = true } = {}) {
  const [isOver, setIsOver] = useState(false);
  const depth = useRef(0); // prevents dragleave flicker from child elements

  const reset = useCallback(() => {
    depth.current = 0;
    setIsOver(false);
  }, []);

  const onDragEnter = useCallback(
    (e) => {
      if (!enabled || !hasDriveDrag(e)) return;
      e.preventDefault();
      depth.current += 1;
      setIsOver(true);
    },
    [enabled],
  );

  const onDragOver = useCallback(
    (e) => {
      if (!enabled || !hasDriveDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    [enabled],
  );

  const onDragLeave = useCallback(
    (e) => {
      if (!enabled || !hasDriveDrag(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setIsOver(false);
    },
    [enabled],
  );

  const onDrop = useCallback(
    (e) => {
      if (!enabled || !hasDriveDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      reset();
      const ids = readDriveDrag(e);
      if (ids.length) onDropIds?.(ids);
    },
    [enabled, onDropIds, reset],
  );

  return {
    isOver: enabled && isOver,
    dropProps: enabled ? { onDragEnter, onDragOver, onDragLeave, onDrop } : {},
  };
}
export const useTrashDropZone = (onDropIds) => useDropZone(onDropIds);