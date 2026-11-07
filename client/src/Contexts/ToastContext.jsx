import { createContext, useContext, useState, useCallback } from "react";
import { useDevice } from "./DeviceContext";


const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(
    ({ message, type = "info", undoAction = null, duration = 5000 }) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts(() => [{ id, message, type, undoAction }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

function ToastContainer({ toasts, onRemove }) {
  const { device } = useDevice();
  const isMobile = device === "mobile";

  if (!toasts.length) return null;

  return (
    <div
      style={{
        ...styles.container,
        ...(isMobile ? styles.containerMobile : null),
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            ...styles.toast,
            ...(isMobile ? styles.toastMobile : null),
          }}
        >
          <span style={styles.message}>{t.message}</span>

          {typeof t.undoAction?.onUndo === "function" && (
            <button
              type="button"
              style={styles.undo}
              onClick={async () => {
                try {
                  await t.undoAction.onUndo();
                  onRemove(t.id);
                } catch (error) {
                  console.error("Undo failed:", error);
                }
              }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            style={styles.close}
            onClick={() => onRemove(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    bottom: 24,
    left: 24,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 9999,
    alignItems: "flex-start",
    pointerEvents: "none", // container never blocks the page
  },
  // mobile: spans the full screen width, pinned to the bottom edge
  containerMobile: {
    left: 0,
    right: 0,
    bottom: 0,
    gap: 0,
    alignItems: "stretch",
  },
  // one look for every type: dark background, white text
  toast: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    background: "#202124",
    color: "#fff",
    pointerEvents: "auto",
    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    minWidth: 280,
    maxWidth: 480,
    animation: "slideUp 0.2s ease",
  },
  toastMobile: {
    width: "100%",
    minWidth: 0,
    maxWidth: "none",
    background: "var(--toast-bg-mobile)",
    color: "var(--toast-text-mobile)",
    boxSizing: "border-box",
    borderRadius: 0,
    padding: "16px 16px",
    paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
  },
  message: { flex: 1, minWidth: 0 },
  close: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    opacity: 0.7,
    fontSize: 14,
    padding: 0,
  },
  undo: {
    background: "none",
    border: "none",
    color: "#8ab4f8",
    cursor: "pointer",
    fontWeight: 600,
  },
};