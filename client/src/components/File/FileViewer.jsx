import { useEffect, useState, useRef, useCallback } from "react";
import {
  IconClose,
  IconDownload,
  IconShare,
  IconTrash,
  IconRename,
  IconChevronDown,
} from "../Icons/Icons";
import "./FileViewer.css";
import { useParams } from "react-router-dom";
import UserAccountBar from "../UserAccountBar";
import { getCurrentUser } from "../../../apis/userApi";

const BASE_URL = "http://localhost:4000";

// ─── helpers ────────────────────────────────────────────────────────────────
function getExt(name = "") {
  return name.split(".").pop().toLowerCase();
}

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

// Syntax highlight token types for text/code
const KEYWORDS = new Set([
  "import",
  "export",
  "from",
  "default",
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "new",
  "class",
  "extends",
  "super",
  "this",
  "typeof",
  "instanceof",
  "null",
  "undefined",
  "true",
  "false",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "throw",
  "of",
  "in",
  "=>",
  "static",
  "get",
  "set",
  "def",
  "print",
  "elif",
  "pass",
  "lambda",
  "with",
  "as",
  "not",
  "and",
  "or",
  "is",
  "None",
  "True",
  "False",
]);

function tokenizeLine(line) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    // String
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", text: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Comment
    if (line[i] === "/" && line[i + 1] === "/") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }
    if (line[i] === "#") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }
    // Number
    if (/\d/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\d.]/.test(line[j])) j++;
      tokens.push({ type: "number", text: line.slice(i, j) });
      i = j;
      continue;
    }
    // Word / keyword
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\w$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      tokens.push({
        type: KEYWORDS.has(word) ? "keyword" : "ident",
        text: word,
      });
      i = j;
      continue;
    }
    // Punctuation / operator
    tokens.push({ type: "punct", text: line[i] });
    i++;
  }
  return tokens;
}

function CodeLine({ line, num }) {
  const tokens = tokenizeLine(line);
  return (
    <div className="fv-code-line">
      <span className="fv-line-num">{num}</span>
      <span className="fv-line-content">
        {tokens.map((t, i) => (
          <span key={i} className={`fv-tok fv-tok-${t.type}`}>
            {t.text}
          </span>
        ))}
        {tokens.length === 0 && "\u00a0"}
      </span>
    </div>
  );
}

// ─── sub-viewers ────────────────────────────────────────────────────────────

function ImageViewer({ url, name }) {
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom((z) => Math.min(5, Math.max(0.1, z - e.deltaY * 0.001)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onMouseDown = (e) => {
    setDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onMouseMove = useCallback(
    (e) => {
      if (!drag) return;
      setOffset({ x: e.clientX - drag.x, y: e.clientY - drag.y });
    },
    [drag],
  );
  const onMouseUp = () => setDrag(null);

  return (
    <div
      ref={stageRef}
      className="fv-image-stage"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ cursor: drag ? "grabbing" : zoom > 1 ? "grab" : "default" }}
    >
      <img
        ref={imgRef}
        src={url}
        alt={name}
        className="fv-image"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transition: drag ? "none" : "transform 0.15s ease",
        }}
        draggable={false}
      />
      <div className="fv-zoom-controls">
        <button
          className="fv-zoom-btn"
          onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
        >
          +
        </button>
        <span className="fv-zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          className="fv-zoom-btn"
          onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
        >
          −
        </button>
        <button
          className="fv-zoom-btn"
          onClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
          title="Reset"
        >
          ⊙
        </button>
      </div>
    </div>
  );
}

function VideoViewer({ url }) {
  return (
    <div className="fv-video-stage">
      <video className="fv-video" controls autoPlay={true} preload="metadata">
        <source src={url} />
        Your browser does not support video playback.
      </video>
    </div>
  );
}

function AudioViewer({ url, name }) {
  return (
    <div className="fv-audio-stage">
      <div className="fv-audio-art">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ color: "#1a73e8", opacity: 0.7 }}
        >
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
        </svg>
      </div>
      <p className="fv-audio-name">{name}</p>
      <audio className="fv-audio" controls src={url} />
    </div>
  );
}

function PDFViewer({ url }) {
  return (
    <div className="fv-pdf-stage">
      <iframe
        className="fv-pdf-frame"
        src={`${url}#toolbar=1&navpanes=0&scrollbar=1`}
        title="PDF Viewer"
      />
    </div>
  );
}

function TextViewer({ url, name }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");
  const ext = getExt(name);
  const isCode = !["txt", "md", "log", "csv"].includes(ext);
  const isMarkdown = ext === "md";
  const isCSV = ext === "csv";

  useEffect(() => {
  
    fetch(url, { credentials: "include" })
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setError("Could not load file."));
  }, [url]);

  if (error) return <div className="fv-text-error">{error}</div>;
  if (content === null)
    return (
      <div className="fv-text-loading">
        <div className="fv-spinner" />
      </div>
    );

  if (isCSV) {
    const rows = content
      .trim()
      .split("\n")
      .map((r) => r.split(","));
    return (
      <div className="fv-csv-stage">
        <table className="fv-csv-table">
          <thead>
            <tr>
              {rows[0]?.map((h, i) => (
                <th key={i}>{h.replace(/^"|"$/g, "")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell.replace(/^"|"$/g, "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isCode) {
    const lines = content.split("\n");
    return (
      <div className="fv-code-stage">
        <div className="fv-code-lang">{ext.toUpperCase()}</div>
        <div className="fv-code-block">
          {lines.map((line, i) => (
            <CodeLine key={i} line={line} num={i + 1} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fv-text-stage">
      <pre className="fv-text-content">{content}</pre>
    </div>
  );
}

function OfficeViewer({ item, category }) {
  const fileUrl = `${BASE_URL}/file/${item._id}`;
  // Try Microsoft Office Online viewer (requires publicly accessible URL — show fallback)
  const [useMicrosoft] = useState(false); // set true if your server is public

  const appMap = {
    "office-word": "Word",
    "office-excel": "Excel",
    "office-ppt": "PowerPoint",
  };
  const iconMap = {
    "office-word": { color: "#185abd", label: "DOCX" },
    "office-excel": { color: "#107c41", label: "XLSX" },
    "office-ppt": { color: "#c43e1c", label: "PPTX" },
  };
  const info = iconMap[category] || { color: "#5f6368", label: "FILE" };

  if (useMicrosoft) {
    const encoded = encodeURIComponent(fileUrl);
    return (
      <div className="fv-office-stage">
        <iframe
          className="fv-pdf-frame"
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`}
          title={appMap[category]}
        />
      </div>
    );
  }

  return (
    <div className="fv-unknown-stage">
      <div className="fv-unknown-icon" style={{ background: info.color }}>
        {info.label}
      </div>
      <p className="fv-unknown-name">{item.name}</p>
      <p className="fv-unknown-hint">
        Office files can't be previewed directly.
        <br />
        Download the file to open it in {appMap[category]}.
      </p>
      <a
        href={fileUrl}
        download={item.name}
        className="fv-unknown-download-btn"
      >
        <IconDownload size={16} /> Download to view
      </a>
    </div>
  );
}

function UnknownViewer({ item }) {
  const ext = getExt(item.name);
  return (
    <div className="fv-unknown-stage">
      <div className="fv-unknown-icon" style={{ background: "#5f6368" }}>
        {ext.toUpperCase() || "FILE"}
      </div>
      <p className="fv-unknown-name">{item.name}</p>
      <p className="fv-unknown-hint">
        No preview available for this file type.
      </p>
      <a
        href={`${BASE_URL}/file/${item._id}`}
        download={item.name}
        className="fv-unknown-download-btn"
      >
        <IconDownload size={16} /> Download file
      </a>
    </div>
  );
}

// ─── main FileViewer ─────────────────────────────────────────────────────────

export default function FileViewer({
  item,
  onClose,
  onShare,
  onNavigate,
  files = [],
  isSharedRoute,
  onSoftDelete,
  onRename,
  onDownload,
  onDeleteSuccess,
  meta = false,
}) {
  const [user, setUser] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);

  const category = getCategory(item?.name || "");
  const isGDrive = !!item?.webViewLink;
  const fileUrl = isGDrive
    ? item.webContentLink || item.webViewLink
    : `${BASE_URL}/file/${item?._id}`;

  const currentIndex = files?.findIndex(
    (f) => (f._id ?? f.id) === (item._id ?? item.id),
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < files.length - 1;

  const isEditorOrOwner =
    !!user.name &&
    !isGDrive &&
    !isSharedRoute &&
    (item.publicRole === "editor" ||
      item.userRole === "owner" ||
      item.userRole === "editor");
  console.log("!isSharedRoute", isEditorOrOwner);
  // ✅ keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(files[currentIndex - 1]);
      if (e.key === "ArrowRight" && hasNext)
        onNavigate(files[currentIndex + 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, currentIndex, hasPrev, hasNext]);

  // Lock body scroll
  useEffect(() => {
    document.body.classList.add("gd-overlay-open");
    return () => document.body.classList.remove("gd-overlay-open");
  }, []);

  if (!item) return null;

  const renderViewer = (isGDrive) => {
    if (isGDrive) {
      // For Google Drive files, embed their viewer
      return (
        <div className="fv-pdf-stage">
          <iframe
            className="fv-pdf-frame"
            src={`https://drive.google.com/file/d/${item.id}/preview`}
            title={item.name}
            allow="autoplay"
          />
        </div>
      );
    }
    switch (category) {
      case "image":
        return <ImageViewer url={fileUrl} name={item.name} />;
      case "video":
        return <VideoViewer url={fileUrl} />;
      case "audio":
        return <AudioViewer url={fileUrl} name={item.name} />;
      case "pdf":
        return <PDFViewer url={fileUrl} />;
      case "text":
        return <TextViewer url={fileUrl} name={item.name} />;
      case "office-word":
      case "office-excel":
      case "office-ppt":
        return <OfficeViewer item={item} category={category} />;
      default:
        return <UnknownViewer item={item} />;
    }
  };

  const ext = getExt(item.name).toUpperCase();
  const categoryColors = {
    image: "#34a853",
    video: "#fbbc04",
    audio: "#1a73e8",
    pdf: "#ea4335",
    text: "#5f6368",
    "office-word": "#185abd",
    "office-excel": "#107c41",
    "office-ppt": "#c43e1c",
    unknown: "#5f6368",
  };
  const badgeColor = categoryColors[category] || "#5f6368";

  const getUser = async () => {
    try {
      const data = await getCurrentUser();
      setUser({
        name: data.name || "",
        avatar: data.avatar,
        email: data.email || "",
        role: data.role || "",
      });
      setLoggedIn(true);
    } catch (error) {
      setLoggedIn(false);
    }
  };

  useEffect(() => {
    getUser();
  }, []);

  return (
    <div className="fv-overlay" onClick={onClose}>
      <div
        className={`fv-shell ${meta ? "fv-shell-full" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top bar ── */}
        <div className={`fv-topbar ${meta ? "fv-topbar-full" : ""}`}>
          <div className="fv-topbar-left">
            {!meta && (
              <button
                className="fv-close-btn gd-icon-btn"
                onClick={onClose}
                title="Close (Esc)"
              >
                <IconClose size={20} />
              </button>
            )}
            <span className="fv-ext-badge" style={{ background: badgeColor }}>
              {ext || "FILE"}
            </span>
            <span className="fv-filename" title={item.name}>
              {item.name}
            </span>
          </div>

          {/* ✅ prev/next arrows */}
          {files.length > 1 && (
            <div className="fv-nav-arrows">
              <button
                className="fv-nav-btn gd-icon-btn"
                onClick={() => hasPrev && onNavigate(files[currentIndex - 1])}
                disabled={!hasPrev}
                title="Previous (←)"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="fv-nav-count">
                {currentIndex + 1} / {files.length}
              </span>
              <button
                className="fv-nav-btn gd-icon-btn"
                onClick={() => hasNext && onNavigate(files[currentIndex + 1])}
                disabled={!hasNext}
                title="Next (→)"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
          {meta && (
            <UserAccountBar
              loggedIn={loggedIn}
              setLoggedIn={setLoggedIn}
              user={user}
              setUser={setUser}
            />
          )}
        </div>
        {/* ── Action bar ── */}
        <div className="fv-topbar-actions">
          {!isGDrive && (
            <button
              className="fv-action-btn gd-icon-btn"
              title="Download"
              onClick={() => onDownload?.(item)}
            >
              <IconDownload size={20} />
            </button>
          )}
          {isEditorOrOwner && (
            <button
              className="fv-action-btn gd-icon-btn"
              title="Share"
              onClick={() => onShare?.(item)}
            >
              <IconShare size={20} />
            </button>
          )}

          {isEditorOrOwner && (
            <button
              className="fv-action-btn gd-icon-btn"
              title="Rename"
              onClick={() => onRename?.(item)}
            >
              <IconRename size={20} />
            </button>
          )}
          {isEditorOrOwner && (
            <button
              className="fv-action-btn gd-icon-btn fv-action-danger"
              title="Delete"
              onClick={async () => {
                await onSoftDelete?.(item);
                onDeleteSuccess?.(item._id);
                onClose();
              }}
            >
              <IconTrash size={20} />
            </button>
          )}
          {isGDrive && (
            <a
              className="fv-action-btn gd-icon-btn"
              href={item.webViewLink}
              target="_blank"
              rel="noreferrer"
              title="Open in Google Drive"
            >
              <svg viewBox="0 0 87.3 78" width="20" height="20">
                <path
                  d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
                  fill="#0066da"
                />
                <path
                  d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
                  fill="#00ac47"
                />
                <path
                  d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
                  fill="#ea4335"
                />
                <path
                  d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
                  fill="#00832d"
                />
                <path
                  d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
                  fill="#2684fc"
                />
                <path
                  d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
                  fill="#ffba00"
                />
              </svg>
            </a>
          )}
        </div>
        {/* ── Viewer area ── */}
        <div className={`fv-body ${meta ? "fv-body-full" : ""}`}>
          {renderViewer(isGDrive)}
        </div>

        {/* ── Bottom info bar ── */}
        <div className={`fv-infobar ${meta ? "fv-infobar-full" : ""}`}>
          <span className="fv-info-item">
            {item.size
              ? item.size > 1024 * 1024
                ? `${(item.size / 1024 / 1024).toFixed(1)} MB`
                : `${(item.size / 1024).toFixed(1)} KB`
              : ""}
          </span>
          {item.updatedAt && (
            <span className="fv-info-item">
              Modified{" "}
              {new Date(item.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
          {item.modifiedTime && (
            <span className="fv-info-item">
              Modified{" "}
              {new Date(item.modifiedTime).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
