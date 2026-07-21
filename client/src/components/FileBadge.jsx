const BADGE_MAP = {
  pdf:     { label: "PDF",  cls: "badge-pdf"     },
  image:   { label: "IMG",  cls: "badge-image"   },
  video:   { label: "VID",  cls: "badge-video"   },
  code:    { label: "< >",  cls: "badge-code"    },
  archive: { label: "ZIP",  cls: "badge-archive" },
  alt:     { label: "FILE", cls: "badge-alt"     },
};

export default function FileBadge({ type }) {
  const { label, cls } = BADGE_MAP[type] || BADGE_MAP.alt;
  return <span className={`gd-file-badge ${cls}`}>{label}</span>;
}