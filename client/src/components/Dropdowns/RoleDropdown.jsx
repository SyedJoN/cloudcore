import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";

import { ROLE_LABEL, DRIVE_ROLES } from "../../../Utils/displayUtils";

import { CheckIcon } from "@heroicons/react/24/solid";
import MouseTooltip from "../Tooltip/Tooltip";
import { Portal, useTransitionClass } from "../../hooks/useFloatingMenu";

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
  const { animate, nodeRef, onTransitionEnd } = useTransitionClass(open);

  const [position, setPosition] = useState(null);

  const dropdownWidth = 220;

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current;

    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();

    let left = rect.right - dropdownWidth;

    // Don't go outside left side
    if (left < 8) {
      left = 8;
    }

    // Don't go outside right side
    if (left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8;
    }

    setPosition({
      top: rect.bottom + 4,
      left,
    });
  }, [anchorRef]);

  /*
   * Calculate position before paint.
   */
  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();
  }, [open, updatePosition]);

  /*
   * Keep dropdown positioned while scrolling/resizing.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, updatePosition]);

  // Escape closes dropdown.
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div
      ref={nodeRef}
      className={`gd-role-dropdown ${animate ? "open" : ""}`}
      onTransitionEnd={onTransitionEnd}
      style={{
        position: "fixed",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        zIndex: 9999,
        width: dropdownWidth,
        visibility: position ? "visible" : "hidden",
        pointerEvents: animate ? "auto" : "none",
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
            onClick={() => onChange?.(r)}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              position: "relative",
            }}
          >
            <span className="absolute left-3 top-2.75">
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

      {isOwner && (
        <>
          <div className="gd-context-divider" />

          <MouseTooltip
            disabled={isChanged}
            message="Disabled because other changes are pending"
          >
            <button
              disabled={isChanged}
              type="button"
              className="gd-role-option remove"
              onClick={() => (isOwnerPending ? onCancel?.() : onTransfer?.())}
            >
              {isOwnerPending ? "Cancel ownership transfer" : "Transfer ownership"}
            </button>
          </MouseTooltip>
        </>
      )}

      {showRemove && (
        <button
          type="button"
          className="gd-role-option remove"
          style={{ color: "#d93025" }}
          onClick={() => onChange?.("remove")}
        >
          Remove access
        </button>
      )}
    </div>
  );
}

export default function RoleDropdown({ open, anchorRef, containerRef, ...rest }) {
  return (
    <Portal>
      <RoleDropdownContent open={open} anchorRef={anchorRef} {...rest} />
    </Portal>
  );
}