import { useEffect, useRef, useState } from "react";
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
import { useToast } from "../../Contexts/ToastContext";
import {
  Portal,
  useTransitionClass,
  useSelfMountedTransition,
} from "../../hooks/useFloatingMenu";
import {
  ArrowUpOnSquareIcon,
  ArrowUpOnSquareStackIcon,
  DocumentDuplicateIcon,
  FolderPlusIcon,
} from "@heroicons/react/24/outline";
import { FolderOpenIcon, StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { FolderInput } from "lucide-react";
import GoogleDriveSVG from "../Icons/GoogleDriveSVG";
import { createPortal } from "react-dom";

function CreateMenuContent({
  open,
  onCreateFolder,
  onUploadFiles,
  onUploadFolders,
  onUploadFromDrive,
  disabled,
  onExited,
  position,
  onClose,
}) {
  const { animate, nodeRef, onTransitionEnd } = useTransitionClass(
    open,
    onExited,
  );

  useEffect(() => {
    function handleClick() {
      onClose();
    }

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [onClose]);
  const close =
    (action) =>
    (...args) => {
      action?.(...args);
      onClose();
    };
  return createPortal(
    <>
      <div
        ref={nodeRef}
        onTransitionEnd={onTransitionEnd}
        className={`gd-context-menu ${animate ? "open" : ""}`}
        style={{
          left: position.x,
          top: position.y,
          zIndex: 1000,
        }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          className="gd-context-item"
          onClick={close(() => onCreateFolder())}
        >
          <FolderPlusIcon className="text-(--border-inverse) w-5 h-5" />
          New folder
        </button>

        <div className="gd-context-divider" />

        <button
          className="gd-context-item"
          onClick={close(() => onUploadFiles())}
          disabled={disabled}
        >
          <ArrowUpOnSquareIcon className="text-(--border-inverse) w-5 h-5" />
          File upload
        </button>
        <button
          className="gd-context-item"
          onClick={close(() => onUploadFolders())}
          disabled={disabled}
        >
          <ArrowUpOnSquareStackIcon className="text-(--border-inverse) w-5 h-5" />
          Folder upload
        </button>
        <button
          className="gd-context-item"
          onClick={close(() => onUploadFromDrive())}
          disabled={disabled}
        >
          <GoogleDriveSVG size={18} />
          Import from Drive
        </button>
      </div>
    </>,
    document.body,
  );
}

export default function CreateMenu({ open, item, position, setOpen, ...rest }) {
  const [mounted, setMounted] = useState(false);

  const [render, setRender] = useState({
    item: null,
    position: null,
    key: null,
  });

  useEffect(() => {
    if (!open || !position) {
      return;
    }
    setOpen(false);
    const instanceKey = `${position.x},${position.y},${
      item?._id ?? crypto.randomUUID()
    },${!item ? "create-menu" : item?.isDirectory ? "dir" : "file"}`;

    setRender((prev) => {
      if (prev.key === instanceKey) {
        return prev;
      }

      return {
        item,
        position,
        key: instanceKey,
      };
    });

    setMounted(true);
  }, [open, item, position]);

  if (!mounted) {
    return null;
  }

  return (
    <Portal>
      <CreateMenuContent
        key={render.key}
        item={render.item}
        position={render.position}
        open={open}
        onExited={() => setMounted(false)}
        {...rest}
      />
    </Portal>
  );
}
