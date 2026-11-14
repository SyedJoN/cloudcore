import { IconGrid, IconList } from "../Icons/Icons";

export default function ViewToggleMobile({ viewMode, onToggleView }) {
  const selectView = (mode) => {
    if (mode !== viewMode) onToggleView?.();
  };

  const viewBtn = (mode) =>
    `flex h-8 w-8 flex-1 items-center justify-center rounded-full
     text-(--text-secondary) cursor-pointer transition-colors duration-150
     ${viewMode === mode ? "bg-(--text-primary) text-(--text-primary)" : "hover:bg-(--surface-container-dark) bg-(--surface-container-dark-hover)"}`;
  return (
    <div className="flex items-center gap-1 w-25">
      <button
         style={{
          borderRadius: viewMode === "grid" ? "40% 10% 10% 40%" : "50%",
        }}
        type="button"
        className={viewBtn("list")}
        onClick={() => selectView("list")}
        aria-label="List view"
        aria-pressed={viewMode === "list"}
      >
        <IconList
          color={`${viewMode === "list" ? "var(--surface-container-dark)" : "var(--text-primary)"}`}
        />
      </button>
      <button
        style={{
          borderRadius: viewMode === "list" ? "10% 40% 40% 10%" : "50%",
        }}
        type="button"
        className={viewBtn("grid")}
        onClick={() => selectView("grid")}
        aria-label="Grid view"
        aria-pressed={viewMode === "grid"}
      >
        <IconGrid
          color={`${viewMode === "grid" ? "var(--surface-container-dark)" : "var(--text-primary)"}`}
        />
      </button>
    </div>
  );
}
