import { useRef, useState, useCallback } from "react";
import { hasDriveDrag, readDriveDrag } from "../../Utils/dragDrop";

export function useTrashDropZone(onDropIds) {
  const [isOver, setIsOver] = useState(false);
  const depth = useRef(0); // child elements ki wajah se dragleave flicker na ho

  const reset = () => {
    depth.current = 0;
    setIsOver(false);
  };

  const dropProps = {
    onDragEnter: useCallback((e) => {
      if (!hasDriveDrag(e)) return;
      e.preventDefault();
      depth.current += 1;
      setIsOver(true);
    }, []),
    onDragOver: useCallback((e) => {
      if (!hasDriveDrag(e)) return;
      e.preventDefault(); // drop allow karne ke liye zaroori
      e.dataTransfer.dropEffect = "move";
    }, []),
    onDragLeave: useCallback((e) => {
      if (!hasDriveDrag(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setIsOver(false);
    }, []),
    onDrop: useCallback(
      (e) => {
        if (!hasDriveDrag(e)) return;
        e.preventDefault();
        reset();
        const ids = readDriveDrag(e);
        if (ids.length) onDropIds(ids);
      },
      [onDropIds],
    ),
  };

  return { isOver, dropProps };
}