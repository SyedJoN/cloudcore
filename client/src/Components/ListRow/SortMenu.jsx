import React from "react";

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

const SortMenu = ({ sortConfig, onSortChange, setOpen }) => {
  const isName = sortConfig.key === "name";

  return (
    <div className="w-65 overflow-hidden bg-(--surface-container) py-2 shadow-(--shadow-1) cursor-default">
      {/* Title */}
      <div className="px-4 pb-2 pt-2 cursor-default">
        <h3 className="text-[16px] font-medium text-(--text-primary)">Sort</h3>
      </div>

      {/* Sort by */}
      <div className="px-4 py-1.5">
        <p className="text-xs font-medium text-(--text-secondary) cursor-default">
          Sort by
        </p>
      </div>

      <div>
        <SortOption
          setOpen={setOpen}
          checked={sortConfig.key === "name"}
          onClick={() => onSortChange({ key: "name" })}
        >
          Name
        </SortOption>

        <SortOption
          setOpen={setOpen}
          checked={sortConfig.key === "modifiedTime"}
          onClick={() =>
            onSortChange({
              key: "modifiedTime",
            })
          }
        >
          Date modified
        </SortOption>
      </div>

      <div className="my-2 h-px bg-[#e8eaed]" />

      {/* Direction */}
      <div className="px-4 py-1.5">
        <p className="text-xs font-medium text-(--text-primary)">
          Sort direction
        </p>
      </div>

      <div>
        <SortOption
          setOpen={setOpen}
          checked={sortConfig.direction === "asc"}
          onClick={() =>
            onSortChange({
              direction: "asc",
            })
          }
        >
          {isName ? "A → Z" : "Oldest → Newest"}
        </SortOption>

        <SortOption
          setOpen={setOpen}
          checked={sortConfig.direction === "desc"}
          onClick={() =>
            onSortChange({
              direction: "desc",
            })
          }
        >
          {isName ? "Z → A" : "Newest → Oldest"}
        </SortOption>
      </div>

      <div className="my-2 h-px bg-[#e8eaed]" />

      {/* Folders */}
      <div className="px-4 py-1.5">
        <p className="text-xs font-medium text-(--text-primary)">Folders</p>
      </div>

      <div>
        <SortOption
          setOpen={setOpen}
          checked={sortConfig.folders === "top"}
          onClick={() =>
            onSortChange({
              folders: "top",
            })
          }
        >
          Folders on top
        </SortOption>

        <SortOption
          setOpen={setOpen}
          checked={sortConfig.folders === "mixed"}
          onClick={() =>
            onSortChange({
              folders: "mixed",
            })
          }
        >
          Mixed with files
        </SortOption>
      </div>
    </div>
  );
};

export default SortMenu;
