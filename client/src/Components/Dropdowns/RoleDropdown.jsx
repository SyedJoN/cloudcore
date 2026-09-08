import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import { ROLE_LABEL, DRIVE_ROLES } from "../../../utils/displayUtils";

import { CheckIcon } from "@heroicons/react/24/solid";
import MouseTooltip from "../Tooltip/Tooltip";
import { Portal, useTransitionClass } from "../../Hooks/useFloatingMenu";

const ROLES = ["viewer", "editor"];

function RoleDropdownContent({
  open,
  anchorRef,
  current,
  isOwnerPending,
  onChange,
  onTransfer,
  onCancel,
  onClose,
  isOwner = false,
  showRemove = false,
  isChanged = false,
}) {
  const [rect, setRect] = useState(null);
  const menuRef = useRef(null);
  const close =
    (action) =>
    (...args) => {
      action?.(...args);
      onClose();
    };
    
  useLayoutEffect(() => {
    if (!open) return;

    const btn = anchorRef.current;
    if (!btn) return;

    const r = btn.getBoundingClientRect();
    const width = r.width + 150;

    setRect({
      left: r.right - (r.width + 150),
      top: r.bottom,
      width,
    });
  }, [open, anchorRef]);


  useEffect(() => {
    function handleClick(e) {
       if (
        
        anchorRef.current?.contains(e.target) || e.target.closest(".gd-share-person-role-btn") || e.target.closest('.gd-share-role-btn') || e.target.closest('.gd-role-option')
      ) {
        return;
      }
      onClose();
    }

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);
  if (!rect || !open) return null;

  return (
    <div
      ref={menuRef}
      className={`gd-role-dropdown origin-top-right animate-[sortDropdown_80ms_ease-out]`}
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.top + 4,
        width: rect.width,
        zIndex: 501,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {ROLES.map((r) => {
        const isSelected = String(current ?? "").toLowerCase() === r;

        return (
          <button
            key={r}
            type="button"
            className="gd-role-option"
            onClick={close(() => onChange?.(r))}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              position: "relative",
            }}
          >
            <span className="absolute left-3 top-3.1">
              {isSelected && (
                <CheckIcon className="w-5 h-5 min-w-5 text-(--accent-blue)" />
              )}
            </span>

            <span className="gd-role-option-label">
              <span>{ROLE_LABEL[r] || r}</span>
            </span>
          </button>
        );
      })}
      {isOwner || (showRemove && <div className="gd-context-divider" />)}

      {isOwner && (
        <>
          <MouseTooltip
            disabled={isChanged}
            message="Disabled because other changes are pending"
          >
            <button
              disabled={isChanged}
              type="button"
              className="gd-role-option remove"
              onClick={close(() =>
                isOwnerPending ? onCancel?.() : onTransfer?.(),
              )}
            >
              {isOwnerPending
                ? "Cancel ownership transfer"
                : "Transfer ownership"}
            </button>
          </MouseTooltip>
        </>
      )}

      {showRemove && (
        <button
          type="button"
          className="gd-role-option remove"
          style={{ color: "#d93025" }}
          onClick={close(() => onChange?.("remove"))}
        >
          Remove access
        </button>
      )}
    </div>
  );
}

export default function RoleDropdown({ open, anchorRef, ...rest }) {
  return (
    <Portal>
      <RoleDropdownContent open={open} anchorRef={anchorRef} {...rest} />
    </Portal>
  );
}
