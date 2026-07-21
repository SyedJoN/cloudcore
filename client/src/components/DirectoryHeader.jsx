import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaUsersCog } from "react-icons/fa";
import {
  FaFolderPlus,
  FaUpload,
  FaSignOutAlt,
  FaSignInAlt,
} from "react-icons/fa";
import { getColor } from "../../utils/getProfileColor.js";
import GoogleDriveBtn from "./GoogleDrive.jsx";
import { useAuth } from "../Contexts/AuthContext.jsx";

function DirectoryHeader({
  isGoogleDrive,
  directoryName,
  onCreateFolderClick,
  onUploadFilesClick,
  fileInputRef,
  handleFileSelect,
  disabled = false,
}) {
  const { user, refreshUser, loggedIn, logout, logoutAll } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [hasError, setHasError] = useState(null);

  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  // -------------------------------------------
  // 2. Toggle user menu
  // -------------------------------------------
  const handleUserIconClick = () => {
    setShowUserMenu((prev) => !prev);
  };

  // -------------------------------------------
  // 4. Close menu on outside click
  // -------------------------------------------
  useEffect(() => {
    function handleDocumentClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  async function handleManageUsers() {
    navigate("/users");
  }
  return (
    <header className="directory-header">
      <h1>{directoryName}</h1>
      <div className="header-links">
        {!isGoogleDrive && <GoogleDriveBtn />}

        <button
          className="icon-button"
          title="Create Folder"
          onClick={onCreateFolderClick}
          disabled={disabled}
        >
          <FaFolderPlus />
        </button>

        {/* Upload Files (icon button) */}
        <button
          className="icon-button"
          title="Upload Files"
          onClick={onUploadFilesClick}
          disabled={disabled}
        >
          <FaUpload />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          style={{ display: "none" }}
          multiple
          onChange={handleFileSelect}
        />

        {/* User Icon & Dropdown Menu */}
        <div className="user-menu-container" ref={userMenuRef}>
          <button
            className="icon-button"
            title="User Menu"
            onClick={handleUserIconClick}
          >
            {user?.avatar && !hasError ? (
              <div className="user-avatar">
                <img
                  alt={user.name}
                  src={user.avatar}
                  onError={() => setHasError(true)}
                ></img>
              </div>
            ) : (
              <>
                <span
                  className="dynamic-avatar"
                  style={{
                    backgroundColor: getColor(user?.name),
                  }}
                >
                  {user.name?.charAt(0)}
                </span>
              </>
            )}
          </button>

          {showUserMenu && (
            <div className="user-menu">
              {loggedIn ? (
                <>
                  {/* Display name & email if logged in */}
                  <div className="user-menu-item user-info">
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span className="user-name">{user.name}</span>
                      <span className="user-email">{user.email}</span>
                      <span
                        style={{
                          textTransform: "capitalize",
                          fontWeight: "bold",
                        }}
                        className="user-email"
                      >
                        ~{user.role}
                      </span>
                    </div>
                  </div>
                  <div className="user-menu-divider" />
                  {user.role !== "user" && (
                    <div
                      className="user-menu-item login-btn"
                      onClick={handleManageUsers}
                    >
                      <FaUsersCog className="menu-item-icon" />
                      <span>Manage users</span>
                    </div>
                  )}
                  <div className="user-menu-item login-btn" onClick={logout}>
                    <FaSignOutAlt className="menu-item-icon" />
                    <span>Logout</span>
                  </div>
                  <div className="user-menu-item login-btn" onClick={logoutAll}>
                    <FaSignOutAlt className="menu-item-icon" />
                    <span>Logout All</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Show Login if not logged in */}
                  <div
                    className="user-menu-item login-btn"
                    onClick={() => {
                      navigate("/login");
                      setShowUserMenu(false);
                    }}
                  >
                    <FaSignInAlt className="menu-item-icon" />
                    <span>Login</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default DirectoryHeader;
