import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useToast } from "../../Contexts/ToastContext";
import {
  IconShare,
  IconDownload,
  IconRename,
  IconTrash,
  IconChevronRight,
  IconOpenWith,
  IconPreview,
  IconNewTab,
  IconLink,
  IconRestore,
} from "../Icons/Icons";
import {
  ChevronLeftIcon,
  DocumentDuplicateIcon,
  StarIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { FolderInput } from "lucide-react";
import { BottomSheet, SheetItem } from "./BottomSheet";
import DetailsPageMobile from "./DetailsPageMobile";
import { Divider } from "../Divider";

/* File name at the top; becomes a back row inside the "Open with" view */
function SheetHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 px-6 pb-3 pt-1">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1 truncate text-[15px] font-medium text-(--text-primary)">
        {title}
      </div>
    </div>
  );
}

export default function MobileContextMenu({
  open,
  item,
  route,
  isStarred = {},
  dirId,
  onClose,
  onShare,
  onRename,
  onTrash,
  onDeleteForever,
  onRestore,
  onDownload,
  onCopy,
  onMove,
  onStar,
  onPreview,
}) {
  const { toast } = useToast();

  // "main" = full menu, "openWith" = Preview / Open in new tab
  const [view, setView] = useState("main");

  // reset after the sheet has finished sliding out
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setView("main"), 250);
    return () => clearTimeout(t);
  }, [open]);

  // sheet height follows the active panel so it resizes smoothly
  const mainPanelRef = useRef(null);
  const openWithPanelRef = useRef(null);
  const [panelHeight, setPanelHeight] = useState(undefined);

  useLayoutEffect(() => {
    const el =
      view === "openWith" ? openWithPanelRef.current : mainPanelRef.current;
    if (!el) return;

    const update = () => setPanelHeight(el.scrollHeight);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, open, item]);

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

  if (!item) return detailsSheet;

  /* ---------- flags ---------- */

  const isGoogle = Boolean(item.webViewLink);
  const isSharedRoute = route === "shared";
  const isGoogleDriveRoute = route === "google-drive" && isGoogle;
  const isTrashRoute = route === "trash";
  const isFile = !item.isDirectory;

  const capabilities = item.capabilities || {};

  const canRead = isGoogle ? true : capabilities.canRead === true;
  const canDownload = capabilities.canDownload === true;
  const canCopy = true;
  const canMove = capabilities.canMove === true;
  const canShare = true;
  const canRename = capabilities.canRename === true;
  const canTrash = capabilities.canTrash === true;
  const canDelete = capabilities.canDelete === true;

  const isDeleted = Boolean(item?.isDeleted);
  const showDeleteActions = isTrashRoute && isDeleted && !dirId;

  const starred = Boolean(isStarred[item._id]);

  /* ---------- helpers ---------- */

  // run action, then close the sheet
  const run =
    (action) =>
    (...args) => {
      action?.(...args);
      onClose();
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
      onClose();
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast({ message: "Failed to copy link", type: "error" });
    }
  }

  function handleOpenInNewTab() {
    window.open(item.webViewLink || `/file/${item._id}`, "_blank");
    onClose();
  }

  /* ---------- render ---------- */

  return (
    <>
      <BottomSheet open={open} onClose={onClose}>
        <div
          className="relative overflow-hidden transition-[height] duration-300 ease-out"
          style={{ height: panelHeight }}
        >
          <div
            className="flex w-full items-start transition-transform duration-300 ease-out"
            style={{
              transform:
                view === "openWith" ? "translateX(-100%)" : "translateX(0)",
            }}
          >
            {/* ---------- MAIN PANEL ---------- */}
            <div
              ref={mainPanelRef}
              className="w-full shrink-0"
              aria-hidden={view === "openWith"}
            >
              <SheetHeader title={item.name} />

              <div className="max-h-[70vh] overflow-y-auto py-2">
                {showDeleteActions ? (
                  /* ---------- TRASH ---------- */
                  <>
                    <SheetItem
                      icon={<IconRestore size={22} />}
                      label="Restore"
                      disabled={!canDelete}
                      onClick={run(() => onRestore(item))}
                    />
                    <SheetItem
                      icon={<IconTrash size={22} />}
                      label="Delete forever"
                      disabled={!canDelete}
                      onClick={run(() =>
                        onDeleteForever(isGoogle ? "google" : "local"),
                      )}
                    />
                  </>
                ) : (
                  /* ---------- NORMAL ---------- */
                  <>
                    {/* Open with: files only */}
                    {isFile && (
                      <>
                        <SheetItem
                          icon={<IconOpenWith size={22} />}
                          label={
                            <span className="flex flex-1 items-center justify-between">
                              Open with
                              <IconChevronRight size={16} />
                            </span>
                          }
                          disabled={isDeleted || !canRead}
                          onClick={() => setView("openWith")}
                        />
                        <Divider />
                      </>
                    )}

                    <SheetItem
                      icon={<IconShare size={22} />}
                      label="Share"
                      disabled={isDeleted || !canShare}
                      onClick={run(() => onShare(item))}
                    />
                    <SheetItem
                      icon={<IconLink size={22} />}
                      label="Copy link"
                      disabled={isDeleted || !canRead}
                      onClick={handleCopyLink}
                    />

                    <Divider />
                    <SheetItem
                      icon={<InformationCircleIcon className="h-6 w-6" />}
                      label="View Information"
                      onClick={() => {
                        setDetailsItem(item);
                        onClose();
                      }}
                    />
                    <Divider />

                    <SheetItem
                      icon={<IconDownload size={22} />}
                      label="Download"
                      disabled={isDeleted || !canDownload}
                      onClick={run(() => onDownload(item))}
                    />
                    <SheetItem
                      icon={<IconRename size={22} />}
                      label="Rename"
                      disabled={isDeleted || !canRename}
                      onClick={run(() => onRename(item))}
                    />
                    <SheetItem
                      icon={<DocumentDuplicateIcon className="h-6 w-6" />}
                      label="Make a copy"
                      disabled={isSharedRoute || !canCopy}
                      onClick={run(() => onCopy(item))}
                    />

                    <Divider />

                    {/* Organize: flattened into Move + Star */}
                    <SheetItem
                      icon={<FolderInput width={22} height={22} />}
                      label="Move"
                      disabled={
                        isSharedRoute ||
                        isDeleted ||
                        !canMove ||
                        isGoogleDriveRoute
                      }
                      onClick={run(() => onMove(item._id))}
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
                      disabled={isDeleted || isGoogleDriveRoute}
                      onClick={run(() => onStar(item))}
                    />

                    {(!isDeleted && !isGoogleDriveRoute) ||
                    isGoogleDriveRoute ? (
                      <Divider />
                    ) : null}

                    {/* Move to trash */}
                    {!isDeleted && !isGoogleDriveRoute && (
                      <SheetItem
                        icon={<IconTrash size={22} />}
                        label="Move to trash"
                        disabled={!canDelete || !canTrash}
                        onClick={run(() => onTrash(item))}
                      />
                    )}

                    {/* Google Drive delete */}
                    {isGoogleDriveRoute && (
                      <SheetItem
                        icon={<IconTrash size={22} />}
                        label="Delete forever"
                        disabled={isDeleted || !canDelete}
                        onClick={run(() =>
                          onDeleteForever(isGoogle ? "google" : "local"),
                        )}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ---------- OPEN WITH PANEL ---------- */}
            <div
              ref={openWithPanelRef}
              className="w-full shrink-0"
              aria-hidden={view !== "openWith"}
            >
              <SheetHeader title="Open with" onBack={() => setView("main")} />

              <div className="max-h-[70vh] overflow-y-auto py-2">
                <SheetItem
                  icon={<IconPreview size={22} />}
                  label="Preview"
                  disabled={isDeleted || !canRead}
                  onClick={run(() => onPreview(item))}
                />
                <SheetItem
                  icon={<IconNewTab size={22} />}
                  label="Open in new tab"
                  disabled={isDeleted || !canRead}
                  onClick={handleOpenInNewTab}
                />
              </div>
            </div>
          </div>
        </div>
      </BottomSheet>
      {detailsSheet}
    </>
  );
}