import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpOnSquareIcon,
  ArrowUpOnSquareStackIcon,
  FolderPlusIcon,
  HomeIcon,
  InboxStackIcon,
  ShareIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  InboxStackIcon as InboxStackIconSolid,
  ShareIcon as ShareIconSolid,
  TrashIcon as TrashIconSolid,
  StarIcon as StarIconSolid
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

const NAV_ITEMS = [
  {
    key: "google-drive",
    label: "Google Drive",
    path: "/google-drive",
    Icon: GoogleDriveSVG,
    IconSolid: GoogleDriveSVG,
    isActive: ({ dirContext, dirId }) => dirContext === "google-drive",
  },
  {
    key: "home",
    label: "Home",
    path: "/home",
    Icon: HomeIcon,
    IconSolid: HomeIconSolid,
    isActive: ({ dirContext }) => dirContext === "home",
  },
  {
    key: "root",
    label: "My Drive",
    path: "/",
    Icon: InboxStackIcon,
    IconSolid: InboxStackIconSolid,
    isActive: ({ dirContext, dirId }) => dirContext === "root" && !dirId,
  },
  {
    key: "shared",
    label: "Shared with me",
    path: "/shared",
    Icon: ShareIcon,
    IconSolid: ShareIconSolid,
    isActive: ({ dirContext, dirId }) => dirContext === "shared" && !dirId,
  },
  {
    key: "recent",
    label: "Recent",
    path: "/recent",
    Icon: History,
    IconSolid: History,
    isActive: ({ dirContext }) => dirContext === "recent",
  },
   {
    key: "starred",
    label: "Starred",
    path: "/starred",
    Icon: StarIcon,
    IconSolid: StarIconSolid,
    isActive: ({ dirContext }) => dirContext === "starred",
  },
  {
    key: "trash",
    label: "Trash",
    path: "/trash",
    Icon: TrashIcon,
    IconSolid: TrashIconSolid,
    isActive: ({ dirContext, dirId }) => dirContext === "trash" && !dirId,
  },
];

function NewMenu({
  anchorRef,
  onClose,
  onCreateFolder,
  onUploadFromDrive,
  onUploadFolders,
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
          <FolderPlusIcon className="text-black w-5 h-5" />
          New folder
        </button>

        <div className="gd-context-divider" />

        <button
          className="gd-context-item"
          onClick={close(() => onUploadFiles())}
          disabled={disabled}
        >
          <ArrowUpOnSquareIcon className="text-black w-5 h-5" />
          File upload
        </button>
      <button
          className="gd-context-item"
          onClick={close(() => onUploadFolders())}
          disabled={disabled}
        >
          <ArrowUpOnSquareStackIcon className="text-black w-5 h-5" />
          Folder upload
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
  dirContext,
  disabled,
  onCreateFolder,
  refreshCurrentDirectory,
  onUploadFolders,
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
  const newBtnRef = useRef(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
            onUploadFolders={onUploadFolders}
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
        {/* {isGoogleDrive && (
          <button
            className={`gd-nav-item ${dirContext === "google-drive" ? "active" : ""}`}
            onClick={() => navigate("/google-drive")}
          >
            <IconDrive size={20} /> Google Drive
          </button>
        )} */}

        {NAV_ITEMS.map(({ key, label, path, Icon, IconSolid, isActive }) => {
          const active = isActive({ dirContext, dirId });
          const DisplayIcon = active ? IconSolid : Icon;
          if (!isGoogleDrive && key === "google-drive") return;
          return (
            <button
              key={key}
              className={`gd-nav-item ${active ? "active" : ""}`}
              onClick={() => navigate(path)}
            >
              <DisplayIcon className="w-5 h-5" size={20} /> {label}
            </button>
          );
        })}

       
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
