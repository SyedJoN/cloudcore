import React, { useEffect, useRef, useState } from "react";
import SortMenu from "./SortMenu";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/solid";

import { useDevice } from "../../Contexts/DeviceContext";
import { IconGrid, IconInfo, IconList } from "../Icons/Icons";

const sortLabels = {
  name: "Name",
  modifiedTime: "Date modified",
  sharedWithMeTime: "Date shared",
  trashedTime: "Date trashed",
};

const SortButton = ({ sortConfig, setSortConfig, viewMode = "list", onToggleView }) => {
  const [open, setOpen] = useState(false);
  const { device } = useDevice();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSortChange = (changes) => {
    setSortConfig((prev) => ({
      ...prev,
      ...changes,
    }));
  };

  return (
    <div ref={menuRef} className="relative ml-auto flex justify-between items-center py-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`
          flex items-center gap-2
          rounded-full ${device === "mobile" ? "px-0" : "px-4"}
           py-2
          text-sm
          text-(--text-secondary)
          hover:bg-(--surface-container-dark)
          cursor-pointer
        `}
      >
        {/* Sort icon */}
      {viewMode === "list" && device === "windows" && (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M4 6h16" />
            <path d="M7 12h10" />
            <path d="M10 18h4" />
          </svg>
        )}

        <span className="flex items-center font-bold">
          {viewMode === "grid" ? (
            <>
              {sortLabels[sortConfig.key]}

              <div className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-(--accent-blue-light)">
                {sortConfig.direction === "asc" ? (
                  <ArrowUpIcon className="h-5 w-5 text-[#06062f]" />
                ) : (
                  <ArrowDownIcon className="h-5 w-5 text-[#06062f]" />
                )}
              </div>
            </>
          ) : (
            "Sort"
          )}
        </span>
      </button>

      {open && (
        <div
          className={`
      absolute
      top-full
      z-50
      mt-2
      origin-top
      animate-[sortDropdown_100ms_ease-out]
      ${device === "mobile" ? "left-0" : viewMode === "list" ? "right-0" : "left-0"}
    `}
        >
          <SortMenu
            setOpen={setOpen}
            sortConfig={sortConfig}
            onSortChange={handleSortChange}
          />
        </div>
      )}
      {device === "mobile" && 
         <div className="gd-toolbar-actions">
              <button
                className="gd-icon-btn justify-end!"
                title={viewMode === "grid" ? "List view" : "Grid view"}
                onClick={onToggleView}
              >
                {viewMode === "grid" ? <IconList /> : <IconGrid />}
              </button>
            
            </div>
      }
     
    </div>
  );
};

export default SortButton;
