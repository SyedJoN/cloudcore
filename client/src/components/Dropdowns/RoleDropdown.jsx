import {
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  ROLE_LABEL,
  ROLE_DESC,
  DRIVE_ROLES,
} from "../../../Utils/displayUtils";
import { CheckIcon } from "@heroicons/react/24/solid";

const ROLES = ["viewer", "editor"];

export default function RoleDropdown({
  anchorRef,
  current,
  isOwnerPending,
  onChange,
  onTransfer,
  onCancel,
  onClose,
  isOwner = false,
  showRemove = false,
}) {
  const dropdownRef = useRef(null);

  const [position, setPosition] = useState(null);

  const dropdownWidth = 180;

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    let left = rect.right - dropdownWidth;
    if (left < 8) {
      left = rect.right;
    }
    if (left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8;
    }
    setPosition({ top: rect.bottom + 4, left });
  }, [anchorRef]);

  useLayoutEffect(() => {
    updatePosition();

    const handleResize = () => {
      updatePosition();
    };

    const handleScroll = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <>
      <div
        ref={dropdownRef}
        className="gd-role-dropdown"
        style={{
          position: "fixed",
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          zIndex: 9999,
          minWidth: dropdownWidth,
          visibility: position ? "visible" : "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {ROLES.map((r) => {
          const isSelected = String(current).toLowerCase() === r;

          return (
            <button
              key={r}
              type="button"
              className="gd-role-option"
              onClick={() => onChange(r)}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
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

        {showRemove && (
          <>
            <div className="gd-context-divider" />

            <button
              type="button"
              className="gd-role-option remove"
              style={{
                color: "#d93025",
              }}
              onClick={() => onChange("remove")}
            >
              Remove access
            </button>
          </>
        )}
        {isOwner && (
          <button
            type="button"
            className="gd-role-option remove"
            onClick={() => (isOwnerPending ? onCancel() : onTransfer())}
          >
            {isOwnerPending ? "Cancel ownership" : "Transfer ownership"}
          </button>
        )}
      </div>
    </>
  );
}
