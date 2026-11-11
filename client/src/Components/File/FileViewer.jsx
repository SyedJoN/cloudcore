import { useEffect } from "react";
import {
  IconClose,
  IconDownload,
  IconShare,
  IconTrash,
  IconRename,
  IconLink,
  IconRestore,
} from "../Icons/Icons";
import "./FileViewer.css";
import UserAccountBar from "../UserAccountBar";
import { useLocation } from "react-router-dom";
import {
  OfficeViewer,
  DocxViewer,
  UnknownViewer,
  TextViewer,
  PDFViewer,
  AudioViewer,
  VideoViewer,
  ImageViewer,
} from "../Viewers";

import getCategory from "../../../Utils/getFileCategory";
import { useAuth, useToast } from "../../Contexts";
import getExt from "../../../Utils/getExtension";

import { StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { useDevice } from "../../Contexts/DeviceContext";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

const CATEGORY_COLORS = {
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

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const fmtSize = (bytes) => {
  const n = Number(bytes);
  if (!n) return "";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
};

export default function FileViewer({
  item: itemProp,
  onClose,
  onShare,
  onNavigate,
  isStarred,
  files = [],
  isSharedRoute,
  onTrash,
  onRename,
  onStar,
  onDownload,
  onRestore,
  onDeleteForever,
  onDeleteSuccess,
  meta = false,
}) {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const { device } = useDevice();
  const location = useLocation();

  const route = location.pathname.startsWith("/google-drive");
  const item = Array.isArray(itemProp) ? itemProp[0] : itemProp;

  // BASIC ITEM INFO
  const isGoogle = Boolean(item?.webViewLink);
  const isDeleted = item?.isDeleted;
  const category = getCategory(item?.name || "");
  const isGDrive = route && isGoogle;

  const fileUrl = isGDrive
    ? item?.webContentLink || item?.webViewLink
    : `${BASE_URL}/file/${item?._id}`;

  // CAPABILITIES
  const capabilities = item?.capabilities ?? {};
  const canRead = capabilities.canRead === true;
  const canShare = capabilities.canShare === true;
  const canDownload = capabilities.canDownload === true;
  const canRename = capabilities.canRename === true;
  const canTrash = capabilities.canTrash === true;
  const canDelete = capabilities.canDelete === true;

  // NAVIGATION
  const currentIndex = files.findIndex(
    (file) => String(file?._id ?? file?.id) === String(item?._id ?? item?.id),
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < files.length - 1;

  // KEYBOARD NAVIGATION
  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }
      if (event.key === "ArrowLeft" && hasPrev) {
        onNavigate?.(files[currentIndex - 1]);
        return;
      }
      if (event.key === "ArrowRight" && hasNext) {
        onNavigate?.(files[currentIndex + 1]);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, files, currentIndex, hasPrev, hasNext]);

  // LOCK BODY SCROLL
  useEffect(() => {
    document.body.classList.add("gd-overlay-open");
    return () => document.body.classList.remove("gd-overlay-open");
  }, []);

  // REFRESH USER
  useEffect(() => {
    refreshUser?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // COPY LINK
  const handleCopyLink = async () => {
    const url =
      item?.webViewLink ??
      (item?.isDirectory
        ? `${window.location.origin}/directory/${item?._id}?usp=drive_link`
        : `${window.location.origin}/file/${item?._id}?usp=drive_link`);

    try {
      await navigator.clipboard.writeText(url);
      toast({ message: "Link copied to clipboard", type: "success" });
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast({ message: "Failed to copy link", type: "error" });
    }
  };

  // VIEWER
  const renderViewer = () => {
    if (isGDrive) {
      return (
        <div className="fv-pdf-stage">
          <iframe
            className="fv-pdf-frame"
            src={`https://drive.google.com/file/d/${item?.id}/preview`}
            title={item?.name}
            allow="autoplay"
          />
        </div>
      );
    }

    switch (category) {
      case "image":
        return <ImageViewer url={fileUrl} name={item?.name} />;
      case "video":
        return <VideoViewer url={fileUrl} />;
      case "audio":
        return <AudioViewer url={fileUrl} name={item?.name} />;
      case "pdf":
        return <PDFViewer url={fileUrl} />;
      case "text":
        return <TextViewer url={fileUrl} name={item?.name} />;

      // sirf docx ke liye alag viewer
      case "office-word":
        return <DocxViewer key={item?._id} url={fileUrl} />;

      // excel / ppt: purana viewer, koi change nahi
      case "office-excel":
      case "office-ppt":
        return (
          <OfficeViewer BASE_URL={BASE_URL} item={item} category={category} />
        );

      default:
        return <UnknownViewer item={item} />;
    }
  };

  // ITEM CHECK (saare hooks ke baad)
  if (!item) return null;

  const ext = getExt(item.name || "").toUpperCase();
  const badgeColor = CATEGORY_COLORS[category] || "#5f6368";
  const createdDate = item.createdAt ?? item.createdTime;
  const modifiedDate = item.updatedAt ?? item.modifiedTime;

  return (
    <div className="fv-overlay z-500" onClick={onClose}>
      <div
        className={`fv-shell ${meta ? "fv-shell-full" : ""}`}
        onClick={(event) => event.stopPropagation()}
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

          {/* ── Previous / Next ── */}
          {files.length > 1 && (
            <div className="fv-nav-arrows">
              <button
                className="fv-nav-btn gd-icon-btn"
                onClick={() => hasPrev && onNavigate?.(files[currentIndex - 1])}
                disabled={!hasPrev}
                title="Previous (←)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <span className="fv-nav-count">
                {currentIndex + 1} / {files.length}
              </span>

              <button
                className="fv-nav-btn gd-icon-btn"
                onClick={() => hasNext && onNavigate?.(files[currentIndex + 1])}
                disabled={!hasNext}
                title="Next (→)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}

          {meta && <UserAccountBar />}
        </div>

        {/* ── Action bar ── */}
        {device === "windows" && (
          <div className="fv-topbar-actions">
            {!isDeleted && canDownload && (
              <button
                className="fv-action-btn gd-icon-btn"
                title="Download"
                onClick={() => onDownload?.(item)}
              >
                <IconDownload size={20} />
              </button>
            )}

            {!isDeleted && canShare && (
              <button
                className="fv-action-btn gd-icon-btn"
                title="Share"
                onClick={() => onShare?.(item)}
              >
                <IconShare size={20} />
              </button>
            )}

            {!isGoogle && (
              <button
                className="fv-action-btn gd-icon-btn"
                title="Star"
                onClick={() => onStar?.(item)}
              >
                {isStarred?.[item._id || ""] ? (
                  <StarIconSolid className="w-5 h-5" />
                ) : (
                  <StarIcon className="w-5 h-5" />
                )}
              </button>
            )}

            {!isDeleted && canRead && (
              <button
                className="fv-action-btn gd-icon-btn"
                title="Copy link"
                onClick={handleCopyLink}
              >
                <IconLink size={20} />
              </button>
            )}

            {!isDeleted && canRename && (
              <button
                className="fv-action-btn gd-icon-btn"
                title="Rename"
                onClick={() => onRename?.(item)}
              >
                <IconRename size={20} />
              </button>
            )}

            {/* Move local item to trash */}
            {!isGDrive && !isDeleted && canTrash && (
              <button
                className="fv-action-btn gd-icon-btn fv-action-danger"
                title="Move to trash"
                onClick={async () => {
                  await onTrash?.(item);
                  onDeleteSuccess?.(item._id);
                  onClose?.();
                }}
              >
                <IconTrash size={20} />
              </button>
            )}

            {/* Restore */}
            {isDeleted && canDelete && (
              <button
                className="fv-action-btn gd-icon-btn"
                title="Restore"
                onClick={() => onRestore?.(item)}
              >
                <IconRestore size={20} />
              </button>
            )}

            {/* Delete forever (trash ya Google Drive file) */}
            {canDelete && (isDeleted || isGDrive) && (
              <button
                className="fv-action-btn gd-icon-btn fv-action-danger"
                title="Delete Forever"
                onClick={() => onDeleteForever?.(item)}
              >
                <IconTrash size={20} />
              </button>
            )}

            {/* Open in Google Drive */}
            {isGDrive && item.webViewLink && (
              <a
                className="fv-action-btn gd-icon-btn"
                href={item.webViewLink}
                target="_blank"
                rel="noreferrer"
                title="Open in Google Drive"
              >
                <svg viewBox="0 0 87.3 78" width="20" height="20">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47" />
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* ── Viewer area ── */}
        <div className={`fv-body ${meta ? "fv-body-full" : ""}`}>
          {renderViewer()}
        </div>

        {/* ── Bottom info bar ── */}
        <div className={`fv-infobar ${meta ? "fv-infobar-full" : ""}`}>
          <span className="fv-info-item">{fmtSize(item.size)}</span>

          {createdDate && (
            <span className="fv-info-item">Created {fmtDate(createdDate)}</span>
          )}

          {modifiedDate && (
            <span className="fv-info-item">
              Modified {fmtDate(modifiedDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}