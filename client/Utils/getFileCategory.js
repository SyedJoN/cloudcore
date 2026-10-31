import getExt from "./getExtension";

function getCategory(name = "") {
  const ext = getExt(name);
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext))
    return "image";
  if (["mp4", "webm", "ogg", "mov", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) return "audio";
  if (["pdf"].includes(ext)) return "pdf";
  if (
    [
      "txt",
      "md",
      "csv",
      "log",
      "env",
      "yaml",
      "yml",
      "toml",
      "xml",
      "json",
      "js",
      "jsx",
      "ts",
      "tsx",
      "css",
      "scss",
      "html",
      "htm",
      "py",
      "rb",
      "java",
      "c",
      "cpp",
      "h",
      "go",
      "rs",
      "php",
      "sh",
      "bash",
    ].includes(ext)
  )
    return "text";
  if (["doc", "docx"].includes(ext)) return "office-word";
  if (["xls", "xlsx"].includes(ext)) return "office-excel";
  if (["ppt", "pptx"].includes(ext)) return "office-ppt";
  return "unknown";
}

export default getCategory;