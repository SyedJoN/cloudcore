import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { formatSize } from "../../../Utils/formatHelpers";
import FilePreview from "../File/FilePreview";
import { IconFolder, IconShare } from "../Icons/Icons";

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-6 px-6 py-3">
      <span className="shrink-0 text-[14px] text-(--text-secondary)">
        {label}
      </span>
      <span className="min-w-0 wrap-break-word text-right text-[14px] text-(--text-primary)">
        {children}
      </span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="px-6 pb-1 pt-5 text-[13px] font-medium text-(--text-secondary)">
      {children}
    </div>
  );
}

/*
  Full-screen details page (Google Drive app style):
  back arrow, takes over the whole screen, slides in from the right.
*/
export default function DetailsPageMobile({
  open,
  item,
  onClose,
  onShare,
  zIndex = 700, // above the viewer (500) and bottom sheets (600)
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const pageRef = useRef(null);

  // keep the last item so the page can slide out after the parent clears it
  const lastItem = useRef(item);
  if (item) lastItem.current = item;
  const shown = item || lastItem.current;

  // mount / unmount timing
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  // slide in: after it's in the DOM, before the browser paints
  useLayoutEffect(() => {
    if (!open || !mounted || visible) return;
    void pageRef.current?.getBoundingClientRect(); // commit the hidden position
    setVisible(true);
  }, [open, mounted]);

  if (!mounted || !shown) return null;

  const isDir = Boolean(shown.isDirectory);
  const ext = shown.name?.includes(".")
    ? shown.name.split(".").pop().toUpperCase()
    : "";

  const type = isDir ? "Folder" : ext ? `${ext} file` : "File";
  const owner = shown.owners?.[0]?.displayName;
  const modified = formatDate(shown.updatedAt || shown.modifiedTime);
  const created = formatDate(shown.createdAt || shown.createdTime);
  const isPublic = Boolean(shown.isPublic);

  return createPortal(
    <div
      ref={pageRef}
      className={`fixed inset-0 flex flex-col bg-(--surface-white) transition-transform duration-250 ease-out ${
        visible ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ zIndex }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex shrink-0 items-center gap-1 border-b border-(--border) px-1 pb-1"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
      >
        <button
          onClick={onClose}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>

        <div className="min-w-0 flex-1 truncate px-2 text-[18px] font-medium text-(--text-primary)">
          {shown.name}
        </div>
      </div>

      {/* ── Content ── */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Preview */}
        <div className="flex h-56 items-center justify-center overflow-hidden bg-black/5">
          {isDir ? (
            <IconFolder size={64} style={{ color: "#5f6368" }} />
          ) : (
            <FilePreview item={shown} />
          )}
        </div>

        {/* Info */}

        <Row label="Type">{type}</Row>
        <Row label="Size">{formatSize(shown.size) || "—"}</Row>
        {isDir && shown.itemCount != null && (
          <Row label="Items">{shown.itemCount}</Row>
        )}

        {/* Activity */}
        <SectionLabel>Activity</SectionLabel>
        <Row label="Modified">{modified}</Row>
        <Row label="Created">{created}</Row>
        <Row label="Owner">{owner || "—"}</Row>

        {/* Access */}
        <SectionLabel>Access</SectionLabel>
        <Row label="Visibility">
          {isPublic
            ? `${shown.publicRole || "viewer"} · public`
            : "Restricted"}
        </Row>

        {onShare && (
          <div className="px-6 pb-6 pt-4">
            <button
              onClick={() => {
                onClose();
                onShare(shown);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-(--border) py-2.5 text-[14px] font-medium text-(--text-primary) active:bg-black/5"
            >
              <IconShare size={16} />
              Manage access
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}