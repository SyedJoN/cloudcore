import { createPortal } from "react-dom";
import { useRef, useState, useEffect } from "react";

// Inject keyframes once, globally
const injectTooltipAnimation = () => {
  if (document.getElementById("gd-tooltip-keyframes")) return;
  const style = document.createElement("style");
  style.id = "gd-tooltip-keyframes";
  style.textContent = `
    @keyframes gdTooltipGrow {
      from {
        opacity: 0;
        transform: translateX(-50%) scale(0.85);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) scale(1);
      }
    }
  `;
  document.head.appendChild(style);
};

const MouseTooltip = ({ children, message, disabled = false }) => {
  const triggerRef = useRef(null);
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    injectTooltipAnimation();
  }, []);

  const handleMouseEnter = () => {
    if (!disabled || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      left: rect.left + rect.width / 2,
      top: rect.bottom + 8,
    });

    // slight delay like Google Drive's tooltip (feels less jumpy)
    timeoutRef.current = setTimeout(() => setShow(true), 300);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setShow(false);
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: "inline-flex" }}
      >
        {children}
      </span>

      {show &&
        position &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: position.left,
              top: position.top,
              transformOrigin: "top center",
              transform: "translateX(-50%)",

              maxWidth: "260px",
              padding: "8px 12px",

              background: "var(--text-primary)",
              color: "var(--surface-white)",
              borderRadius: "4px",

              fontSize: "13px",
              lineHeight: "18px",

              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              display: "-webkit-box",
              whiteSpace: "normal",
              overflowWrap: "break-word",
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: 999999,

              animation: "gdTooltipGrow 120ms ease-out",
            }}
          >
            {message}
          </div>,
          document.body,
        )}
    </>
  );
};

export default MouseTooltip;
