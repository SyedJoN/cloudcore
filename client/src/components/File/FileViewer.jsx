import { useEffect } from "react";
import {
  IconClose,
  IconDownload,
  IconShare,
  IconTrash,
  IconRename,
} from "../Icons/Icons";
import "./FileViewer.css";
import UserAccountBar from "../UserAccountBar";
import {
  OfficeViewer,
  UnknownViewer,
  TextViewer,
  PDFViewer,
  AudioViewer,
  VideoViewer,
  ImageViewer,
} from "../Viewers";
import getCategory from "../../../Utils/getFileCategory";
import { useAuth } from "../../Contexts";
import getExt from "../../../Utils/getExtension";

const BASE_URL = "http://localhost:4000";

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
  const { user, refreshUser } = useAuth();

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

  useEffect(() => {
    refreshUser();
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
          {meta && <UserAccountBar />}
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
