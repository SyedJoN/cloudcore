import { useEffect, useRef } from "react";

function CreateDirectoryModal({
  newDirname,
  setNewDirname,
  onClose,
  onCreateDirectory,
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
  t;
  const handleOverlayClick = () => {
    onClose();
  };

  return (
    <div className="gd-modal-overlay" onClick={handleOverlayClick}>
      <div className="gd-modal" onClick={handleContentClick}>
        <h2>New folder</h2>
        <form onSubmit={onCreateDirectory}>
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder="Enter folder name"
            value={newDirname}
            onChange={(e) => setNewDirname(e.target.value)}
          />
          <div className="gd-modal-actions">
            <button
              type="button"
              className="gd-btn gd-btn-text"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="gd-btn gd-btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateDirectoryModal;
