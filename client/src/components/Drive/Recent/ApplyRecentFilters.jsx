import { getItemCategory } from "./itemCategory";
import { getLastActivityTime } from "./recencyBuckets";

const DAY = 86400000;

function isWithinModifiedRange(ts, range) {
  if (range === "anytime") return true;

  const now = Date.now();
  const date = new Date(ts);
  const today = new Date();

  switch (range) {
    case "today":
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    case "last7":
      return now - ts <= 7 * DAY;
    case "last30":
      return now - ts <= 30 * DAY;
    case "thisYear":
      return date.getFullYear() === today.getFullYear();
    case "lastYear":
      return date.getFullYear() === today.getFullYear() - 1;
    default:
      return true;
  }
}

export const DEFAULT_RECENT_FILTERS = {
  types: new Set(),
  people: new Set(),
  modified: "anytime",
};

export function applyRecentFilters(items, filters, currentUser) {
  return items.filter((item) => {
    if (filters.types.size > 0 && !filters.types.has(getItemCategory(item))) {
      return false;
    }

    if (filters.people.size > 0) {
      const ownerKey = item.userId?._id || item.userId?.name || item.owners[0]?.permissionId;
      const isMine =
        (currentUser?._id && item.userId?._id === currentUser._id) ||
        (currentUser?.email && item.userId?.email === currentUser.email) || (item.owners?.[0].emailAddress === currentUser.email);

      const matchesMe = filters.people.has("me") && isMine;
      const matchesOwner = ownerKey && filters.people.has(ownerKey);

      if (!matchesMe && !matchesOwner) return false;
    }

    if (filters.modified !== "anytime") {
      const ts = getLastActivityTime(item);
      if (!ts || !isWithinModifiedRange(ts, filters.modified)) return false;
    }

    return true;
  });
}