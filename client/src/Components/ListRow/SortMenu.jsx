import React from "react";

/* ------------------------------------------------------------------ */
/*  Options: My Drive vs Shared with me                                */
/* ------------------------------------------------------------------ */

const SORT_KEYS = {
  drive: [
    { key: "name", label: "Name" },
    { key: "modifiedTime", label: "Date modified" },
  ],
  shared: [
    { key: "sharedTime", label: "Date shared" },
    { key: "name", label: "Name" },
    { key: "modifiedTime", label: "Date modified" },
    { key: "modifiedByMeTime", label: "Date modified by me" },
    { key: "viewedByMeTime", label: "Date opened by me" },
  ],
};

const LABELS = {
  drive: {
    direction: {
      name: { asc: "A → Z", desc: "Z → A" },
      date: { asc: "Oldest → Newest", desc: "Newest → Oldest" },
    },
    directionOrder: { name: ["asc", "desc"], date: ["asc", "desc"] },
    folders: { top: "Folders on top", mixed: "Mixed with files" },
  },
  shared: {
    direction: {
      name: { asc: "A to Z", desc: "Z to A" },
      date: { asc: "Old to new", desc: "New to old" },
    },
    // Google Drive (Shared with me) mein dates ke liye "New to old" pehle aata hai
    directionOrder: { name: ["asc", "desc"], date: ["desc", "asc"] },
    folders: { top: "On top", mixed: "Mixed with files" },
  },
};

/* ------------------------------------------------------------------ */
/*  UI                                                                 */
/* ------------------------------------------------------------------ */

const SortOption = ({ checked, children, onClick, setOpen }) => {
  return (
    <button
      type="button"
      onClick={() => {
        onClick();
        setOpen(false);
      }}
      className="
        flex h-9 w-full items-center
        px-3
        text-left
        text-sm
        text-(--text-primary)
        hover:bg-(--surface-container-dark)
        cursor-pointer
      "
    >
      {/* Google Drive style check */}
      <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center">
        {checked && (
          <svg
            viewBox="0 0 24 24"
            className="h-4.5 w-4.5 text-[#1a73e8]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5 9.5 17 19 7.5" />
          </svg>
        )}
      </span>

      <span>{children}</span>
    </button>
  );
};

const SectionLabel = ({ children }) => (
  <div className="px-4 py-1.5">
    <p className="text-xs font-medium text-(--text-secondary) cursor-default">
      {children}
    </p>
  </div>
);

const Divider = () => <div className="my-2 h-px bg-[#e8eaed]" />;

const SortMenu = ({
  sortConfig,
  onSortChange,
  setOpen,
  isSharedRoute = false,
}) => {
  const variant = isSharedRoute ? "shared" : "drive";
  const labels = LABELS[variant];

  // direction ke labels: name ke liye A→Z, baaki sab dates hain
  const kind = sortConfig.key === "name" ? "name" : "date";

  return (
    <div className="w-65 overflow-hidden bg-(--surface-container) py-2 shadow-(--shadow-1) cursor-default">
      {/* Title */}
      <div className="px-4 pb-2 pt-2 cursor-default">
        <h3 className="text-[16px] font-medium text-(--text-primary)">Sort</h3>
      </div>

      {/* Sort by */}
      <SectionLabel>Sort by</SectionLabel>
      <div>
        {SORT_KEYS[variant].map(({ key, label }) => (
          <SortOption
            key={key}
            setOpen={setOpen}
            checked={sortConfig.key === key}
            onClick={() => onSortChange({ key })}
          >
            {label}
          </SortOption>
        ))}
      </div>

      <Divider />

      {/* Direction */}
      <SectionLabel>Sort direction</SectionLabel>
      <div>
        {labels.directionOrder[kind].map((direction) => (
          <SortOption
            key={direction}
            setOpen={setOpen}
            checked={sortConfig.direction === direction}
            onClick={() => onSortChange({ direction })}
          >
            {labels.direction[kind][direction]}
          </SortOption>
        ))}
      </div>

      <Divider />

      {/* Folders */}
      <SectionLabel>Folders</SectionLabel>
      <div>
        {["top", "mixed"].map((value) => (
          <SortOption
            key={value}
            setOpen={setOpen}
            checked={sortConfig.folders === value}
            onClick={() => onSortChange({ folders: value })}
          >
            {labels.folders[value]}
          </SortOption>
        ))}
      </div>
    </div>
  );
};

export default SortMenu;