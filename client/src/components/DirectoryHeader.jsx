import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaUsersCog  } from "react-icons/fa";
import { googleLogout } from "@react-oauth/google";
import {
  FaFolderPlus,
  FaUpload,
  FaUser,
  FaSignOutAlt,
  FaSignInAlt,
} from "react-icons/fa";
import { getColor } from "../../utils/getProfileColor.js";
import GoogleDriveBtn from "./GoogleDrive.jsx";
import { getCurrentUser } from "../../apis/userApi.js";
import { logoutAll, logoutUser } from "../../apis/authApi.js";

function DirectoryHeader({
  isGoogleDrive,
  directoryName,
  onCreateFolderClick,
  onUploadFilesClick,
  fileInputRef,
  handleFileSelect,
  disabled = false,
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("Guest User");
  const [userEmail, setUserEmail] = useState("guest@example.com");
  const [userRole, setUserRole] = useState("user");
  const [userAvatar, setUserAvatar] = useState(null);
  const [hasError, setHasError] = useState(null);

  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  // -------------------------------------------
  // 1. Fetch user info from /auth on mount
  // -------------------------------------------
  useEffect(() => {
    async function fetchUser() {
      try {
       const data = await getCurrentUser();
        if (data) {
          setUserName(data.name);
          setUserEmail(data.email);
          setUserAvatar(data.avatar);
          setUserRole(data.role);
          setLoggedIn(true);
        } else if (data.response.status === 401) {
          setUserName("Guest User");
          setUserEmail("guest@example.com");
          setUserRole("user");
          setLoggedIn(false);
        } else {
          // Handle other error statuses if needed
          console.error("Error fetching user info:", response.status);
        }
      } catch (err) {
        console.error("Error fetching user info:", err.message || err);
      }
    }
    fetchUser();
  }, []);

  // -------------------------------------------
  // 2. Toggle user menu
  // -------------------------------------------
  const handleUserIconClick = () => {
    setShowUserMenu((prev) => !prev);
  };

  // -------------------------------------------
  // 3. Logout handler
  // -------------------------------------------
  const handleLogout = async () => {
    try {
      await logoutUser()
        console.log("Logged out successfully");
        // Optionally reset local state
        setLoggedIn(false);
        setUserName("Guest User");
        setUserEmail("guest@example.com");
        navigate("/login");
      
    } catch (err) {
      console.error("Logout error:", err.message);
    } finally {
      googleLogout();
      setShowUserMenu(false);
    }
  };
  // -------------------------------------------
  // 3. Logout handler
  // -------------------------------------------
  const handleLogoutAll = async () => {
    try {
     await logoutAll();
     
        console.log("Logged out successfully");
       
        setLoggedIn(false);
        setUserName("");
        setUserEmail("");
        navigate("/login");
      
    } catch (err) {
      console.error("Logout error:", err.message);
    } finally {
      setShowUserMenu(false);
    }
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
    navigate('/users')
  }
  return (
    <header className="directory-header">
      <h1>{directoryName}</h1>
      <div className="header-links">
      {!isGoogleDrive && <GoogleDriveBtn/>} 

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
            {userAvatar && !hasError ? (
              <div className="user-avatar">
                <img
                  alt={userName}
                  src={userAvatar}
                  onError={() => setHasError(true)}
                ></img>
              </div>
            ) : (
              <>
                <span
                  className="dynamic-avatar"
                  style={{
                    backgroundColor: getColor(userName),
                  }}
                >
                  {userName?.charAt(0)}
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
                      <span className="user-name">{userName}</span>
                      <span className="user-email">{userEmail}</span>
                      <span style={{textTransform: "capitalize", fontWeight: "bold"}} className="user-email">~{userRole}</span>
                    </div>
                  </div>
                  <div className="user-menu-divider" />
                  {userRole !== "user" &&
                    <div
                    className="user-menu-item login-btn"
                    onClick={handleManageUsers}
                  >
                    <FaUsersCog className="menu-item-icon" />
                    <span>Manage users</span>
                  </div>
                  }
                  <div
                    className="user-menu-item login-btn"
                    onClick={handleLogout}
                  >
                    <FaSignOutAlt className="menu-item-icon" />
                    <span>Logout</span>
                  </div>
                  <div
                    className="user-menu-item login-btn"
                    onClick={handleLogoutAll}
                  >
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
