import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  IconMyDrive,
  IconComputers,
  IconShared,
  IconRecent,
  IconStarred,
  IconTrash2,
  IconNewFolder,
  IconUpload,
  IconHome,
} from "../Icons/Icons";
import { formatSize } from "../../../Utils/formatHelpers";
import { History, Home, House, Share } from "lucide-react";
import { useGDrive } from "../../Contexts/GoogleDriveAuthContext";
import { useAuth } from "../../Contexts/AuthContext";
import { fetchPortalUrl } from "../../../apis/subscriptionApi";

export default function DriveSidebar({
  dirId,

  isHomeRoute,
  isSharedRoute,
  isTrashRoute,
  disabled,
  onCreateFolder,
  onUploadFiles,
}) {
  const {isGoogleDrive} = useGDrive();
const {user} = useAuth();
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
    Math.min((user.totalUsage / Number(user.totalStorage)) * 100, 100),
  );

  const isDriveRoute = location.pathname.endsWith("/");
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
          {isHomeRoute ? (
            <HomeIconSolid className="w-5 h-5" size={20} />
          ) : (
            <HomeIcon className="w-5 h-5" size={20} />
          )}{" "}
          Home
        </button>
        <button
          className={`gd-nav-item ${isMyDriveActive ? "active" : ""}`}
          onClick={() => {
            navigate("/");
          }}
        >
          {isDriveRoute ? (
            <InboxStackIconSolid className="w-5 h-5" />
          ) : (
            <InboxStackIcon className="w-5 h-5" />
          )}{" "}
          My Drive
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
          {isSharedRoute ? (
            <ShareIconSolid className="w-5 h-5" />
          ) : (
            <ShareIcon className="w-5 h-5" />
          )}
          Shared with me
        </button>

        <button className="gd-nav-item">
          <History size={20} /> Recent
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
          {" "}
          {user.totalUsage === 0 ? "0 B " : formatSize(user.totalUsage)} of{" "}
          {formatSize(user.totalStorage)} used
        </div>
        {user.plan !== "business" && <button onClick={()=> navigate("/main#pricing")} className="gd-storage-btn">Get more storage</button>}
      </div>
    </aside>
  );
}
