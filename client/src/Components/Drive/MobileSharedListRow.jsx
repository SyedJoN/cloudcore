import { useCallback } from "react";
import { StarIcon } from "@heroicons/react/24/solid";
import { IconDots } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import { UseAvatar } from "../../Hooks/useAvatar";
import { getFileKind } from "../../../Utils/fileKind";
import "./MobileSharedListRow.css";


const currentYear = new Date().getFullYear();

// aaj ki date ho to time, warna "Nov 11" (purane saal ka ho to saal bhi)
const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== currentYear && { year: "numeric" }),
  });
};

const pickDate = (item, sortKey) => {
  const byKey = {
    sharedWithMeTime: item.sharedWithMeTime,
    modifiedTime: item.modifiedTime ?? item.updatedAt,
    modifiedByMeTime: item.modifiedByMeTime,
    viewedByMeTime: item.viewedByMeTime,
  };
  return (
    byKey[sortKey] ??
    item.sharedWithMeTime ??
    item.modifiedTime ??
    item.updatedAt
  );
};

/* ---------- Material icons (inline, koi extra package nahi) ---------- */

const SharedFolderIcon = ({size=36}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5 3c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm4 8h-8v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1z" />
  </svg>
);

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const PeopleIcon = ({size}) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width={size} height={size}>
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

/* ------------------------------------------------------------------ */

export default function MobileSharedListRow({
  item,
  owner,
  email,
  avatar,
  sortKey,
  isStarred = {},
  selected,
  selectionMode,
  setSelectionMode,
  setSelectedItems,
  onContextMenu,
  onSelect,
  onDoubleClick,
}) {
  const itemId = item.id ?? item._id;
  const type = item.isDirectory ? "directory" : "file";
  const iconType = item.isDirectory ? null : getFileKind(item);
  const starred = Boolean(isStarred[item._id]);

  const ownerLabel = owner || email || "";
  const date = formatDate(pickDate(item, sortKey));

  const isSharedWithOthers = (item.permissions?.length ?? 0) > 1;

  const subtitle = [ownerLabel, date].filter(Boolean).join(" • ");

  
  const handleToggle = useCallback(
    (id) => {
      setSelectedItems?.((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedItems],
  );

  return (
    <div
      className={`msr-row ${selected ? "selected" : ""}`}
      data-id={itemId}
      onClick={() => {
        if (selectionMode) {
          handleToggle(itemId);
          return;
        }
        onDoubleClick?.(type, itemId, item.name);
      }}
      onContextMenu={(e) => {
        if (selectionMode) return;
        e.preventDefault();
        e.stopPropagation();
        setSelectedItems?.(new Set([itemId])); 
        setSelectionMode?.(true);
      }}
    >
     
      <div className={`msr-avatar ${ownerLabel || avatar ? "" : "fallback"}`}>
        {ownerLabel || avatar ? (
          <UseAvatar name={owner || email} avatar={avatar} size={28} />
        ) : (
          <PersonIcon />
        )}
      </div>

      {/* file type tile / shared folder icon */}
      <div className={`msr-thumb ${item.isDirectory ? "folder" : ""}`}>
        {item.isDirectory ? (
          <SharedFolderIcon size={36} />
        ) : (
          <FileBadge size={18} type={iconType} />
        )}
      </div>

      {/* name + subtitle */}
      <div className="msr-text">
        <div className="msr-title">{item.name}</div>
        <div className="msr-sub">
          {starred && <StarIcon />}
          {isSharedWithOthers && <PeopleIcon size={10} />}
          <span className="msr-sub-text">{subtitle}</span>
        </div>
      </div>

      {/* kebab / checkbox */}
      <button
        type="button"
        className="msr-kebab"
        aria-label={selectionMode ? "Select item" : "More actions"}
        onClick={(e) => {
          e.stopPropagation();
          if (selectionMode) {
            handleToggle(itemId);
            return;
          }
          e.preventDefault();
          onSelect?.(itemId);
          onContextMenu?.(e, itemId);
        }}
      >
        {selectionMode ? (
          <span className={`msr-check ${selected ? "on" : ""}`}>
            {selected && (
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  d="m5 12 4 4L19 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        ) : (
          <IconDots className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}