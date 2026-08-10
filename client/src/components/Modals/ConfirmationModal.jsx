import { useEffect, useRef } from "react";

function ConfirmationModal({
  onAction_1,
  onAction_2,
  title,
  action_1,
  action_2,
  isFetching,
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
        <h2>{title}</h2>

        <div className="gd-modal-actions">
          <button
            type="button"
            className="gd-btn gd-btn-text"
            disabled={isFetching}
            onClick={onAction_1}
          >
            {isFetching && isFetching ? "Saving..." : action_1}
          </button>
          <button
            type="submit"
            className="gd-btn gd-btn-primary"
            disabled={isFetching}
            onClick={onAction_2}
          >
            {action_2}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;
