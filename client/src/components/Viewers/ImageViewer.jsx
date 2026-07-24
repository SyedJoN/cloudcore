import { useState, useRef, useEffect } from "react";

function ImageViewer({ url, name }) {
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom((z) => Math.min(5, Math.max(0.1, z - e.deltaY * 0.001)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onMouseDown = (e) => {
    setDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onMouseMove = useCallback(
    (e) => {
      if (!drag) return;
      setOffset({ x: e.clientX - drag.x, y: e.clientY - drag.y });
    },
    [drag],
  );
  const onMouseUp = () => setDrag(null);

  return (
    <div
      ref={stageRef}
      className="fv-image-stage"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ cursor: drag ? "grabbing" : zoom > 1 ? "grab" : "default" }}
    >
      <img
        ref={imgRef}
        src={url}
        alt={name}
        className="fv-image"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transition: drag ? "none" : "transform 0.15s ease",
        }}
        draggable={false}
      />
      <div className="fv-zoom-controls">
        <button
          className="fv-zoom-btn"
          onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
        >
          +
        </button>
        <span className="fv-zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          className="fv-zoom-btn"
          onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
        >
          −
        </button>
        <button
          className="fv-zoom-btn"
          onClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
          title="Reset"
        >
          ⊙
        </button>
      </div>
    </div>
  );
}

export default ImageViewer;