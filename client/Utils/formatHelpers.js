export const formatSize = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 ** 2) return `${(bytes / 1000).toFixed(1)} KB`;
  if (bytes < 1000 ** 3) return `${(bytes / 1000 ** 2).toFixed(1)} MB`;
  if (bytes < 1000 ** 4) return `${(bytes / 1000 ** 3).toFixed(1)} GB`;
  return `${(bytes / 1000 ** 4).toFixed(2)} TB`;
};