import { EllipsisVerticalIcon, StarIcon } from "@heroicons/react/24/solid";
import { IconFolder } from "../Icons/Icons";
import FileBadge from "../File/FileBadge";
import { getFileType } from "../../../Utils/displayUtils";
import { useAuth, useGDrive } from "../../Contexts";
import { Divider } from "../Divider";
import { useRef } from "react";

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
    const now = Date.now();

    if (now - lastTap.current < 300) {
      onDoubleClick?.(type, itemId, item.isDeleted);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };
  return (
    <>
      <div
        className={`gd-mobile-list-row flex items-center gap-3 pr-1.5 active:bg-black/5 ${selected ? "selected" : ""} ${
          selected ? "bg-black/5" : ""
        }` }
        data-id={itemId}
        onClick={() => onRowClick?.(type, itemId, item.isDeleted)}
        onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
  e.preventDefault();
  onSelect?.(itemId);
  onContextMenu?.(e, itemId);
}}
      >
        {/* icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
          {item.isDirectory ? (
            <IconFolder size={28} />
          ) : (
            <FileBadge size={28} type={iconType} />
          )}
        </div>

        {/* name + subtitle */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-(--text-primary)">
            {item.name}
          </div>
          <div className="flex items-center gap-1 text-[12px] text-(--text-secondary)">
            {starred && <StarIcon className="h-3 w-3 shrink-0" />}
            <span className="truncate">{subtitle}</span>
          </div>
        </div>

        {/* kebab */}
        <button
          type="button"
          aria-label="More actions"
          
          onClick={(e) => {
            e.preventDefault();
            onSelect?.(itemId);
            onContextMenu?.(e, itemId);
          }}
          className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
        >
          <EllipsisVerticalIcon className="h-6 w-6" />
        </button>
        
      </div>
      <Divider fullWidth={true} />
    </>
  );
}
