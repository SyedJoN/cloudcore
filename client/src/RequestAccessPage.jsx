import { useState } from "react";
import { axiosWithCreds } from "../apis/axiosInstances";

function RequestAccessPage({ user, dirId }) {
  const [role, setRole] = useState("viewer");
  const [message, setMessage] = useState("");
  const [requested, setRequested] = useState(false);

  async function handleRequestAccess() {
    try {
      await axiosWithCreds.post(`/directory/${dirId}/request-access`, {
        role,
        message,
      });
      setRequested(true);
    } catch (error) {
      console.log("Error while requesting Access", error);
    }
  }

  if (requested) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 12,
          fontFamily: "sans-serif",
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 400, color: "#202124" }}>
          Access requested
        </h2>
        <p style={{ color: "#5f6368" }}>
          The owner will be notified of your request.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ maxWidth: 400, width: "100%", padding: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, marginBottom: 8 }}>
          You need access
        </h1>
        <p style={{ color: "#5f6368", marginBottom: 24 }}>
          Request access, or switch to an account with access.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {["viewer", "editor"].map((r) => (
            <label
              key={r}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                fontSize: 15,
              }}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
              />
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </label>
          ))}
        </div>

        <textarea
          placeholder="Message (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 6,
            border: "1px solid #dadce0",
            fontSize: 14,
            resize: "none",
            marginBottom: 20,
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={handleRequestAccess}
          style={{
            background: "#1a73e8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            marginBottom: 32,
          }}
        >
          Request access
        </button>

        {user?.email && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 8 }}>
              You're signed in as
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid #dadce0",
                borderRadius: 20,
                padding: "6px 14px",
              }}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  style={{ width: 24, height: 24, borderRadius: "50%" }}
                  alt={user.name}
                />
              ) : (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#1a73e8",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  {user.name?.charAt(0)}
                </div>
              )}
              <span style={{ fontSize: 14 }}>{user.email}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RequestAccessPage;
