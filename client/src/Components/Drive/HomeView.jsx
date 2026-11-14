import { useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  Bars3Icon,
  Squares2X2Icon,
  CheckIcon,
} from "@heroicons/react/24/solid";
import { GridItem, ListRow } from ".";
import MobileGridItem from "./MobileGridItem";
import MobileListRow from "./MobileListRow";

import { useAuth } from "../../Contexts";
import { useDevice } from "../../Contexts/DeviceContext";
import ViewToggle from "./ViewToggle";
import ViewToggleMobile from "./ViewToggleMobile";

/* ---------- helpers ---------- */

const footerText = (item) => {
  if (item.suggestionReason === "frequent") return "You've opened frequently";
  if (item.suggestionReason === "modified") {
    return `You modified · ${formatWhen(item.lastViewedAt)}`;
  }
  return `You opened · ${formatWhen(item.lastViewedAt)}`;
};

const formatWhen = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const isToday = d.toDateString() === new Date().toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

/* ---------- small UI pieces ---------- */
 
const Section = ({ title, right, isHomeRoute = true, isMobile = true,children }) => {
  const [open, setOpen] = useState(true);
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3 m-3 min-h-10">
        <button
          type="button"
          disabled={!isHomeRoute}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-base font-medium cursor-pointer"
          aria-expanded={open}
        >
          {isHomeRoute && !isMobile && (
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${
                open ? "" : "-rotate-90"
              }`}
            />
          )}
          {title}
        </button>

        <div className="shrink-0 min-w-20 flex justify-end">
          {open ? right : null}
        </div>
      </div>
      {open && children}
    </section>
  );
};

/* ---------- main component ---------- */

const HomeView = ({
  loading = false,
  items,
  viewMode,
  onToggleView,
  listHeaderRow,
  selectedItems,
  isHomeRoute,
  setSelectedItems,
  selectionMode,
  setSelectionMode,
  handleSelectAll,
  onSelect,
  onRowClick,
  onDoubleClick,
  onContextMenu,
  onShare,
  onRename,
  onDownload,
  onStar,
  onMove,
  isStarred,
  setIsStarred,
  route,
  dirId,
  clearSelection,
  handleDropOnTrash,
}) => {
  const { user } = useAuth();
  const { device } = useDevice();
  const isDesktop = device === "windows";
  const isMobile = device === "mobile";
  const folders = items.filter((it) => it.isDirectory);
  const files = items.filter((it) => !it.isDirectory);

  useEffect(() => {
    console.log({ folders, files });
  }, [files, folders]);

  const FileItem = isDesktop
    ? viewMode === "grid"
      ? GridItem
      : ListRow
    : viewMode === "grid"
      ? MobileGridItem
      : MobileListRow;

  // folders are always chip-style grid items, independent of viewMode
  const FolderItem = isDesktop ? GridItem : MobileGridItem;

  // props every item needs (same ones DefaultView passes)
  const common = {
    items,
    dirId,
    route,
    selectedItems,
    setSelectedItems,
    selectedItemsSize: selectedItems?.size ?? 0,
    selectionActive: (selectedItems?.size ?? 0) > 0,
    selectionMode,
    setSelectionMode,
    isHomeRoute,
    handleSelectAll,
    handleDropOnTrash,
    onSelect,
    onRowClick,
    onDoubleClick,
    onContextMenu,
    onShare,
    onRename,
    onDownload,
    onStar,
    onMove: (ids, destinationId, destinationName) =>
      onMove?.(ids, destinationId, destinationName),
    isStarred,
    setIsStarred,
    clearSelection,
  };

  const itemProps = (item) => ({
    key: item._id ?? item.id,
    item,
    avatar: item.userId?.avatar || item.owners?.[0]?.photoLink,
    owner: item.userId?.name || item.owners?.[0]?.displayName,
    email: item.userId?.email || item.owners?.[0]?.emailAddress,
    selected: selectedItems?.has(item.id ?? item._id),
    ...common,
  });

  const fileContainerClass =
  viewMode === "grid"
    ? isMobile
      ? isHomeRoute
        ? "mgi-grid mobile"
        : "mgi-grid"
      : "gd-grid"
    : isMobile
      ? isHomeRoute
        ? "gd-list mobile home"
        : "gd-list mobile"
      : "gd-list";
  const isEmpty = !loading && folders.length === 0 && files.length === 0;

  return (
    <div className="gd-drive">
      {loading && <p className="text-sm opacity-70">Loading suggestions…</p>}

      {isEmpty && (
        <div className="gd-empty">
          <h3>Nothing here yet</h3>
          <p>Open a file or folder and it will show up here.</p>
        </div>
      )}

      {folders.length > 0 && isDesktop && (
        <Section title="Suggested folders" isHomeRoute={isHomeRoute} isMobile={isMobile}>
          <div className={`gd-grid ${isMobile ? "" : "gd-grid-on-top"} py-1!`}>
            {folders.map((item) => {
              const { key, ...rest } = itemProps(item);
              return (
                <FolderItem
                  key={key}
                  {...rest}
                  subtitle={
                    item.locationLabel
                      ? `in ${item.locationLabel.startsWith("root") ? "Drive" : item.locationLabel}`
                      : ""
                  }
                />
              );
            })}
          </div>
        </Section>
      )}

      {(files.length > 0 || loading) && (
        <Section
          title={isDesktop ? "Suggested files" : "Files"}
          right={
            isMobile ? (
              <ViewToggleMobile
                viewMode={viewMode}
                onToggleView={onToggleView}
              />
            ) : (
              <ViewToggle viewMode={viewMode} onToggleView={onToggleView} />
            )
          }
        >
          {isDesktop && viewMode === "list" && listHeaderRow}

          {files.length === 0 && files.length > 0 ? (
            <div className="gd-empty">
              <h3>No matching files</h3>
              <p>Try adjusting or clearing your filters.</p>
            </div>
          ) : (
            <div className={fileContainerClass}>
              {files.map((item) => {
                const { key, ...rest } = itemProps(item);
                return (
                  <FileItem key={key} {...rest} footer={footerText(item)} />
                );
              })}
            </div>
          )}
        </Section>
      )}
    </div>
  );
};

export default HomeView;
