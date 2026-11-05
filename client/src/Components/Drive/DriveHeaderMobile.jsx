import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bars3Icon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import { formatSize } from "../../../Utils/formatHelpers";
import { useAuth, useGDrive } from "../../Contexts";
import { NAV_ITEMS } from "./DriveSidebar";
import UserAccountDrawerMobile from "../UserAccountDrawerBar";
import { UseAvatar } from "../../Hooks/useAvatar";
import { Divider } from "../Divider";

/* ------------------------------------------------------------------ */
/* Slide-in drawer (sidebar without the "New" button)                  */
/* ------------------------------------------------------------------ */
function MobileDrawer({ open, onClose, dirId, dirContext }) {
  const { isGoogleDrive } = useGDrive();
  const { user } = useAuth();
  const navigate = useNavigate();

  const usagePercent = Math.max(
    0,
    Math.min((user.totalUsage / Number(user.totalStorage)) * 100, 100),
  );

  // Close on Escape + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Scrim */}
      <div
        className={`gd-drawer-scrim ${open ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`gd-sidebar gd-drawer ${open ? "open" : ""}`}
        aria-hidden={!open}
        aria-label="Navigation"
      >
        <h2 className="gd-title pl-6 py-2">
            Cloud Core
            </h2>
            <Divider fullWidth={true}/>
        <nav className="gd-nav-section">
            
          {NAV_ITEMS.map(({ key, label, path, Icon, IconSolid, isActive }) => {
            if (!isGoogleDrive && key === "google-drive") return null;
            const active = isActive({ dirContext, dirId });
            const DisplayIcon = active ? IconSolid : Icon;
            return (
              <button
                key={key}
                className={`gd-nav-item ${active ? "active" : ""}`}
                onClick={() => {
                  navigate(path);
                  onClose();
                }}
              >
                <DisplayIcon className="w-5 h-5" size={20} /> {label}
              </button>
            );
          })}
        </nav>

        <div className="gd-storage-section">
          <div className="gd-storage-bar-bg">
            <div
              style={{ width: `${usagePercent}%` }}
              className="gd-storage-bar-fill"
            />
          </div>
          <div className="gd-storage-text">
            {user.totalUsage === 0 ? "0 B " : formatSize(user.totalUsage)} of{" "}
            {formatSize(user.totalStorage)} used
          </div>
          {user.plan !== "business" && (
            <button
              onClick={() => {
                navigate("/#pricing");
                onClose();
              }}
              className="gd-storage-btn"
            >
              Get more storage
            </button>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
export default function DriveHeaderMobile({
  dirId,
  dirContext,
  searchPlaceholder = "Search in Drive",
  onSearch
}) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) onSearch?.(q);
  };

  return (
    <>
      <header className="gd-mheader" onMouseDown={(e) => e.stopPropagation()}>
        <div className="gd-mheader-container">
          <button
            type="button"
            className="gd-icon-btn"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <div className="gd-msearch">
            <form
              className="gd-msearch-form"
              onSubmit={handleSubmit}
              role="search"
            >
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search"
                enterKeyHint="search"
              />
            </form>
          </div>
          <button
            type="button"
            className="gd-mavatar"
            aria-label="Account"
            onClick={() => setAccountOpen(true)}
          >
            <UseAvatar name={user.name} avatar={user.avatar} size={32} />
          </button>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dirId={dirId}
        dirContext={dirContext}
      />
      <UserAccountDrawerMobile
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </>
  );
}
