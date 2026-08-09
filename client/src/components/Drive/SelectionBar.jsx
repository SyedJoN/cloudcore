import { useState } from "react";
import {
  IconClose,
  IconDownload,
  IconRename,
  IconRestore,
  IconShare,
  IconLink,
  IconTrash,
  IconStarred,
} from "../../Components/Icons/Icons";
import { useAuth, useToast } from "../../Contexts";

import { StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

export default function SelectionBar({
  dirId,
  combinedItems,
  selectedItems,
  isStarred,
  setIsStarred,
  hasFileSelected,
  isDeleted,
  route,
  onStar,
  onClear,
  onDownload,
  onRename,
  onShare,
  onRestore,
  onSoftDelete,
  onDeleteForever,
}) {
  if (selectedItems.size === 0) return null;
  const { toast } = useToast();
  const { user } = useAuth();

  const item = combinedItems.find((item) =>
    selectedItems.has(item.id ?? item._id),
  );
  const type = item?.webViewLink ? "google" : "local";
  const userRole = item?.userRole;
  const isFile = !item?.isDirectory;
  const publicRole = item?.publicRole;

  const isOwner = item.owners?.[0].me === true;
  const isViewer =
    (!isOwner &&
      item.permissions?.find((p) => p.role === "reader")?.id === user.id) ||
    item?.publicRole === "reader";
 const canEdit =
    type === "google"
      ? isOwner || item.capabilities?.canEdit
      : !isOwner && item.permissions?.find((p) => p.role === "writer")?.role;
  const canDelete = type === "google" && item.capabilities?.canDelete === true;
  const isTrashRoute = route === "trash";
  const isSharedRoute = route === "shared";
  const isGoogleDriveRoute = route === "google-drive";

  const showFileActions = isFile;

  function handleCopyLink() {
    const url =
      item?.webViewLink ??
      (item?.isDirectory
        ? `${window.location.origin}/directory/${item?._id}?usp=drive_link`
        : `${window.location.origin}/file/${item?._id}?usp=drive_link`);

    navigator.clipboard.writeText(url).then(() => {
      toast({ message: "Link copied to clipboard", type: "success" });
    });
  }

  return (
    <div className="gd-selection-bar">
      <button
        className="gd-icon-btn gd-sel-close"
        title="Clear selection"
        onClick={onClear}
      >
        <IconClose size={18} />
      </button>
      <span className="gd-selection-count">{selectedItems.size} selected</span>

      <div className="gd-selection-actions">
        {!isTrashRoute && !isDeleted && (
          <>
            {showFileActions && (
              <button
                className="gd-sel-action-btn"
                title="Download"
                onClick={onDownload}
              >
                <IconDownload size={18} />
              </button>
            )}

            <button
              className="gd-sel-action-btn"
              title="Share"
              onClick={onShare}
            >
              <IconShare size={18} />
            </button>
            {!isGoogleDriveRoute && (
              <button
                className="gd-sel-action-btn"
                title="Star"
                onClick={() => {
                  setIsStarred((prev) => ({
                    ...prev,
                    [item._id]: !prev[item._id],
                  }));

                  onStar();
                }}
              >
                {isStarred[item?._id] ? (
                  <StarIconSolid className="w-5 h-5" />
                ) : (
                  <StarIcon className="w-5 h-5" />
                )}
              </button>
            )}
          </>
        )}
        {!isDeleted && (
          <button
            className="gd-sel-action-btn"
            title="Copy link"
            onClick={handleCopyLink}
          >
            <IconLink size={18} />
          </button>
        )}
        {!isGoogleDriveRoute && (isOwner || canEdit) && !isDeleted && (
          <button className="gd-sel-action-btn" title="Edit" onClick={onRename}>
            <IconRename size={18} />
          </button>
        )}
        {/* for google just show copy link */}

        {isDeleted && (
          <>
            <button
              className="gd-sel-action-btn gd-sel-action-success"
              title="Restore"
              onClick={onRestore}
            >
              <IconRestore size={18} />
            </button>

            <button
              className="gd-sel-action-btn gd-sel-action-danger"
              title="Delete Forever"
              onClick={() => onDeleteForever(type)}
            >
              <IconTrash size={18} />
            </button>
          </>
        )}
        {isGoogleDriveRoute && (
          <>
            {canEdit && (
              <button
                className="gd-sel-action-btn"
                title="Edit"
                onClick={onRename}
              >
                <IconRename size={18} />
              </button>
            )}
            {canDelete && (
              <button
                className="gd-sel-action-btn gd-sel-action-danger"
                title="Delete Forever"
                onClick={() => onDeleteForever(type)}
              >
                <IconTrash size={18} />
              </button>
            )}
          </>
        )}
        {!isGoogleDriveRoute && !isDeleted && !isSharedRoute && isOwner && (
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Move to trash"
            onClick={onSoftDelete}
          >
            <IconTrash size={18} />
          </button>
        )}
        {!isGoogleDriveRoute &&
          !isDeleted &&
          !isSharedRoute &&
          canEdit &&
          !isOwner && (
            <button
              className="gd-sel-action-btn gd-sel-action-danger"
              title="Remove"
              onClick={onDeleteForever}
            >
              <IconTrash size={18} />
            </button>
          )}
      </div>
    </div>
  );
}
