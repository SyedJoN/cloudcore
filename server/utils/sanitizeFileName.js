export const sanitizeFilename = (name) => {
  return name
    .normalize("NFKD")
    .replace(/<[^>]*>/g, "")
    .replace(/[^\w.\- ]/g, "")
    .replace(/\.+/g, ".")
    .trim()
    .slice(0, 255);
};