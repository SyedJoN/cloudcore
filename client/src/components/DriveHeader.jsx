import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { googleLogout } from "@react-oauth/google";
import { getColor } from "../../utils/getProfileColor.js";
import {
  IconDrive,
  IconSearch,
  IconGrid,
  IconList,
  IconSettings,
} from "./Icons";
import GoogleDriveBtn from "./GoogleDrive.jsx";
import UserAccountBar from "./UserAccountBar.jsx";
import { Cloud } from "lucide-react";

const BASE_URL = "http://localhost:4000";

export default function DriveHeader({
  user,
  setUser,
  loggedIn,
  setLoggedIn,
  viewMode,
  onToggleView,
  isGoogleDrive,
  searchQuery,
  onSearchChange,
}) {
  const navigate = useNavigate();

  return (
    <header className="gd-header">
      {/* Logo */}
      <a
        className="gd-logo"
        onClick={() => navigate("/")}
        style={{ cursor: "pointer", textDecoration: "none" }}
      >
        <Cloud width="44" height="44" color="#2f5cf5" />
        <span className="gd-logo-text">Cloud Drive</span>
      </a>

      {/* Search */}
      <div className="gd-search-wrapper">
        <div className="gd-search">
          <span className="gd-search-icon">
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder="Search in Drive"
            value={searchQuery ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="gd-header-actions">
        {/* Google Drive connect button — hidden once already connected */}
        {!isGoogleDrive && <GoogleDriveBtn />}

        <button
          className="gd-icon-btn"
          title={viewMode === "grid" ? "List view" : "Grid view"}
          onClick={onToggleView}
        >
          {viewMode === "grid" ? <IconList /> : <IconGrid />}
        </button>

        <button className="gd-icon-btn" title="Settings">
          <IconSettings />
        </button>

        {/* Avatar + dropdown — wrapped in ref div for outside-click detection */}
        <UserAccountBar
          loggedIn={loggedIn}
          setLoggedIn={setLoggedIn}
          user={user}
          setUser={setUser}
        />
      </div>
    </header>
  );
}
