import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpOnSquareIcon,
  ArrowUpOnSquareStackIcon,
  EllipsisHorizontalIcon,
  FolderPlusIcon,
} from "@heroicons/react/24/outline";
import { EllipsisHorizontalIcon as EllipsisHorizontalIconSolid } from "@heroicons/react/24/solid";

import { formatSize } from "../../../Utils/formatHelpers";
import { useAuth, useGDrive } from "../../Contexts";
import GoogleDriveSVG from "../Icons/GoogleDriveSVG";
import { GDrivePicker, NAV_ITEMS } from "./DriveSidebar";
import { BottomSheet, SheetItem } from "./BottomSheet";

// Tabs shown in the bottom bar (same as the Google Drive app)
const TAB_KEYS = ["home", "starred", "shared", "root"];
const TAB_LABELS = { root: "Files" };
// Everything else goes into the "More" sheet
const MORE_KEYS = ["recent", "trash", "google-drive"];

/* ---------- Main mobile component ---------- */
export default function DriveBottomBar({
  dirId,
  dirContext,
  disabled,
  onCreateFolder,
  refreshCurrentDirectory,
  onUploadFolders,
  onUploadFiles,
  showError,
  enqueueItem,
  setItemProgress,
  completeItem,
  handleCancelUpload,
  setDbFileId,
}) {
  const { isGoogleDrive } = useGDrive();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [showNew, setShowNew] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const usagePercent = Math.max(
    0,
    Math.min((user.totalUsage / Number(user.totalStorage)) * 100, 100),
  );

  const tabs = TAB_KEYS.map((k) => NAV_ITEMS.find((i) => i.key === k)).filter(
    Boolean,
  );
  const moreItems = MORE_KEYS.map((k) =>
    NAV_ITEMS.find((i) => i.key === k),
  ).filter((i) => i && (isGoogleDrive || i.key !== "google-drive"));

  const moreActive = moreItems.some((i) => i.isActive({ dirContext, dirId }));

  const runAndClose = (fn) => () => {
    setShowNew(false);
    fn?.();
  };

  return (
    <>
      {/* Floating "New" button */}
      <button
        onClick={() => setShowNew(true)}
        aria-label="New"
        className="fixed right-4 z-150 flex h-14 items-center gap-3 rounded-2xl bg-white px-5 text-[15px] font-medium text-[#001d35] shadow-[0_2px_6px_rgba(0,0,0,0.3)] active:scale-95 transition-transform"
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom) + 16px)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </button>

      {/* Bottom navigation bar */}
      <nav
        className="gd-bottom-bar"
        style={{
          height: "calc(80px + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {tabs.map(({ key, label, path, Icon, IconSolid, isActive }) => {
          const active = isActive({ dirContext, dirId });
          const DisplayIcon = active ? IconSolid : Icon;
          return (
            <button
              key={key}
              onClick={() => navigate(path)}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <span
                className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-(--accent-blue-light)" : ""
                }`}
              >
                <DisplayIcon
                  className="h-6 w-6 text-(--text-primary)"
                  size={24}
                />
              </span>
              <span
                className={`text-[12px] ${
                  active
                    ? "font-semibold text-(--accent-blue)"
                    : "text-(--text-primary)"
                }`}
              >
                {(TAB_LABELS[key] || label) === "Shared with me"
                  ? "Shared"
                  : TAB_LABELS[key] || label}
              </span>
            </button>
          );
        })}

        {/* More */}
        <button
          onClick={() => setShowMore(true)}
          className="flex flex-1 flex-col items-center gap-1"
        >
          <span
            className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
              moreActive ? "bg-(--accent-blue-light)" : ""
            }`}
          >
            {moreActive ? (
              <EllipsisHorizontalIconSolid className="h-6 w-6 text-(--accent-blue)" />
            ) : (
              <EllipsisHorizontalIcon className="h-6 w-6 text-(--text-primary)" />
            )}
          </span>
          <span
            className={`text-[12px] ${
              moreActive
                ? "font-semibold text-(--accent-blue)"
                : "text-(--text-primary)"
            }`}
          >
            More
          </span>
        </button>
      </nav>

      {/* "Create new" sheet */}
      <BottomSheet open={showNew} onClose={() => setShowNew(false)}>
        <SheetItem
          icon={<FolderPlusIcon className="h-6 w-6" />}
          label="New folder"
          onClick={runAndClose(onCreateFolder)}
        />

        <SheetItem
          icon={<ArrowUpOnSquareIcon className="h-6 w-6" />}
          label="File upload"
          disabled={disabled}
          onClick={runAndClose(onUploadFiles)}
        />
        <SheetItem
          icon={<ArrowUpOnSquareStackIcon className="h-6 w-6" />}
          label="Folder upload"
          disabled={disabled}
          onClick={runAndClose(onUploadFolders)}
        />
        <SheetItem
          icon={<GoogleDriveSVG size={22} />}
          label="Import from Drive"
          disabled={disabled}
          onClick={runAndClose(() => setPickerOpen(true))}
        />
      </BottomSheet>

      {/* "More" sheet: remaining nav + storage */}
      <BottomSheet open={showMore} onClose={() => setShowMore(false)}>
        {moreItems.map(({ key, label, path, Icon, IconSolid, isActive }) => {
          const active = isActive({ dirContext, dirId });
          const DisplayIcon = active ? IconSolid : Icon;
          return (
            <SheetItem
              key={key}
              active={active}
              icon={<DisplayIcon className="h-6 w-6" size={22} />}
              label={label}
              onClick={() => {
                setShowMore(false);
                navigate(path);
              }}
            />
          );
        })}

        <div className="px-6 py-3">
          <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-[#e1e3e1]">
            <div
              className="h-full rounded-full bg-[#0b57d0]"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="gd-storage-text">
            {user.totalUsage === 0 ? "0 B " : formatSize(user.totalUsage)} of{" "}
            {formatSize(user.totalStorage)} used
          </div>
          {user.plan !== "business" && (
            <button
              onClick={() => {
                setShowMore(false);
                navigate("/#pricing");
              }}
              className="mt-3 rounded-full border border-[#747775] px-4 py-2 text-[14px] font-medium text-[#0b57d0] active:bg-[#f0f4f9]"
            >
              Get more storage
            </button>
          )}
        </div>
      </BottomSheet>

      {pickerOpen && (
        <GDrivePicker
          enqueueItem={enqueueItem}
          setItemProgress={setItemProgress}
          completeItem={completeItem}
          handleCancelUpload={handleCancelUpload}
          setDbFileId={setDbFileId}
          refreshCurrentDirectory={refreshCurrentDirectory}
          open={pickerOpen}
          setOpen={setPickerOpen}
          showError={showError}
        />
      )}
    </>
  );
}
