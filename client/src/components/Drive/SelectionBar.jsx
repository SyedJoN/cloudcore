import { useState } from "react";
import {
  IconClose,
  IconDownload,
  IconRename,
  IconRestore,
  IconShare,
  IconLink,
  IconTrash,
} from "../../Components/Icons/Icons";
import { useAuth, useToast } from "../../Contexts";

import { DocumentDuplicateIcon, StarIcon } from "@heroicons/react/24/outline";
import { ArrowTurnDownLeftIcon, StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

export default function SelectionBar({
  dirId,
  combinedItems,
  selectedItems,
  isStarred,
  setIsStarred,
  hasFileSelected,
  route,
  onStar,
  onClear,
  onDownload,
  onCopy,
  onRename,
  onShare,
  onRestore,
  onTrash,
  onDeleteForever,
}) {
  if (selectedItems.size === 0) {
    return null;
  }

  const { toast } = useToast();
  const { user } = useAuth();

  // SELECTED ITEM
  const item = combinedItems.find((item) =>
    selectedItems.has(item.id ?? item._id),
  );

  if (!item) {
    return null;
  }

  // ITEM TYPE

  const isGoogle = Boolean(item.webViewLink);

  const isFile = !item.isDirectory;

  const isTrashRoute = route === "trash";

  const isSharedRoute = route === "shared";

  const isGoogleDriveRoute = route === "google-drive";

  const isDeleted = item?.isDeleted;

  const showFileActions = isFile;

  // Capabilities

  const capabilities = item.capabilities || {};

  const canRead = capabilities.canRead === true;

  const canShare = true;

  const canDownload = capabilities.canDownload === true;

  const canCopy = capabilities.canCopy === true;

  const canRename = capabilities.canRename === true;

  const canMove = capabilities.canMove === true;

  const canDelete = capabilities.canDelete === true;

  const canTrash = capabilities.canTrash === true;

  const canChangeRole = capabilities.canChangeRole === true;

  // COPY LINK

  const handleCopyLink = async () => {
    const url =
      item.webViewLink ??
      (item.isDirectory
        ? `${window.location.origin}/directory/${item._id}?usp=drive_link`
        : `${window.location.origin}/file/${item._id}?usp=drive_link`);

    try {
      await navigator.clipboard.writeText(url);

      toast({
        message: "Link copied to clipboard",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to copy link:", error);

      toast({
        message: "Failed to copy link",
        type: "error",
      });
    }
  };

  // NORMAL ACTIONS
  const showNormalActions = !isTrashRoute && !isDeleted;

  // RENDER
  return (
    <div className="gd-selection-bar">
      {/* CLEAR SELECTION*/}

      <button
        className="gd-icon-btn gd-sel-close"
        title="Clear selection"
        onClick={onClear}
      >
        <IconClose size={18} />
      </button>

      <span className="gd-selection-count">{selectedItems.size} selected</span>

      <div className="gd-selection-actions">
        {/* NORMAL ACTIONS */}

        {showNormalActions && (
          <>
            {/* DOWNLOAD */}

            {canDownload && (
              <button
                className="gd-sel-action-btn"
                title="Download"
                onClick={onDownload}
              >
                <IconDownload size={18} />
              </button>
            )}

            {/* SHARE */}

            {canShare && (
              <button
                className="gd-sel-action-btn"
                title="Share"
                onClick={onShare}
              >
                <IconShare size={18} />
              </button>
            )}
          
            {!isGoogle && (
              <button
                className="gd-sel-action-btn"
                title="Star"
                onClick={onStar}
              >
                {isStarred[item._id] ? (
                  <StarIconSolid className="w-5 h-5" />
                ) : (
                  <StarIcon className="w-5 h-5" />
                )}
              </button>
            )}
          </>
        )}

        {/*COPY LINK */}

        {!isDeleted && canRead && (
          <button
            className="gd-sel-action-btn"
            title="Copy link"
            onClick={handleCopyLink}
          >
            <IconLink size={18} />
          </button>
        )}

        {/*
            RENAME / EDIT*/}

        {!isDeleted && canRename && (
          <button className="gd-sel-action-btn" title="Edit" onClick={onRename}>
            <IconRename size={18} />
          </button>
        )}

        {/*
            TRASH / REMOVE FOR LOCAL ITEMS
      */}

        {!isGoogle && !isDeleted && !isSharedRoute && canTrash && (
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Move to trash"
            onClick={onTrash}
          >
            <IconTrash size={18} />
          </button>
        )}

        {/*
            REMOVE ACCESS
          */}

        {!isGoogle &&
          !isDeleted &&
          !isSharedRoute &&
          !canTrash &&
          canDelete && (
            <button
              className="gd-sel-action-btn gd-sel-action-danger"
              title="Remove"
              onClick={onDeleteForever}
            >
              <IconTrash size={18} />
            </button>
          )}

        {/* 
            DELETED ITEMS*/}

        {isDeleted && canDelete && (
          <>
            {/* 
                RESTORE */}

            <button
              className="gd-sel-action-btn gd-sel-action-success"
              title="Restore"
              onClick={onRestore}
            >
              <IconRestore size={18} />
            </button>

            {/* DELETE FOREVER */}

            <button
              className="gd-sel-action-btn gd-sel-action-danger"
              title="Delete Forever"
              onClick={() => onDeleteForever(isGoogle ? "google" : "local")}
            >
              <IconTrash size={18} />
            </button>
          </>
        )}

        {/* GOOGLE DRIVE DELETE */}

        {isGoogleDriveRoute && !isDeleted && canDelete && (
          <button
            className="gd-sel-action-btn gd-sel-action-danger"
            title="Delete Forever"
            onClick={() => onDeleteForever("google")}
          >
            <IconTrash size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
