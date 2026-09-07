import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconFolder } from "../Icons/Icons";
import { getFileType } from "../../../utils/displayUtils";
import FileBadge from "../File/FileBadge";

function CascadeConfirmationModal({
  onCancel,
  onConfirm,
  chain, // [{ id, name, fromLabel, toLabel }, ...] root-first
  isFetching,
}) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleContentClick = (e) => e.stopPropagation();

  const leaf = chain[chain.length - 1];
  

  return createPortal(
    <div className="gd-modal-overlay" onClick={onCancel}>
      <div className="gd-cascade-modal" onClick={handleContentClick}>
        <h1 className="gd-cascade-title">
          {leaf.toLabel === "Restricted"
            ? "Remove access from parent folder?"
            : "Update access on parent folder?"}
        </h1>

        <p className="gd-cascade-desc">
          {leaf.toLabel === "Restricted" ? (
            <>
              Removing this item's link will also remove its parent folder's
              link. Alternatively, apply limited access to this folder.
            </>
          ) : (
            <>
              Changing this item's access will also reduce its parent
              folder's access.{" "}
            </>
          )}
        </p>

        <div className="gd-cascade-chain">
          {chain.map((node, i) => (
            <div
              key={node.id}
              className="gd-cascade-node"
              style={{ marginLeft: i * 24 }}
            >
              {i > 0 && <span className="gd-cascade-branch" />}
              <span className="gd-cascade-icon">
             {node.isDirectory ? (
                      <IconFolder size={24} style={{ color: "#5f6368", flexShrink: 0 }} />
                    ) : (
                      <FileBadge type={node.iconType} />
                    )}
              </span>
              <div className="gd-cascade-node-text">
                <span className="gd-cascade-name">{node.name}</span>
                <span className="gd-cascade-roles">
                  <span className="gd-cascade-from">{node.fromLabel}</span>
                  <i
                    className="ti ti-arrow-right gd-cascade-arrow"
                    aria-hidden="true"
                  />
                  <span className="gd-cascade-to">{node.toLabel}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="gd-modal-actions">
          <button
            type="button"
            className="gd-btn gd-btn-text"
            onClick={onCancel}
            ref={closeButtonRef}
          >
            Cancel
          </button>
          <button
            type="button"
            className="gd-btn gd-btn-primary"
            onClick={onConfirm}
          >
            {leaf.toLabel === "Restricted"
                ? "Remove from parent"
                : "Update Parent"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CascadeConfirmationModal;