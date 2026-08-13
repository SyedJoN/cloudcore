import { ROLE_PRIORITY } from "./getRolePriority.js";

export const getCapabilities = (role, type, isRootLevelFile=false) => {
  const priority = ROLE_PRIORITY[role] || 0;

  const isReader =
    priority >= ROLE_PRIORITY.reader;

  const isWriter =
    priority >= ROLE_PRIORITY.writer;

  const isOwner =
    priority >= ROLE_PRIORITY.owner;

  return {
    canRead: isReader,
    canWrite: isWriter,
    canShare: isWriter,
    canChangeRole: isRootLevelFile ? isOwner : isWriter,
    canRename: isWriter,
    canDownload: isReader,
    canCopy: isReader,
    canMove: isWriter,
    canTrash: isOwner,
    canDelete: isOwner,

    canAddChildren:
      type === "folder" && isWriter,

    canRemoveChildren:
      type === "folder" && isWriter,
  };
};