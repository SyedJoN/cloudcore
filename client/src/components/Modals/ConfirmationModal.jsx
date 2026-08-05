import { useEffect, useRef } from "react";

function ConfirmationModal({
  onClose,
  onDiscard
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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
        <h2>Discard unsaved changes?</h2>
        
          <div className="gd-modal-actions">
            <button
              type="button"
              className="gd-btn gd-btn-text"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="gd-btn gd-btn-primary" onClick={onDiscard}>
              Discard
            </button>
          </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;
