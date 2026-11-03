import { useEffect, useRef, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const CLOSE_DISTANCE = 120; // px dragged down before it dismisses
const CLOSE_VELOCITY = 0.6; // px/ms flick speed that dismisses

export function BottomSheet({ open, onClose, title, children, zIndex = 300 }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // drag state: null = not dragging, number = current offset in px
  const [dragY, setDragY] = useState(null);

  const sheetRef = useRef(null);
  const gesture = useRef({ startY: 0, lastY: 0, lastT: 0, velocity: 0 });
// mount / unmount timing
useEffect(() => {
  if (open) {
    setMounted(true);
    return;
  }

  setVisible(false);
  setDragY(null); // remove this line if your copy has no drag state
  const t = setTimeout(() => setMounted(false), 220);
  return () => clearTimeout(t);
}, [open]);

// slide in: runs after the sheet is in the DOM but before the browser paints
useLayoutEffect(() => {
  if (!open || !mounted || visible) return;

  // force a reflow so the hidden (translate-y-full) position is committed
  void sheetRef.current?.getBoundingClientRect();

  setVisible(true);
}, [open, mounted]);
  // lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ---------- drag handlers (pointer events cover touch + mouse) ---------- */

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      startY: e.clientY,
      lastY: e.clientY,
      lastT: performance.now(),
      velocity: 0,
    };
    setDragY(0);
  }

  function handlePointerMove(e) {
    if (dragY === null) return;
    const g = gesture.current;
    const now = performance.now();
    const dt = now - g.lastT;

    if (dt > 0) {
      g.velocity = (e.clientY - g.lastY) / dt; // px/ms, + = downward
    }
    g.lastY = e.clientY;
    g.lastT = now;

    // only allow dragging downward
    setDragY(Math.max(0, e.clientY - g.startY));
  }

  function handlePointerEnd() {
    if (dragY === null) return;

    const shouldClose =
      dragY > CLOSE_DISTANCE || gesture.current.velocity > CLOSE_VELOCITY;

    if (shouldClose) {
      // clearing the inline offset lets the CSS class animate it
      // from the dragged position down off screen
      setVisible(false);
      setDragY(null);
      onClose();
    } else {
      // snap back
      setDragY(null);
    }
  }

  if (!mounted) return null;

  const dragging = dragY !== null;
  const sheetHeight = sheetRef.current?.offsetHeight || 1;
  const backdropOpacity = dragging
    ? Math.max(0, 1 - dragY / sheetHeight)
    : undefined;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex }}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 ${
          dragging ? "" : "transition-opacity duration-200"
        } ${visible ? "opacity-100" : "opacity-0"}`}
        style={dragging ? { opacity: backdropOpacity } : undefined}
      />

      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 rounded-t-[28px] bg-(--surface-white) shadow-2xl ${
          dragging ? "" : "transition-transform duration-200 ease-out"
        } ${visible ? "translate-y-0" : "translate-y-full"}`}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          ...(dragging ? { transform: `translateY(${dragY}px)` } : null),
        }}
      >
        {/* drag zone: handle + title */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className="cursor-grab select-none active:cursor-grabbing"
          style={{ touchAction: "none" }} // stop the browser scrolling instead
        >
          <div className="flex justify-center pb-2 pt-3">
            <div className="h-1 w-8 rounded-full bg-[#c4c7c5]" />
          </div>
          {title && (
            <div className="truncate px-6 pb-2 pt-1 text-[16px] font-medium text-(--text-primary)">
              {title}
            </div>
          )}
        </div>

        <div className="pb-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function SheetItem({ icon, label, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-5 px-6 py-3.5 text-left text-[15px] text-(--text-primary) disabled:opacity-40 ${
        active ? "bg-[#d3e3fd] font-medium" : ""
      }`}
    >
      <span className="flex h-6 w-6 items-center justify-center text-(--border-inverse)">
        {icon}
      </span>
      {label}
    </button>
  );
}