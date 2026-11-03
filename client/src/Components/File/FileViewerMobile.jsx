import { useEffect, useRef, useState } from "react";
import {
  IconDownload,
  IconShare,
  IconTrash,
  IconRename,
  IconLink,
  IconRestore,
} from "../Icons/Icons";
import "./FileViewer.css"; // viewers (fv-pdf-stage etc.) still rely on these styles
import UserAccountBar from "../UserAccountBar";
import { useLocation } from "react-router-dom";
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
import { useAuth, useToast } from "../../Contexts";

import {
  ChevronLeftIcon,
    InformationCircleIcon,
  EllipsisVerticalIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { BottomSheet, SheetItem } from "../Drive/BottomSheet";
import DetailsPageMobile from "../Drive/DetailsPageMobile";
import { Divider } from "../Divider";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

function formatSize(size) {
  if (!size) return "";
  return size > 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${(size / 1024).toFixed(1)} KB`;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}


export default function FileViewerMobile({
  item,
  onClose,
  onShare,
  onNavigate,
  isStarred = {},
  files = [],
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
  const location = useLocation();

  const [sheetOpen, setSheetOpen] = useState(false);

  // slider state
  const viewerRef = useRef(null);
  const gesture = useRef(null);
  const pendingDir = useRef(0); // +1 next, -1 previous, 0 snap back
  const sliding = useRef(false);

  const [offset, setOffset] = useState(0); // live drag distance in px
  const [animating, setAnimating] = useState(false);

  const route = location.pathname.startsWith("/google-drive");

    // details sheet
    const [detailsItem, setDetailsItem] = useState(null);
  
    const detailsSheet = (
      <DetailsPageMobile
        open={Boolean(detailsItem)}
        item={detailsItem}
        onClose={() => setDetailsItem(null)}
        onShare={onShare}
      />
    );
  

  /* ---------- item info ---------- */

  const isGoogle = Boolean(item?.webViewLink);
  const isDeleted = Boolean(item?.isDeleted);
  const isGDrive = route && isGoogle;
  const category = getCategory(item?.name || "");

  const fileUrl = isGDrive
    ? item?.webContentLink || item?.webViewLink
    : `${BASE_URL}/file/${item?._id}`;

  /* ---------- capabilities ---------- */

  const capabilities = item?.capabilities ?? {};
  const canRead = capabilities.canRead === true;
  const canShare = capabilities.canShare === true;
  const canDownload = capabilities.canDownload === true;
  const canRename = capabilities.canRename === true;
  const canTrash = capabilities.canTrash === true;
  const canDelete = capabilities.canDelete === true;

  /* ---------- prev / next ---------- */

  const currentIndex = files.findIndex(
    (file) => String(file?._id ?? file?.id) === String(item?._id ?? item?.id),
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < files.length - 1;

  const prevFile = hasPrev ? files[currentIndex - 1] : null;
  const nextFile = hasNext ? files[currentIndex + 1] : null;

  /* ---------- finger-following slider ---------- */

  const getWidth = () => viewerRef.current?.clientWidth || window.innerWidth;

  // finish the slide: swap the file and reset the track with no animation
  const finishSlide = () => {
    if (!sliding.current) return;
    sliding.current = false;

    const dir = pendingDir.current;
    pendingDir.current = 0;

    if (dir) onNavigate?.(files[currentIndex + dir]);

    setAnimating(false);
    setOffset(0);
  };

  const slideTo = (dir) => {
    if (sliding.current) return;
    if ((dir > 0 && !hasNext) || (dir < 0 && !hasPrev)) return;

    sliding.current = true;
    pendingDir.current = dir;
    setAnimating(true);
    setOffset(-dir * getWidth());
  };

  const snapBack = () => {
    if (offset === 0) return;
    sliding.current = true;
    pendingDir.current = 0;
    setAnimating(true);
    setOffset(0);
  };

  const handleTouchStart = (e) => {
    if (
      sliding.current ||
      e.touches.length > 1 ||
      e.target.closest("video, audio, input")
    ) {
      gesture.current = null;
      return;
    }
    const t = e.touches[0];
    gesture.current = {
      x: t.clientX,
      y: t.clientY,
      lastX: t.clientX,
      lastT: performance.now(),
      vx: 0,
      axis: null,
    };
  };

  const handleTouchMove = (e) => {
    const g = gesture.current;
    if (!g) return;

    // second finger = pinch zoom, cancel the slide
    if (e.touches.length > 1) {
      gesture.current = null;
      setOffset(0);
      return;
    }

    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;

    // decide direction once: horizontal = slide, vertical = content scrolls
    if (g.axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (g.axis === "y") return;

    const now = performance.now();
    const dt = now - g.lastT;
    if (dt > 0) g.vx = (t.clientX - g.lastX) / dt; // px/ms
    g.lastX = t.clientX;
    g.lastT = now;

    // rubber-band when there is nothing further in that direction
    const blocked = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
    setOffset(blocked ? dx * 0.3 : dx);
  };

  const handleTouchEnd = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== "x") return;

    const dir = offset < 0 ? 1 : -1;
    const canGo = dir === 1 ? hasNext : hasPrev;

    const farEnough = Math.abs(offset) > getWidth() * 0.25;
    const flicked =
      Math.abs(g.vx) > 0.5 && Math.sign(g.vx) === Math.sign(offset);

    if (canGo && (farEnough || flicked)) slideTo(dir);
    else snapBack();
  };

  // lightweight neighbour pane: real image, or a name card for heavy types
  const renderNeighbor = (file) => {
    if (!file) return null;

    const cat = getCategory(file.name || "");
    const isGDriveFile = route && Boolean(file.webViewLink);

    if (cat === "image" && !isGDriveFile) {
      return (
        <ImageViewer url={`${BASE_URL}/file/${file._id}`} name={file.name} />
      );
    }

    return (
      <div className="flex h-full items-center justify-center px-8">
        <span className="truncate text-[15px] font-medium text-(--text-primary)">
          {file.name}
        </span>
      </div>
    );
  };

  /* ---------- effects ---------- */

  // safety net in case transitionend never fires
  useEffect(() => {
    if (!animating) return;
    const t = setTimeout(finishSlide, 400);
    return () => clearTimeout(t);
  }, [animating]);

  useEffect(() => {
    document.body.classList.add("gd-overlay-open");
    return () => document.body.classList.remove("gd-overlay-open");
  }, []);

  useEffect(() => {
    refreshUser?.();
  }, []);

  // close the sheet whenever the file changes
  useEffect(() => {
    setSheetOpen(false);
  }, [item?._id, item?.id]);

  /* ---------- everything below needs an item ---------- */
    if (!item) return detailsSheet;


  if (!item) return null;

  const starred = Boolean(isStarred[item._id]);
  /* ---------- actions ---------- */

  // run action, then close the sheet
  const run =
    (action) =>
    (...args) => {
      setSheetOpen(false);
      action?.(...args);
    };

  async function handleCopyLink() {
    const url =
      item.webViewLink ??
      (item.isDirectory
        ? `${window.location.origin}/directory/${item._id}?usp=drive_link`
        : `${window.location.origin}/file/${item._id}?usp=drive_link`);

    try {
      await navigator.clipboard.writeText(url);
      toast({ message: "Link copied to clipboard", type: "success" });
      setSheetOpen(false);
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast({ message: "Failed to copy link", type: "error" });
    }
  }

  async function handleTrash() {
    await onTrash?.();
    onDeleteSuccess?.(item._id);
    onClose?.();
  }

  /* ---------- viewer ---------- */

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
      case "office-word":
      case "office-excel":
      case "office-ppt":
        return <OfficeViewer item={item} category={category} />;
      default:
        return <UnknownViewer item={item} />;
    }
  };

  /* ---------- render ---------- */

  return (
    <>
    <div className="fixed inset-0 z-500 flex flex-col bg-(--surface-white)">
      {/* ── Top bar ── */}
      <div
        className="flex shrink-0 items-center gap-1 px-1 pb-1"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
      >
        {!meta && (
          <button
            onClick={onClose}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
        )}

        <div className="min-w-0 flex-1 px-2">
          <div
            className="truncate text-[16px] font-medium text-(--text-primary)"
            title={item.name}
          >
            {item.name}
          </div>
        </div>

        {meta && <UserAccountBar />}

        <button
          onClick={() => setSheetOpen(true)}
          aria-label="More actions"
          className="flex h-11 w-11 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
        >
          <EllipsisVerticalIcon className="h-6 w-6" />
        </button>
      </div>

      {/* ── Viewer: previous | current | next, follows the finger ── */}
      <div
        ref={viewerRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: "pan-y pinch-zoom" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          onTransitionEnd={(e) =>
            e.target === e.currentTarget && finishSlide()
          }
          style={{
            display: "flex",
            width: "300%",
            height: "100%",
            transform: `translateX(calc(-33.3333% + ${offset}px))`,
            transition: animating
              ? "transform 260ms cubic-bezier(0.22, 0.8, 0.3, 1)"
              : "none",
            willChange: "transform",
          }}
        >
          {/* previous */}
          <div
            className="pointer-events-none relative h-full overflow-hidden bg-(--surface-white)"
            style={{ flex: "0 0 33.3333%" }}
            aria-hidden="true"
          >
            {renderNeighbor(prevFile)}
          </div>

          {/* current */}
          <div
            className="relative h-full overflow-hidden bg-(--surface-white)"
            style={{ flex: "0 0 33.3333%" }}
          >
            {renderViewer()}
          </div>

          {/* next */}
          <div
            className="pointer-events-none relative h-full overflow-hidden bg-(--surface-white)"
            style={{ flex: "0 0 33.3333%" }}
            aria-hidden="true"
          >
            {renderNeighbor(nextFile)}
          </div>
        </div>
      </div>

      {/* ── Actions sheet ── */}
      <BottomSheet
        zIndex={600}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={item.name}
      >

        <div className="max-h-[65vh] overflow-y-auto py-2">
          {/* Deleted item: restore / delete forever */}
          {isDeleted ? (
            canDelete && (
              <>
                <SheetItem
                  icon={<IconRestore size={22} />}
                  label="Restore"
                  onClick={run(() => onRestore?.())}
                  
                />
                <SheetItem
                  icon={<IconTrash size={22} />}
                  label="Delete forever"
                  onClick={run(() => onDeleteForever?.())}
                />
              </>
            )
          ) : (
            <>
              {canShare && (
                <SheetItem
                  icon={<IconShare size={22} />}
                  label="Share"
                  onClick={run(() => onShare?.())}
                />
              )}

              {canRead && (
                <SheetItem
                  icon={<IconLink size={22} />}
                  label="Copy link"
                  onClick={handleCopyLink}
                />
              )}

              {(canShare || canRead) && <Divider />}

               <SheetItem
  icon={<InformationCircleIcon className="h-6 w-6" />}
  label="View Information"
  onClick={() => {
    setDetailsItem(item);
    setSheetOpen(false); // close only the actions sheet, not the viewer
  }}
/>
              <Divider />

              {canDownload && (
                <SheetItem
                  icon={<IconDownload size={22} />}
                  label="Download"
                  onClick={run(() => onDownload?.(item))}
                />
              )}

              {canRename && (
                <SheetItem
                  icon={<IconRename size={22} />}
                  label="Rename"
                  onClick={run(() => onRename?.(item))}
                />
              )}

              {!isGoogle && (
                <SheetItem
                  icon={
                    starred ? (
                      <StarIconSolid className="h-6 w-6" />
                    ) : (
                      <StarIcon className="h-6 w-6" />
                    )
                  }
                  label={starred ? "Remove from starred" : "Add to starred"}
                  onClick={run(() => onStar?.(item))}
                />
              )}

              {/* Open in Google Drive */}
              {isGDrive && item.webViewLink && (
                <SheetItem
                  icon={
                    <svg viewBox="0 0 87.3 78" width="22" height="22">
                      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
                      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47" />
                      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
                      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
                      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
                      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
                    </svg>
                  }
                  label="Open in Google Drive"
                  onClick={run(() =>
                    window.open(item.webViewLink, "_blank", "noreferrer"),
                  )}
                />
              )}

              {/* Trash / delete */}
              {((!isGDrive && canTrash) || (isGDrive && canDelete)) && (
                <>
                  <Divider />
                  {!isGDrive && canTrash && (
                    <SheetItem
                      icon={<IconTrash size={22} />}
                      label="Move to trash"
                      onClick={run(handleTrash)}
                    />
                  )}
                  {isGDrive && canDelete && (
                    <SheetItem
                      icon={<IconTrash size={22} />}
                      label="Delete forever"
                      onClick={run(() => onDeleteForever?.())}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </BottomSheet>
    </div>
      {detailsSheet}
    </>
  );
}