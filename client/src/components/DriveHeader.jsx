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
import ThemeToggleBtn from "./Buttons/ThemeToggleBtn.jsx";

const BASE_URL = "http://localhost:4000";

export default function DriveHeader({
  viewMode,
  onToggleView,
  isGoogleDrive,
  searchQuery,
  onSearchChange,
}) {
  const navigate = useNavigate();
const handleSettings = async ()=> {
  console.log('toggled')
}
  return (
    <header className="gd-header bg-[#f8fafd] dark:bg-[#1b1b1b]">
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
        <div className="gd-search bg-[#e9eef6] dark:bg-[#282a2c]">
          <span className="gd-search-icon">
            <IconSearch size={'25'} />
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


        <div className="gd-icon-btn" title="dark-mode">
          {/* <IconSettings /> */}
          <ThemeToggleBtn />
        </div>

        {/* Avatar + dropdown — wrapped in ref div for outside-click detection */}
        <UserAccountBar
        />
      </div>
    </header>
  );
}
