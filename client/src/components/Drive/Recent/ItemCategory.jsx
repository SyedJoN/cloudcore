const EXTENSION_MAP = {
  doc: "document", docx: "document", txt: "document", rtf: "document", odt: "document",
  xls: "spreadsheet", xlsx: "spreadsheet", csv: "spreadsheet", ods: "spreadsheet",
  ppt: "presentation", pptx: "presentation", odp: "presentation",
  pdf: "pdf",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", bmp: "image", heic: "image",
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video",
  mp3: "audio", wav: "audio", flac: "audio", m4a: "audio", ogg: "audio",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
};

export function getItemCategory(item) {
  if (item.isDirectory) return "folder";
  const ext = (item.name || "").split(".").pop()?.toLowerCase();
  return EXTENSION_MAP[ext] || "other";
}

export const CATEGORY_LABELS = {
  folder: "Folders",
  document: "Documents",
  spreadsheet: "Spreadsheets",
  presentation: "Presentations",
  pdf: "PDFs",
  image: "Photos & images",
  video: "Videos",
  audio: "Audio",
  archive: "Archives",
  other: "Other",
};