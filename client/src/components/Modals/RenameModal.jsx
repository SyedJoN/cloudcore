import { useEffect, useRef } from "react";

function RenameModal({
  renameValue,
  setRenameValue,
  isRenameLoading,
  onClose,
  onRenameSubmit,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();

      const dotIndex = renameValue.lastIndexOf(".");
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  const handleOverlayClick = () => {
    onClose();
  };

  return (
    <div className="gd-modal-overlay" onClick={handleOverlayClick}>
      <div className="gd-modal" onClick={handleContentClick}>
        <h2>Rename</h2>
        <form onSubmit={onRenameSubmit}>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          <div className="gd-modal-actions">
            <button
              type="button"
              className={`gd-btn gd-btn-text ${isRenameLoading ? "disabled" : ""}`}
              onClick={onClose}
              disabled={isRenameLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`gd-btn gd-btn-primary ${isRenameLoading ? "disabled" : ""}`}
              disabled={isRenameLoading}
            >
              {isRenameLoading ? "Renaming..." : "Rename"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RenameModal;
