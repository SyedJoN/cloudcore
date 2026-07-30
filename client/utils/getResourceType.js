export const getResourceType = (item) => {
  const type = item.webViewLink
    ? item.isDirectory
      ? "google-drive-directory"
      : "google-drive-file"
    : item.isDirectory
      ? "folder"
      : "file";
  return type;
};
