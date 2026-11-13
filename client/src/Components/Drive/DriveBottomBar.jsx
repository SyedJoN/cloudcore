import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpOnSquareIcon,
  ArrowUpOnSquareStackIcon,
  FolderPlusIcon,
} from "@heroicons/react/24/outline";

import { useAuth, useGDrive } from "../../Contexts";
import GoogleDriveSVG from "../Icons/GoogleDriveSVG";
import { GDrivePicker, NAV_ITEMS } from "./DriveSidebar";
import { BottomSheet, SheetItem } from "./BottomSheet";

const TAB_KEYS = ["home", "starred", "shared", "drive"];
const TAB_LABELS = { drive: "Files" };

/* ---------- Main mobile component ---------- */
export default function DriveBottomBar({
  dirId,
  dirContext,
  disabled,
  onCreateFolder,
  isGoogleDriveRoute,
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
  const [pickerOpen, setPickerOpen] = useState(false);

  const tabs = TAB_KEYS.map((k) => NAV_ITEMS.find((i) => i.key === k)).filter(
    Boolean,
  );

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
        className="fixed right-4 z-150 flex h-14 items-center gap-3 rounded-2xl bg-(--text-primary) px-5 text-[15px] font-medium text-(--text-theme) shadow-[0_2px_6px_rgba(0,0,0,0.3)] active:scale-95 transition-transform"
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
        {isGoogleDriveRoute ? (
          <SheetItem
            icon={<GoogleDriveSVG size={22} />}
            label="Choose from Drive"
            disabled={disabled}
            onClick={runAndClose(() => setPickerOpen(true))}
          />
        ) : (
          <SheetItem
            icon={<GoogleDriveSVG size={22} />}
            label="Import from Drive"
            disabled={disabled}
            onClick={runAndClose(() => setPickerOpen(true))}
          />
        )}
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
