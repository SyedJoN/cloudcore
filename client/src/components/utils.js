export function getFileType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
  if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) return "archive";
  if (["js", "jsx", "ts", "tsx", "html", "css", "py", "java", "go", "rs", "cpp", "c", "cs"].includes(ext)) return "code";
  return "alt";
}
export function getFileIcon(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext)) return "🖼️";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "🎬";
  if (["mp3", "wav", "ogg"].includes(ext)) return "🎵";
  if (["pdf"].includes(ext)) return "📕";
  if (["zip", "rar", "tar", "gz"].includes(ext)) return "📦";
  if (["js","jsx","ts","tsx","py","go","rs","css","html","json","md"].includes(ext)) return "💻";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  return "📄";
}
const AVATAR_COLORS = ["avatar-blue", "avatar-green", "avatar-red", "avatar-purple", "avatar-orange"];

export function getAvatarColor(email) {
  const hash = email.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const ROLE_LABEL = { viewer: "Viewer", editor: "Editor"};
export const ROLE_DESC  = { viewer: "Can view", editor: "Can edit" };