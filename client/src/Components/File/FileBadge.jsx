const BADGE_MAP = {
  pdf:     { label: "PDF",  cls: "badge-pdf" },
  word:    { label: "W",    cls: "badge-word" },
  excel:   { label: "X",    cls: "badge-excel" },
  ppt:     { label: "P",    cls: "badge-ppt" },
  image:   { label: "IMG",  cls: "badge-image" },
  video:   { label: "VID",  cls: "badge-video" },
  audio:   { label: "AUD",  cls: "badge-audio" },
  code:    { label: "< >",  cls: "badge-code" },
  text:    { label: "TXT",  cls: "badge-text" },
  archive: { label: "ZIP",  cls: "badge-archive" },
  alt:     { label: "FILE", cls: "badge-alt" },
};

export default function FileBadge({ size, type }) {
  const { label, cls } = BADGE_MAP[type] || BADGE_MAP.alt;

  return (
    <span
      style={{
        width: size,
        height: size,
      }}
      className={`gd-file-badge ${cls}`}
    >
      {label}
    </span>
  );
}