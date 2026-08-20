import React, { useEffect, useRef, useState } from "react";
import SortMenu from "./SortMenu";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/solid";

const sortLabels = {
  name: "Name",
  modifiedTime: "Date modified",
  sharedWithMeTime: "Date shared",
  trashedTime: "Date trashed",
};

const SortButton = ({ sortConfig, setSortConfig, viewMode = "list" }) => {
  const [open, setOpen] = useState(false);
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
    <div ref={menuRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="
          flex items-center gap-2
          rounded-full
          px-4 py-2
          text-sm
          text-(--text-secondary)
          hover:bg-[#f1f3f4]
          cursor-pointer
        "
      >
        {/* Sort icon */}
        {viewMode === "list" && (
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

              <div className="ml-[4px] flex h-6 w-6 items-center justify-center rounded-full bg-(--accent-blue-light)">
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
      ${viewMode === "list" ? "right-0" : "left-0"}
    `}
  >
    <SortMenu
        setOpen={setOpen}

      sortConfig={sortConfig}
      onSortChange={handleSortChange}
    />
  </div>
)}

    </div>
  );
};

export default SortButton;
