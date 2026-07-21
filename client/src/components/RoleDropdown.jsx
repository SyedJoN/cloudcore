import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconCheck } from "./Icons";
import { ROLE_LABEL, ROLE_DESC } from "./utils";

const ROLES = ["viewer", "editor"];

/**
 * Renders via a portal into document.body so it always floats above
 * modals regardless of stacking context. The anchor ref is used to
 * calculate the dropdown's screen position.
 */
export default function RoleDropdown({
  anchorRef,        // ref of the trigger button
  current,
  onChange,
  onClose,
  showRemove = false,
}) {
  const dropdownRef = useRef(null);

  // Calculate position from the anchor button's bounding rect
  const rect = anchorRef?.current?.getBoundingClientRect() || { bottom: 0, right: 0, left: 0 };
  const viewportWidth = window.innerWidth;
  // Prefer aligning to right edge of anchor; flip left if it would overflow
  const dropdownWidth = 180;
  let left = rect.right - dropdownWidth;
  if (left < 8) left = rect.left;

  // Close on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <>
      {/* Full-screen backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onClose}
      />
      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="gd-role-dropdown"
        style={{
          position: "fixed",
          top: rect.bottom + 4,
          left,
          zIndex: 9999,
          minWidth: dropdownWidth,
        }}
        onClick={e => e.stopPropagation()}
      >
        {ROLES.map(r => (
          <button key={r} className="gd-role-option" onClick={() => onChange(r)}>
            <span className="gd-role-option-label">
              <span>{ROLE_LABEL[r]}</span>
              <span className="role-desc">{ROLE_DESC[r]}</span>
            </span>
            {current === r && (
              <IconCheck size={16} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
            )}
          </button>
        ))}
        {showRemove && (
          <>
            <div className="gd-context-divider" />
            <button
              className="gd-role-option"
              style={{ color: "#d93025" }}
              onClick={() => onChange("remove")}
            >
              Remove access
            </button>
          </>
        )}
      </div>
    </>,
    document.body
  );
}