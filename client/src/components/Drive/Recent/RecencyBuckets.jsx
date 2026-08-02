
export function getLastActivityTime(item) {
  const modified = item.modifiedTime ? new Date(item.modifiedTime).getTime() : 0;
  const viewed = item.viewedByMeTime ? new Date(item.viewedByMeTime).getTime() : 0;
  const ts = Math.max(modified, viewed);
  return ts > 0 ? ts : null;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function getRecencyBucket(timestamp) {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const now = new Date();

  const today = startOfDay(now);
  const itemDay = startOfDay(date);
  const dayDiff = Math.round((today - itemDay) / 86400000);

  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";

  const thisWeekStart = startOfWeek(now);
  if (itemDay >= thisWeekStart) return "Earlier this week";

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  if (itemDay >= lastWeekStart) return "Last week";

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  if (itemDay >= startOfYear) return "Earlier this year";

  return String(date.getFullYear());
}

const FIXED_ORDER = ["Today", "Yesterday", "Earlier this week", "Last week", "Earlier this year"];

export function groupItemsByRecency(items) {
  const buckets = new Map();

  const sorted = [...items].sort(
    (a, b) => (getLastActivityTime(b) ?? 0) - (getLastActivityTime(a) ?? 0),
  );

  for (const item of sorted) {
    const bucket = getRecencyBucket(getLastActivityTime(item));
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(item);
  }

  const known = FIXED_ORDER.filter((b) => buckets.has(b));
  const years = [...buckets.keys()]
    .filter((b) => /^\d{4}$/.test(b))
    .sort((a, b) => Number(b) - Number(a));
  const never = buckets.has("Never") ? ["Never"] : [];

  return [...known, ...years, ...never].map((label) => ({
    label,
    items: buckets.get(label),

  }));
}
export function groupItemsByType(items) {
  const buckets = new Map();

  for (const item of items) {
    const type = item.isDirectory ? "Folders" : "Files";

    if (!buckets.has(type)) {
      buckets.set(type, []);
    }

    buckets.get(type).push(item);
  }

  return ["Folders", "Files"]
    .filter((label) => buckets.has(label))
    .map((label) => ({
      label,
      items: buckets.get(label),
    }));
}
