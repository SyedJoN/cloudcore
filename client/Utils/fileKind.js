const MIME_RULES = [
  // google response
  [/^application\/vnd\.google-apps\.folder$/, "folder"],
  [/^application\/vnd\.google-apps\.document$/, "word"],
  [/^application\/vnd\.google-apps\.spreadsheet$/, "excel"],
  [/^application\/vnd\.google-apps\.presentation$/, "ppt"],

  [/^application\/pdf$/, "pdf"],

  [/wordprocessingml|^application\/msword$|opendocument\.text|^application\/rtf$|^text\/rtf$/, "word"],
  [/spreadsheetml|ms-excel|opendocument\.spreadsheet|^text\/csv$/, "excel"],
  [/presentationml|ms-powerpoint|opendocument\.presentation/, "ppt"],

  [/^image\//, "image"],
  [/^video\//, "video"],
  [/^audio\//, "audio"],

  [/zip|x-rar|vnd\.rar|x-tar|gzip|x-7z|x-bzip|x-xz/, "archive"],

  [/json|xml|javascript|typescript|x-sh|x-python|x-java|x-c|x-httpd-php|^text\/(html|css|x-.+)$/, "code"],
  [/^text\//, "text"],
];

const EXT_MAP = {
  pdf: "pdf",
  doc: "word", docx: "word", odt: "word", rtf: "word",
  xls: "excel", xlsx: "excel", ods: "excel", csv: "excel",
  ppt: "ppt", pptx: "ppt", odp: "ppt",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  svg: "image", bmp: "image", ico: "image", avif: "image",
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video", ogv: "video",
  mp3: "audio", wav: "audio", ogg: "audio", flac: "audio", aac: "audio", m4a: "audio",
  zip: "archive", rar: "archive", tar: "archive", gz: "archive", "7z": "archive", bz2: "archive",
  js: "code", jsx: "code", ts: "code", tsx: "code", html: "code", css: "code",
  py: "code", java: "code", go: "code", rs: "code", cpp: "code", c: "code", cs: "code",
  json: "code", yaml: "code", yml: "code", sh: "code", php: "code", rb: "code",
  swift: "code", kt: "code",
  txt: "text", md: "text",
};

const cleanMime = (item) =>
  String(item?.mimeType || item?.mimetype || item?.contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

    function kindFromMime(mime) {
  if (!mime) return null;
  for (const [re, kind] of MIME_RULES) if (re.test(mime)) return kind;
  return null;
}

export function extOf(item) {
  const stored = item?.extension ?? item?.ext;
  if (stored) return String(stored).replace(/^\./, "").toLowerCase();

  const name = item?.name || "";
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
}

function kindFromExt(ext) {
  return ext ? (EXT_MAP[ext] ?? null) : null;
}

export function getFileKind(item) {
  if (item?.isDirectory) return "folder";
  return kindFromMime(cleanMime(item)) ?? kindFromExt(extOf(item)) ?? "alt";
}


const CATEGORY_BY_KIND = {
  pdf: "pdf",
  word: "office-word",
  excel: "office-excel",
  ppt: "office-ppt",
  image: "image",
  video: "video",
  audio: "audio",
  code: "text",
  text: "text",
};

export const getItemCategory = (item) =>
  CATEGORY_BY_KIND[getFileKind(item)] ?? "unknown";

export const isLegacyWord = (item) =>
  /^application\/msword$|opendocument|rtf/.test(cleanMime(item)) ||
  /^(doc|odt|rtf)$/.test(extOf(item));