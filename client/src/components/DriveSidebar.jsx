import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconDrive,
  IconMyDrive,
  IconComputers,
  IconShared,
  IconRecent,
  IconStarred,
  IconTrash2,
  IconNewFolder,
  IconUpload,
  IconHome,
} from "./Icons";
import { formatSize } from "../../utils/formatHelpers";
import { History, Home, House, Share } from "lucide-react";

export default function DriveSidebar({
  dirId,
  totalStorage,
  totalUsage,
  isGoogleDrive,
  isHomeRoute,
  isSharedRoute,
  isTrashRoute,
  disabled,
  onCreateFolder,
  onUploadFiles,
}) {
  console.log('totalUsage', totalUsage)
  const navigate = useNavigate();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const isMyDriveActive =
    !isHomeRoute &&
    !isSharedRoute &&
    !isTrashRoute &&
    dirId !== "google-drive" &&
    !dirId;

  const usagePercent = Math.max(
    0,
    Math.min((totalUsage / Number(totalStorage)) * 100, 100),
  );
  
  return (
    <aside className="gd-sidebar">
      {/* New button */}
      <div style={{ position: "relative", margin: "0 8px 12px" }}>
        <button
          className="gd-new-btn"
          onClick={() => setShowNewMenu((v) => !v)}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
         
            <path d="M17 17V11h2v6h6v2h-6v6h-2v-6h-6v-2h6z" fill="#202124" />
          </svg>
          New
        </button>

        {showNewMenu && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 199 }}
              onClick={() => setShowNewMenu(false)}
            />
            <div
              className="gd-context-menu"
              style={{
                left: 8,
                top: "100%",
                marginTop: 4,
                zIndex: 200,
                position: "absolute",
                width: "calc(100% - 16px)",
              }}
              onClick={() => setShowNewMenu(false)}
            >
              <button className="gd-context-item" onClick={onCreateFolder}>
                <IconNewFolder size={18} /> New folder
              </button>
              <div className="gd-context-divider" />
              <button
                className="gd-context-item"
                onClick={onUploadFiles}
                disabled={disabled}
              >
                <IconUpload size={18} /> File upload
              </button>
            </div>
          </>
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
          onClick={() => {
            navigate("/home");
          }}
        >
          
         {isHomeRoute ? <House fill="#c2e7ff" size={20}/> : <IconHome size={20} />} Home
        </button>
        <button
          className={`gd-nav-item ${isMyDriveActive ? "active" : ""}`}
          onClick={() => {
            navigate("/");
          }}
        >
          <IconMyDrive size={20} /> My Drive
        </button>

        <button className="gd-nav-item" onClick={() => navigate("/")}>
          <IconComputers size={20} /> Computers
        </button>

        <button
          className={`gd-nav-item ${isSharedRoute && !dirId ? "active" : ""}`}
          onClick={() => {
            navigate("/shared");
          }}
        >
          <Share size={20}/>
        Shared with me
        </button>

        <button className="gd-nav-item">
          <History size={20}/> Recent
        </button>

        <button className="gd-nav-item">
          <IconStarred size={20} /> Starred
        </button>

        <button
          className={`gd-nav-item ${isTrashRoute && !dirId ? "active" : ""}`}
          onClick={() => {
            navigate("/trash");
          }}
        >
          <IconTrash2 size={20} /> Trash
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
          {" "}
          {totalUsage === 0 ? "0 B " : formatSize(totalUsage)} of{" "}
          {formatSize(totalStorage)} used
        </div>
        <button className="gd-storage-btn">Get more storage</button>
      </div>
    </aside>
  );
}
