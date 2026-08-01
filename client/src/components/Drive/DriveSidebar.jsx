import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  InboxStackIcon,
  ShareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  InboxStackIcon as InboxStackIconSolid,
  ShareIcon as ShareIconSolid,
  TrashIcon as TrashIconSolid,
} from "@heroicons/react/24/solid";

import {
  IconDrive,
  IconStarred,
  IconNewFolder,
  IconUpload,
} from "../Icons/Icons";
import { formatSize } from "../../../Utils/formatHelpers";
import { History } from "lucide-react";
import { useAuth, useGDrive } from "../../Contexts";
import GoogleDriveSVG from "../Icons/GoogleDriveSVG";
import GoogleDriveBrowser from "./GoogleDriveBrowser";
import CircularLoader from "../Loaders/CircularLoader";

function NewMenu({
  anchorRef,
  onClose,
  onCreateFolder,
  onUploadFromDrive,
  onUploadFiles,
  disabled,
}) {
  const [rect, setRect] = useState(null);
  const menuRef = useRef(null);
  const close =
    (action) =>
    (...args) => {
      action?.(...args);
      onClose();
    };
  useEffect(() => {
    const btn = anchorRef.current;
    if (!btn) return;

    const r = btn.getBoundingClientRect();

    setRect({
      left: r.left,
      top: r.bottom,
      width: r.width,
    });
  }, [anchorRef]);

  useEffect(() => {
    function handleClick(e) {
      if (
        !e.target.closest(".gd-menu") &&
        !anchorRef.current?.contains(e.target)
      ) {
        onClose();
      }
    }

    document.addEventListener("click", handleClick, true);

    return () => document.removeEventListener("click", handleClick, true);
  }, [anchorRef, onClose]);

  if (!rect) return null;

  return createPortal(
    <>
      <div
        ref={menuRef}
        className="gd-menu"
        style={{
          position: "fixed",
          left: rect.left,
          top: rect.top + 4,
          width: rect.width,
          zIndex: 200,
        }}
      >
        <button
          className="gd-context-item"
          onClick={close(() => onCreateFolder())}
        >
          <IconNewFolder size={18} />
          New folder
        </button>

        <div className="gd-context-divider" />

        <button
          className="gd-context-item"
          onClick={close(() => onUploadFiles())}
          disabled={disabled}
        >
          <IconUpload size={18} />
          File upload
        </button>

        <button
          className="gd-context-item"
          onClick={close(() => onUploadFromDrive())}
          disabled={disabled}
        >
          <GoogleDriveSVG size={18} />
          Import from Drive
        </button>
      </div>
    </>,
    document.body,
  );
}
function GDrivePicker({
  onClose,
  open,
  setOpen,
  showError,
  refreshCurrentDirectory,
  enqueueItem,
  setItemProgress,
  completeItem,
  handleCancelUpload,
  setDbFileId,
}) {
  return createPortal(
    <>
      {open && (
        <GoogleDriveBrowser
          enqueueItem={enqueueItem}
          setItemProgress={setItemProgress}
          completeItem={completeItem}
          handleCancelUpload={handleCancelUpload}
          setDbFileId={setDbFileId}
          onUploadComplete={refreshCurrentDirectory}
          open={open}
          setOpen={setOpen}
          showError={showError}
        />
      )}
    </>,
    document.body,
  );
}
export default function DriveSidebar({
  dirId,
  isHomeRoute,
  isRecentRoute,
  isSharedRoute,
  isTrashRoute,
  disabled,
  onCreateFolder,
  refreshCurrentDirectory,
  onUploadFiles,
  showError,
  enqueueItem,
  setItemProgress,
  completeItem,
  handleCancelUpload,
  setDbFileId,
}) {
  const { isGoogleDrive } = useGDrive();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const newBtnRef = useRef(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isMyDriveActive =
    !isHomeRoute &&
    !isSharedRoute &&
    !isTrashRoute && !isRecentRoute &&
    dirId !== "google-drive" &&
    !dirId;

  const usagePercent = Math.max(
    0,
    Math.min((user.totalUsage / Number(user.totalStorage)) * 100, 100),
  );

  return (
    <aside className="gd-sidebar">
      <div style={{ position: "relative", margin: "0 8px 12px" }}>
        <button
          ref={newBtnRef}
          className="gd-new-btn"
          onClick={() => setShowNewMenu((v) => !v)}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M17 17V11h2v6h6v2h-6v6h-2v-6h-6v-2h6z" fill="#202124" />
          </svg>
          New
        </button>

        {showNewMenu && (
          <NewMenu
            anchorRef={newBtnRef}
            onClose={() => setShowNewMenu(false)}
            onCreateFolder={onCreateFolder}
            onUploadFromDrive={() => setOpen(true)}
            onUploadFiles={onUploadFiles}
            disabled={disabled}
          />
        )}
        {open && (
          <GDrivePicker
            enqueueItem={enqueueItem}
            setItemProgress={setItemProgress}
            completeItem={completeItem}
            handleCancelUpload={handleCancelUpload}
            setDbFileId={setDbFileId}
            refreshCurrentDirectory={refreshCurrentDirectory}
            onClose={() => setShowNewMenu(false)}
            setLoading={setLoading}
            open={open}
            setOpen={setOpen}
            showError={showError}
          />
        )}
      </div>

      {/* Nav */}
      <nav className="gd-nav-section">
        {isGoogleDrive && (
          <button
            className={`gd-nav-item ${dirId === "google-drive" ? "active" : ""}`}
            onClick={() => navigate("/directory/google-drive")}
          >
            <IconDrive size={20} /> Google Drive
          </button>
        )}
        <button
          className={`gd-nav-item ${isHomeRoute ? "active" : ""}`}
          onClick={() => navigate("/home")}
        >
          {isHomeRoute ? (
            <HomeIconSolid className="w-5 h-5" size={20} />
          ) : (
            <HomeIcon className="w-5 h-5" size={20} />
          )}{" "}
          Home
        </button>
        <button
          className={`gd-nav-item ${isMyDriveActive ? "active" : ""}`}
          onClick={() => navigate("/")}
        >
          {isMyDriveActive ? (
            <InboxStackIconSolid className="w-5 h-5" />
          ) : (
            <InboxStackIcon className="w-5 h-5" />
          )}{" "}
          My Drive
        </button>

        <button
          className={`gd-nav-item ${isSharedRoute && !dirId ? "active" : ""}`}
          onClick={() => navigate("/shared")}
        >
          {isSharedRoute ? (
            <ShareIconSolid className="w-5 h-5" />
          ) : (
            <ShareIcon className="w-5 h-5" />
          )}
          Shared with me
        </button>

        <button
          className={`gd-nav-item ${isRecentRoute ? "active" : ""}`}
          onClick={() => navigate("/recent")}
        >
          <History size={20} /> Recent
        </button>

        <button className="gd-nav-item">
          <IconStarred size={20} /> Starred
        </button>

        <button
          className={`gd-nav-item ${isTrashRoute && !dirId ? "active" : ""}`}
          onClick={() => navigate("/trash")}
        >
          {isTrashRoute ? (
            <TrashIconSolid className="w-5 h-5" />
          ) : (
            <TrashIcon className="w-5 h-5" />
          )}{" "}
          Trash
        </button>
      </nav>

      {/* Storage */}
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
            onClick={() => navigate("/main#pricing")}
            className="gd-storage-btn"
          >
            Get more storage
          </button>
        )}
      </div>
    </aside>
  );
}
