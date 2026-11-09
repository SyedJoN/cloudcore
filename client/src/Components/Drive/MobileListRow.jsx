import {
  ChevronLeftIcon,
  EllipsisVerticalIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { IconDots, IconFolder } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import { getFileType } from "../../../Utils/displayUtils";
import { MdOutlineSelectAll, MdClose } from "react-icons/md";
import { useAuth, useGDrive } from "../../Contexts";
import { Divider } from "../Divider";
import { useCallback, useEffect, useRef } from "react";
import "./MobileListRow.css";
const currentYear = new Date().getFullYear();

// same helper as in ListRow, move it to Utils/formatDate and import it in both
const formatDateToUS = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== currentYear && { year: "numeric" }),
  });
};

export default function MobileListRow({
  item,
  route,
  owner,
  isStarred = {},
  selected,
  selectionMode,
  setSelectionMode,
  setSelectedItems,
  onContextMenu,
  onSelect,
  onDoubleClick,
  onRowClick,
}) {
  const { isGoogleDrive } = useGDrive();
  const { user } = useAuth();

  const itemId = item.id ?? item._id;
  const isGoogleDriveRoute = route === "google-drive";
  const lastTap = useRef(0);

  // add / remove, baqi selection ko nahi chherta
  const handleToggle = useCallback(
    (id) => {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedItems],
  );

  const type = item.isDirectory
    ? isGoogleDrive && isGoogleDriveRoute
      ? "google-directory"
      : "directory"
    : isGoogleDrive && isGoogleDriveRoute
      ? "google-file"
      : "file";

  const iconType = item.isDirectory ? null : getFileType(item?.name || "");
  const starred = Boolean(isStarred[item._id]);

  /* ---------- subtitle: "You opened · 3:45 PM" ---------- */

  const viewedTime = item.viewedByMeTime
    ? new Date(item.viewedByMeTime).getTime()
    : 0;
  const modifiedByMeTime = item.modifiedByMeTime
    ? new Date(item.modifiedByMeTime).getTime()
    : 0;
  const myActivity = Math.max(viewedTime, modifiedByMeTime);

  const modifiedAt = item.modifiedTime || item.updatedAt;
  const lastModifier =
    item?.lastModifyingUser?.name || item?.lastModifyingUser?.displayName;
  const modifiedBy = lastModifier === user.name ? "You" : lastModifier;

  let subtitle = "";

  if (route === "recent" && myActivity) {
    const label = viewedTime > modifiedByMeTime ? "You opened" : "You modified";
    subtitle = `${label} · ${formatDateToUS(myActivity)}`;
  } else if (route === "shared") {
    const when = formatDateToUS(item.sharedWithMeTime);
    subtitle = [owner ? `Shared by ${owner}` : "Shared", when]
      .filter(Boolean)
      .join(" · ");
  } else if (route === "trash") {
    const when = formatDateToUS(item.trashedTime);
    subtitle = ["Deleted", when].filter(Boolean).join(" · ");
  } else {
    const when = formatDateToUS(modifiedAt);
    const who = modifiedBy ? `${modifiedBy} modified` : "Modified";
    subtitle = when ? `${who} · ${when}` : "";
  }

  // for mobile double click
  const handleTouchEnd = () => {
    if (selectionMode) return;
    const now = Date.now();

    if (now - lastTap.current < 300) {
      onDoubleClick?.(type, itemId, item.name);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };
  return (
    <>
      <div
        className={`mlr-card ${selected ? "selected" : ""}`}
        data-id={itemId}
        onClick={() => {
          if (selectionMode) {
            handleToggle(itemId); // selection mode: parent call nahi hoga
            return;
          }
          onDoubleClick?.(type, itemId, item.name);
        }}
        onContextMenu={(e) => {
          if (selectionMode) return;
          e.preventDefault();
          e.stopPropagation();
          setSelectedItems(new Set([itemId])); // long press: sirf yeh file select
          setSelectionMode(true);
        }}
      >
        {/* icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
          {item.isDirectory ? (
            <IconFolder size={36} />
          ) : (
            <FileBadge size={36} type={iconType} />
          )}
        </div>

        {/* name + subtitle */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-(--text-primary)">
            {item.name}
          </div>
          <div className="flex items-center gap-1 text-[12px] text-(--text-secondary)">
            {starred && <StarIcon className="h-3 w-3 shrink-0" />}
            <span className="truncate">{subtitle}</span>
          </div>
        </div>

        {/* kebab / checkbox */}
        <button
          type="button"
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
          className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
        >
          {selectionMode ? (
            <div
              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center
    ${selected ? "bg-white" : "bg-transparent border-white"}`}
            >
              {selected && (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-black">
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
            </div>
          ) : (
            <IconDots className="h-6 w-6" />
          )}
        </button>
      </div>
    </>
  );
}
