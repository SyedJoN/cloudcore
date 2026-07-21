import { useEffect } from "react";
import { useState } from "react";

const BASE_URL = "http://localhost:4000";

// ── Colour + icon per file type ───────────────────────────────────────────────
const TYPE_META = {
  image:   { bg: "#e8f5e9", color: "#2e7d32", icon: "🖼️",  label: "IMAGE"   },
  video:   { bg: "#fce4ec", color: "#c62828", icon: "🎬",  label: "VIDEO"   },
  pdf:     { bg: "#fce8e6", color: "#d93025", icon: "📄",  label: "PDF"     },
  code:    { bg: "#e8eaf6", color: "#3949ab", icon: "💻",  label: "CODE"    },
  archive: { bg: "#fff8e1", color: "#f57f17", icon: "📦",  label: "ZIP"     },
  audio:   { bg: "#f3e5f5", color: "#6a1b9a", icon: "🎵",  label: "AUDIO"   },
  doc:     { bg: "#e3f2fd", color: "#1565c0", icon: "📝",  label: "DOC"     },
  sheet:   { bg: "#e8f5e9", color: "#1b5e20", icon: "📊",  label: "SHEET"   },
  slide:   { bg: "#fff3e0", color: "#e65100", icon: "📑",  label: "SLIDES"  },
  alt:     { bg: "#f1f3f4", color: "#5f6368", icon: "📎",  label: "FILE"    },
};

function getType(filename = "") {
  const ext = filename.split(".").pop().toLowerCase();
  if (["png","jpg","jpeg","gif","webp","svg","bmp","ico"].includes(ext))        return "image";
  if (["mp4","mov","avi","mkv","webm","ogv"].includes(ext))                     return "video";
  if (["pdf"].includes(ext))                                                    return "pdf";
  if (["zip","rar","tar","gz","7z","bz2"].includes(ext))                        return "archive";
  if (["mp3","wav","ogg","flac","aac","m4a"].includes(ext))                     return "audio";
  if (["doc","docx","odt","rtf","txt","md"].includes(ext))                      return "doc";
  if (["xls","xlsx","ods","csv"].includes(ext))                                 return "sheet";
  if (["ppt","pptx","odp"].includes(ext))                                       return "slide";
  if (["js","jsx","ts","tsx","html","css","py","java","go","rs","cpp","c","cs",
       "json","yaml","yml","sh","php","rb","swift","kt"].includes(ext))         return "code";
  return "alt";
}

// ── Fallback card shown for non-visual types ──────────────────────────────────
function IconCard({ type, name }) {
  const meta = TYPE_META[type] || TYPE_META.alt;
  const ext  = name?.split(".").pop().toUpperCase() || meta.label;

  return (
    <div style={{
      width: "100%", height: "100%",
      background: meta.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 6,
    }}>
      <span style={{ fontSize: 32, lineHeight: 1 }}>{meta.icon}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1,
        color: meta.color, fontFamily: "var(--font-main)",
        background: meta.color + "22",
        padding: "2px 7px", borderRadius: 4,
      }}>
        {ext.length <= 5 ? ext : meta.label}
      </span>
    </div>
  );
}

// ── Main preview component ────────────────────────────────────────────────────
export default function FilePreview({ item }) {
  const [imgError, setImgError] = useState(false);
  const type = getType(item.name);

  // Google Drive items have a thumbnailLink
 const gdriveThumbnail = (item.thumbnailLink || (item.hasThumbnail && item.id))
  ? `https://drive.google.com/thumbnail?id=${item.id}&sz=w220`
  : null;

  // Local image — served directly from the backend
  const localImageUrl = type === "image" && item._id
    ? `${BASE_URL}/file/${item._id}`
    : null;

  // Local video — show poster from first frame via video element
  const localVideoUrl = type === "video" && item._id
    ? `${BASE_URL}/file/${item._id}`
    : null;

  const thumbnailUrl = gdriveThumbnail || localImageUrl;

  // ── Image / GDrive thumbnail ─────────────────────────────────────────────
  if (thumbnailUrl && !imgError) {
    return (
      <img
        src={thumbnailUrl}
        alt={item.name}
        onError={() => setImgError(true)}
        style={{
          width: "100%", height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }

  // ── Local video — HTML5 video poster ────────────────────────────────────
  if (localVideoUrl) {
    return (
      <video
        src={localVideoUrl}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        muted preload="metadata"
        onError={() => {}}
      />
    );
  }

  // ── Everything else — styled icon card ──────────────────────────────────
  return <IconCard type={type} name={item.name} />;
}