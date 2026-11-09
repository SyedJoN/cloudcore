import { useEffect, useRef, useState } from "react";
import {
  IconDownload,
  IconShare,
  IconTrash,
  IconRename,
  IconLink,
  IconRestore,
  IconNewTab,
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
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { FolderInput } from "lucide-react";
import { BottomSheet, SheetItem } from "../Drive/BottomSheet";
import DetailsPageMobile from "../Drive/DetailsPageMobile";
import { Divider } from "../Divider";
import { SheetHeader } from "../Drive/MobileContextMenu";
import { getFileType } from "../../../Utils/displayUtils";
import UserAccountDrawerMobile from "../UserAccountDrawerBar";
import { UseAvatar } from "../../Hooks/useAvatar";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

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
  onCopy,
  onMove,
  meta = false,
}) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // slider state
  const viewerRef = useRef(null);
  const gesture = useRef(null);
  const pendingDir = useRef(0); // +1 next, -1 previous, 0 snap back
  const sliding = useRef(false);

  const [offset, setOffset] = useState(0); // live drag distance in px
  const [animating, setAnimating] = useState(false);

  const route = location.pathname.startsWith("/google-drive");
  const isSharedRoute = location.pathname.startsWith("/shared");

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

  const iconType = item?.isDirectory ? null : getFileType(item?.name || "");

  const isGoogle = Boolean(item?.webViewLink);
  const isDeleted = Boolean(item?.isDeleted);
  const isGDrive = route && isGoogle;
  const category = getCategory(item?.name || "");
  const fileUrl = isGDrive
    ? item?.webContentLink || item?.webViewLink
    : `${BASE_URL}/file/${item?._id}`;

  /* ---------- capabilities (same rules as MobileContextMenu) ---------- */

  const capabilities = item?.capabilities ?? {};
  const canRead = item?.webViewLink ? true : capabilities.canRead === true;
  const canDownload = capabilities.canDownload === true;
  const canCopy = true;
  const canMove = capabilities.canMove === true;
  const canShare = true;
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
    const t = e.touches[0];

    // video ke bottom controls (seek bar) pe slide mat karo,
    // baqi video area pe swipe chalega
    let onVideoControls = false;
    const video = e.target.closest("video");
    if (video) {
      const r = video.getBoundingClientRect();
      onVideoControls = t.clientY > r.bottom - 72;
    }

    if (
      sliding.current ||
      e.touches.length > 1 ||
      e.target.closest("audio, input") ||
      onVideoControls
    ) {
      gesture.current = null;
      return;
    }

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
    if (isDeleted) return;

    const url =
      item.webViewLink ??
      (item.isDirectory
        ? `${window.location.origin}/directory/${item._id}?usp=drive_link`
        : `${window.location.origin}/file/${item._id}?usp=drive_link`);

    try {
      await navigator.clipboard.writeText(url);
      setSheetOpen(false);
      toast({ message: "Link copied to clipboard", type: "success" });
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast({ message: "Failed to copy link", type: "error" });
    }
  }

  function handleOpenInNewTab() {
    window.open(item.webViewLink || `/file/${item._id}`, "_blank");
    setSheetOpen(false);
  }

  async function handleTrash(target) {
    await onTrash?.(target);
    onDeleteSuccess?.(target._id);
    onClose?.();
  }

  /* ---------- viewer ---------- */

  const renderViewer = () => {
    if (isGDrive) {
      return (
        <div className="fv-pdf-stage">
          <iframe
            key={item?.id}
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
          className="flex shrink-0 items-center gap-1 px-3 pb-1"
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
          {meta && (
            <button
              type="button"
              className="gd-mavatar"
              aria-label="Account"
              onClick={() => setAccountOpen(true)}
            >
              <UseAvatar name={user.name} avatar={user.avatar} size={32} />
            </button>
          )}

          <button
            onClick={() => setSheetOpen(true)}
            aria-label="More actions"
            className="flex h-11 w-11 items-center justify-end rounded-full text-(--text-primary) active:bg-black/10"
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

          {/* GDrive iframe touches swallow karta hai: edge swipe zones + buttons */}
          {isGDrive && (
            <>
              <div
                className="absolute inset-y-0 left-0 w-10"
                style={{ zIndex: 50, touchAction: "pan-y" }}
              />
              <div
                className="absolute inset-y-0 right-0 w-10"
                style={{ zIndex: 50, touchAction: "pan-y" }}
              />

              {hasPrev && (
                <button
                  type="button"
                  aria-label="Previous file"
                  onClick={() => slideTo(-1)}
                  className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
                  style={{ zIndex: 60 }}
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
              )}
              {hasNext && (
                <button
                  type="button"
                  aria-label="Next file"
                  onClick={() => slideTo(1)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
                  style={{ zIndex: 60 }}
                >
                  <ChevronLeftIcon className="h-5 w-5 rotate-180" />
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Actions sheet (same order as MobileContextMenu) ── */}
        <BottomSheet
          zIndex={600}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        >
          <div className="mobile-context-menu w-full shrink-0">
            <SheetHeader title={item.name} item={item} iconType={iconType} />

            <div className="max-h-[65vh] overflow-y-auto py-2">
              {isDeleted ? (
                /* ---------- TRASH ---------- */
                <>
                  <SheetItem
                    icon={<IconRestore size={22} />}
                    label="Restore"
                    disabled={!canDelete}
                    onClick={run(() => onRestore?.(item))}
                  />
                  <SheetItem
                    icon={<IconTrash size={22} />}
                    label="Delete forever"
                    disabled={!canDelete}
                    onClick={run(() =>
                      onDeleteForever?.(isGoogle ? "google" : "local", item),
                    )}
                  />
                </>
              ) : (
                /* ---------- NORMAL ---------- */
                <>
                  {/* Open: viewer me preview already hai, isliye seedha new tab */}

                  <SheetItem
                    icon={<IconShare size={22} />}
                    label="Share"
                    disabled={isDeleted || !canShare}
                    onClick={run(() => onShare?.(item))}
                  />
                  <SheetItem
                    icon={<IconLink size={22} />}
                    label="Copy link"
                    disabled={isDeleted}
                    onClick={handleCopyLink}
                  />
                  <SheetItem
                    icon={<InformationCircleIcon className="h-6 w-6" />}
                    label="View Information"
                    onClick={() => {
                      setDetailsItem(item);
                      setSheetOpen(false); // close only the actions sheet, not the viewer
                    }}
                  />
                  <Divider />

                  <SheetItem
                    icon={<IconDownload size={22} />}
                    label="Download"
                    disabled={isDeleted || !canDownload}
                    onClick={run(() => onDownload?.(item))}
                  />
                  <SheetItem
                    icon={<IconRename size={22} />}
                    label="Rename"
                    disabled={isDeleted || !canRename}
                    onClick={run(() => onRename?.(item))}
                  />
                  <SheetItem
                    icon={<DocumentDuplicateIcon className="h-6 w-6" />}
                    label="Make a copy"
                    disabled={isSharedRoute || !canCopy}
                    onClick={run(() => onCopy?.(item))}
                  />

                  <Divider />

                  <SheetItem
                    icon={<FolderInput width={22} height={22} />}
                    label="Move"
                    disabled={
                      isSharedRoute || isDeleted || !canMove || isGDrive
                    }
                    onClick={run(() => onMove?.(item._id))}
                  />
                  <SheetItem
                    icon={
                      starred ? (
                        <StarIconSolid className="h-6 w-6" />
                      ) : (
                        <StarIcon className="h-6 w-6" />
                      )
                    }
                    label={starred ? "Remove from starred" : "Add to starred"}
                    disabled={isDeleted || isGDrive}
                    onClick={run(() => onStar?.(item))}
                  />

                  <Divider />

                  {/* Move to trash */}
                  {!isGDrive && (
                    <SheetItem
                      icon={<IconTrash size={22} />}
                      label="Move to trash"
                      disabled={!canDelete || !canTrash}
                      onClick={run(() => handleTrash(item))}
                    />
                  )}

                  {/* Google Drive delete */}
                  {isGDrive && (
                    <SheetItem
                      icon={<IconTrash size={22} />}
                      label="Delete forever"
                      disabled={!canDelete}
                      onClick={run(() =>
                        onDeleteForever?.(isGoogle ? "google" : "local", item),
                      )}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </BottomSheet>
      </div>

      {meta && (
        <UserAccountDrawerMobile
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
        />
      )}

      {detailsSheet}
    </>
  );
}
