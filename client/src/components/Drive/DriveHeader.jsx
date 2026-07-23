import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { googleLogout } from "@react-oauth/google";
import { getColor } from "../../../Utils/getProfileColor.js";
import {
  IconDrive,
  IconSearch,
  IconGrid,
  IconList,
  IconSettings,
} from "../Icons/Icons.jsx";
import GoogleDriveBtn from "../ThirdPartyButtons/GoogleDrive.jsx";
import UserAccountBar from "../UserAccountBar.jsx";
import { Cloud } from "lucide-react";
import ThemeToggleBtn from "../Buttons/ThemeToggleBtn.jsx";
import { useGDrive } from "../../Contexts/GoogleDriveAuthContext.jsx";
import { Bars3Icon } from "@heroicons/react/24/solid";
import SearchBar from "../SearchBar.jsx";
import { useSidebar } from "../../Contexts/SidebarContext.jsx";

const BASE_URL = "http://localhost:4000";

export default function DriveHeader({
  searchQuery,
  onSearchChange,
}) {
    const { windowWidth, toggleSidebar } = useSidebar();
    const [showSearchBar, setShowSearchBar] = useState(false);
  
  const navigate = useNavigate();
  const { isGoogleDrive } = useGDrive();
  const handleSearchToggle = () => {
    setShowSearchBar((prev) => !prev);
  };
  return (
    <header className="gd-header">
      {/* Logo */}
        {showSearchBar && windowWidth < 768 ? (
              <SearchBar
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                handleSearchToggle={handleSearchToggle}
                classNames="sticky top-0 z-[4] border-b border-transparent flex flex-1 items-center min-h-[64px]"
              />
            ) :
            (<>
 <a
        className="gd-logo min-w-12 md:min-w-[180px]"
        onClick={() => navigate("/")}
        style={{ cursor: "pointer", textDecoration: "none" }}
      >
        <Cloud width="44" height="44" color="#2f5cf5" />
        <span className="gd-logo-text hidden md:block">Cloud Drive</span>
      </a>
      <a
        className="hover:bg-[var(--btn-bg-medium)] md:hidden flex items-center decoration-0 p-2 rounded-full cursor-pointer"
        onClick={toggleSidebar}
      >
        <Bars3Icon width="25" height="25" color="var(--text-secondary)" />
      </a>
      {/* Search */}
      {windowWidth < 768 ? (
        <a
          onClick={handleSearchToggle}
          className="hover:bg-[var(--btn-bg-medium)] flex items-center p-2 decoration-0 gd-search-icon cursor-pointer rounded-full"
        >
          <IconSearch size={"25"} />
        </a>
      ) : (
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          classNames="max-w-[720px] flex-1"
        />
      )}

      {/* Right actions */}
      <div className="gd-header-actions">
        {!isGoogleDrive && (
          <div className="hidden sm:flex" title="gdrive-btn">
            <GoogleDriveBtn classNames="bg-[var(--surface-container-dark)] hover:bg-[var(--surface-container-dark-hover)] px-2 py-3 gap-2 shadow-[var(--shadow-1)]"/>
          </div>
        )}

        <div className="gd-icon-btn" title="dark-mode">
          <ThemeToggleBtn />
        </div>

        <UserAccountBar />
      </div>
      </>
            )
          }
    </header>
  );
}
