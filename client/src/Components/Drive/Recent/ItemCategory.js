import { getFileKind } from "../../../../Utils/fileKind";

const CATEGORY_BY_KIND = {
  folder: "folder",
  word: "document",
  text: "document",
  excel: "spreadsheet",
  ppt: "presentation",
  pdf: "pdf",
  image: "image",
  video: "video",
  audio: "audio",
  archive: "archive",
};
export const getItemCategory = (item) =>
  CATEGORY_BY_KIND[getFileKind(item)] ?? "other";

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
