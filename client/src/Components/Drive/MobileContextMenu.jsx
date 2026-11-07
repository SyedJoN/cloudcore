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
import { getCountLabel } from "../../../Utils/displayUtils";

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
  item: itemProp = null,
  items = null,
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
  console.log({ itemProp, items });
  // Normalise: always an array. `item` is the first one.
  const raw = items?.length ? items : itemProp;
  const targets = Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];

  const isMulti = targets.length > 1;
  const item = targets[0];

  // "main" = full menu, "openWith" = Preview / Open in new tab (single only)
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

  const panelKey = targets.map((it) => String(it?._id ?? it?.id)).join("|");
  useEffect(() => {
    setView("main");
    setPanelHeight(undefined);
  }, [panelKey]);

  // Measure the currently visible panel
  useLayoutEffect(() => {
    if (!open) return;

    const el =
      view === "openWith" ? openWithPanelRef.current : mainPanelRef.current;

    if (!el) return;

    const updateHeight = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);

      if (height > 0) {
        setPanelHeight((previous) => (previous === height ? previous : height));
      }
    };

    // Initial measurement
    updateHeight();

    // Watch content changes
    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(el);

    return () => observer.disconnect();
  }, [view, open, panelKey, isMulti]);

  // details sheet (single item only)
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
  // Actions are enabled only if EVERY selected item allows them.
  const every = (fn) => targets.every(fn);
  const some = (fn) => targets.some(fn);

  const isGoogle = every((it) => Boolean(it.webViewLink));
  const isSharedRoute = route === "shared";
  const isGoogleDriveRoute = route === "google-drive" && isGoogle;
  const isTrashRoute = route === "trash";
  const isFile = every((it) => !it.isDirectory);

  const cap = (name) => every((it) => it.capabilities?.[name] === true);

  const canRead = every((it) =>
    it.webViewLink ? true : it.capabilities?.canRead === true,
  );
  const canDownload = cap("canDownload");
  const canCopy = true;
  const canMove = cap("canMove");
  const canShare = true;
  const canRename = cap("canRename");
  const canTrash = cap("canTrash");
  const canDelete = cap("canDelete");

  const isDeleted = some((it) => Boolean(it?.isDeleted));
  const allDeleted = every((it) => Boolean(it?.isDeleted));
  const showDeleteActions = isTrashRoute && allDeleted && !dirId;

  // Starred: if everything is starred -> "Remove", otherwise "Add"
  const allStarred = every((it) => Boolean(isStarred[it._id]));
  const starred = allStarred;
  // onStar toggles per item, so only pass the ones that need to change
  const starTargets = allStarred
    ? targets
    : targets.filter((it) => !isStarred[it._id]);

  // Single item -> the item itself; multiple -> the array.
  // (Parent callbacks should accept both, e.g. [].concat(x))
  const payload = isMulti ? targets : item;

  const headerTitle = isMulti
    ? `${getCountLabel(targets)} selected`
    : item.name;

  /* ---------- helpers ---------- */

  // run action, then close the sheet
  const run =
    (action) =>
    (...args) => {
      action?.(...args);
      onClose();
    };

  const handleCopyLink = async (ids) => {
    if (isDeleted) return;

    try {
      const selectedIds = Array.isArray(ids) ? ids : [ids];

      const files = selectedIds
        .map((id) => targets.find((it) => it._id === id))
        .filter(Boolean)
        .filter((file) => !file.isDeleted);

      if (!files.length) return;

      const urls = files.map((file) => {
        return (
          file.webViewLink ??
          (file.isDirectory
            ? `${window.location.origin}/directory/${file._id}?usp=drive_link`
            : `${window.location.origin}/file/${file._id}?usp=drive_link`)
        );
      });

      await navigator.clipboard.writeText(urls.join(", "));
      onClose();
      toast({
        message:
          files.length > 1
            ? "Links copied to clipboard"
            : "Link copied to clipboard",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to copy links:", error);

      toast({
        message: "Failed to copy link",
        type: "error",
      });
    }
  };

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
              className="mobile-context-menu w-full shrink-0"
              aria-hidden={view === "openWith"}
            >
              <SheetHeader title={headerTitle} />

              <div className="max-h-[70vh] overflow-y-auto py-2">
                {showDeleteActions ? (
                  /* ---------- TRASH ---------- */
                  <>
                    <SheetItem
                      icon={<IconRestore size={22} />}
                      label="Restore"
                      disabled={!canDelete}
                      onClick={run(() => onRestore(payload))}
                    />
                    <SheetItem
                      icon={<IconTrash size={22} />}
                      label="Delete forever"
                      disabled={!canDelete}
                      onClick={run(() =>
                        onDeleteForever(isGoogle ? "google" : "local", payload),
                      )}
                    />
                  </>
                ) : (
                  /* ---------- NORMAL ---------- */
                  <>
                    {/* Open with: single file only */}
                    {!isMulti && isFile && (
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
                      onClick={run(() => onShare(payload))}
                    />
                    {/* Copy Links */}
                    <SheetItem
                      icon={<IconLink size={22} />}
                      label="Copy link"
                      disabled={isDeleted}
                      onClick={() =>
                        handleCopyLink(
                          isMulti ? targets.map((it) => it._id) : item._id,
                        )
                      }
                    />
                    {/* info: single item only */}
                    {!isMulti && (
                      <SheetItem
                        icon={<InformationCircleIcon className="h-6 w-6" />}
                        label="View Information"
                        onClick={() => {
                          setDetailsItem(item);
                        }}
                      />
                    )}
                    <Divider />

                    <SheetItem
                      icon={<IconDownload size={22} />}
                      label="Download"
                      disabled={isDeleted || !canDownload}
                      onClick={run(() => onDownload(payload))}
                    />

                    {/* Rename: single item only */}
                    {!isMulti && (
                      <SheetItem
                        icon={<IconRename size={22} />}
                        label="Rename"
                        disabled={isDeleted || !canRename}
                        onClick={run(() => onRename(item))}
                      />
                    )}

                    <SheetItem
                      icon={<DocumentDuplicateIcon className="h-6 w-6" />}
                      label="Make a copy"
                      disabled={isSharedRoute || !canCopy}
                      onClick={run(() => onCopy(payload))}
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
                      // single: the id, multiple: array of ids
                      onClick={run(() =>
                        onMove(
                          isMulti ? targets.map((it) => it._id) : item._id,
                        ),
                      )}
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
                      onClick={run(() => onStar(isMulti ? starTargets : item))}
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
                        onClick={run(() => onTrash(payload))}
                      />
                    )}

                    {/* Google Drive delete */}
                    {isGoogleDriveRoute && (
                      <SheetItem
                        icon={<IconTrash size={22} />}
                        label="Delete forever"
                        disabled={isDeleted || !canDelete}
                        onClick={run(() =>
                          onDeleteForever(
                            isGoogle ? "google" : "local",
                            payload,
                          ),
                        )}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ---------- OPEN WITH PANEL (single item only) ---------- */}
            {!isMulti && (
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
            )}
          </div>
        </div>
      </BottomSheet>
      {detailsSheet}
    </>
  );
}
