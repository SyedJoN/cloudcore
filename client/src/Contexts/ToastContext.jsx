import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ message, type = "info", duration = 3000 }) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

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
  return useContext(ToastContext);
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div style={styles.container}>
      {toasts.map((t) => (
        <div key={t.id} style={{ ...styles.toast, ...styles[t.type] }}>
          <span>{t.message}</span>
          <button style={styles.close} onClick={() => onRemove(t.id)}>
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
    left: 24, // ✅
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 9999,
    alignItems: "flex-start",
  },
  toast: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    minWidth: 280,
    maxWidth: 480,
    animation: "slideUp 0.2s ease",
  },
  info: { background: "#202124", color: "#fff" },
  success: { background: "#1e8e3e", color: "#fff" },
  error: { background: "#d93025", color: "#fff" },
  warning: { background: "#f29900", color: "#fff" },
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
};
