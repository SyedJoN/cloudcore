import { useEffect, useRef, useState } from "react";
import SortMenu from "./SortMenu";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/solid";
import { IconGrid, IconList } from "../Icons/Icons";
import { Divider } from "../Divider";

const sortLabels = {
  name: "Name",
  modifiedTime: "Date modified",
  sharedWithMeTime: "Date shared",
  trashedTime: "Date trashed",
};

const SortButtonMobile = ({
  sortConfig,
  setSortConfig,
  viewMode = "list",
  onToggleView,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleSortChange = (changes) => {
    setSortConfig((prev) => ({ ...prev, ...changes }));
  };

  // Parent only exposes a toggle, so only call it when the mode actually changes
  const selectView = (mode) => {
    if (mode !== viewMode) onToggleView?.();
  };

  const viewBtn = (mode) =>
    `flex h-8 w-8 items-center justify-center rounded-full
     text-(--text-secondary) cursor-pointer transition-colors duration-150
     ${viewMode === mode ? "bg-(--folder-color) text-(--text-primary)" : "hover:bg-(--surface-container-dark) bg-(--surface-container-dark-hover)"}`;

  return (

    <div
      ref={menuRef}
      className="relative flex w-full items-center justify-between py-1"
    >
      {/* Sort label: always shows name + direction, in both list and grid */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 rounded-full py-2 pr-2 text-sm font-bold text-(--text-secondary) cursor-pointer"
      >
        <span>{sortLabels[sortConfig.key]}</span>

        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-(--surface-container-dark-hover)">
          {sortConfig.direction === "asc" ? (
            <ArrowUpIcon className="h-4 w-4 text-(--text-primary)" />
          ) : (
            <ArrowDownIcon className="h-4 w-4 text-(--text-primary)" />
          )}
        </span>
      </button>

      {/* Separate list / grid buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={viewBtn("list")}
          onClick={() => selectView("list")}
          aria-label="List view"
          aria-pressed={viewMode === "list"}
        >
          <IconList color={`${viewMode === "list" ? "var(--surface-container-dark)" : "var(--text-primary)"}`} />
        </button>
        <button
          type="button"
          className={viewBtn("grid")}
          onClick={() => selectView("grid")}
          aria-label="Grid view"
          aria-pressed={viewMode === "grid"}
        >
          <IconGrid color={`${viewMode === "grid" ? "var(--surface-container-dark)" : "var(--text-primary)"}`}  />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 origin-top animate-[sortDropdown_100ms_ease-out]">
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

export default SortButtonMobile;