import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconCheck } from "../Icons/Icons";
import { ROLE_LABEL, ROLE_DESC } from "../../../Utils/displayUtils";

const ROLES = ["viewer", "editor"];

export default function RoleDropdown({
  anchorRef,    
  current,
  onChange,
  onClose,
  showRemove = false,
}) {
  const dropdownRef = useRef(null);

  const rect = anchorRef?.current?.getBoundingClientRect() || { bottom: 0, right: 0, left: 0 };
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
              <span>{ROLE_LABEL[r] || r}</span>
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