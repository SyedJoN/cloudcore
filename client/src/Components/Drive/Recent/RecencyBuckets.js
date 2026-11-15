
const DAY = 86400000;

export function getLastActivityTime(item) {
  const modified = item.modifiedByMeTime
    ? new Date(item.modifiedByMeTime)?.getTime()
    : 0;
  const viewed = item.viewedByMeTime
    ? new Date(item.viewedByMeTime)?.getTime()
    : 0;
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

const FIXED_ORDER = [
  "Today",
  "Yesterday",
  "Earlier this week",
  "Last week",
  "Earlier this year",
];

export function bucketLabel(ts, now = new Date(), weekStartsOn = 1) {
  if (!ts) return "Older"; // time hai hi nahi (jaise kabhi khola nahi)

  const date = new Date(ts);
  const today = startOfDay(now);
  const day = startOfDay(date);
  
  const diffDays = Math.round((today - day) / DAY);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  // is hafte ki shuruaat (weekStartsOn: 0 = Sunday, 1 = Monday)
  const daysSinceWeekStart = (now.getDay() - weekStartsOn + 7) % 7;
  const weekStart = today - daysSinceWeekStart * DAY;

  if (day >= weekStart) return "Earlier this week";
  if (day >= weekStart - 7 * DAY) return "Last week";

  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear && date.getMonth() === now.getMonth()) return "Earlier this month";

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (
    date.getFullYear() === lastMonth.getFullYear() &&
    date.getMonth() === lastMonth.getMonth()
  ) {
    return "Last month";
  }

  if (sameYear) return "Earlier this year";
  if (date.getFullYear() === now.getFullYear() - 1) return "Last year";
  return "Older";
}
export function groupByTime(items, getTime) {
  const now = new Date();
  const groups = new Map();

  for (const item of items) {
    const label = bucketLabel(getTime(item), now);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }

  return Array.from(groups, ([label, groupItems]) => ({
    label,
    items: groupItems,
  }));
}

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
    .filter((b) => /^\d{4}$/.test(b)) // Only years i.e 4 digits (2026)
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
