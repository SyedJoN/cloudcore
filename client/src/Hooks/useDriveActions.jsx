import React, { useState, useCallback, useRef, useEffect } from "react";
import { getResourceType } from "../../Utils/getResourceType";
import { DRIVE_ROLES, getFileType } from "../../Utils/displayUtils";
import { updateSharedAccess } from "../../Utils/shareRoleAccess";
import {
  deleteFile,
  grantAccessById,
  restoreFile,
  revokeFileAccess,
  softDeleteFile,
  toggleDriveFilePermission,
  toggleFilePublic,
  updateFileViewTime,
} from "../../apis/fileApi";
import { copyItem, toggleItemStar } from "../../apis/resourceApi";
import { axiosWithCreds } from "../../apis/axiosInstances";
import { useNavigate } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

// Pure helpers live outside the hook so they are never re-created.
const toDriveRole = (r) => {
  const mapped = DRIVE_ROLES[r] ?? r; // viewer->reader, editor->writer, writer->writer
  return mapped === "writer" ? "writer" : "reader";
};

const isAnyone = (p) => p?.type === "anyone";

const EMPTY_CONFIRM = { open: false, message: "", resolve: null };

export function useDriveActions({
  dirId,
  user,
  setDirectoriesList,
  setFilesList,
  isStarredRoute,
  isTrashRoute,
  combinedItems,
  lastDirectory,
  setLastDirectory,
  isGoogleDriveRoute,
  isStarred,
  setIsStarred,
  selectedItems,
  setContextItem,
  handleSelect,
  isMobile,
  refreshUser,
  previousDirContext,
  restartAnimation,
  clearSelection,
  toast,
  setError,
  showError,
}) {
  const navigate = useNavigate();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [path, setPath] = useState([]);
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [downloadProgressMap, setDownloadProgressMap] = useState({});
  const [peopleWithAccess, setPeopleWithAccess] = useState([]);
  const [showCreateDir, setShowCreateDir] = useState(false);
  const [newDirname, setNewDirname] = useState("Untitled folder");
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameType, setRenameType] = useState("");
  const [renameId, setRenameId] = useState("");
  const [linkAccess, setLinkAccess] = useState("");
  const [linkRole, setLinkRole] = useState("");
  const [prevPermissions, setPrevPermissions] = useState([]);
  const [userRole, setUserRole] = useState([]);
  const [mobileHeaderDirName, setMobileHeaderDirName] = useState("");
  const [viewItem, setViewItem] = useState(null);
  const [moveItem, setMoveItem] = useState(null);
  const [shareItem, setShareItem] = useState(null);
  const [cascadeModal, setCascadeModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(EMPTY_CONFIRM);

  // Holds AbortControllers for in-flight folder downloads.
  const downloadControllers = useRef({});

  // Refs that break the circular dependency between handleUndo and the
  // handlers whose toasts call it back (trash <-> restore <-> star).
  const handleUndoRef = useRef(null);
  const handleToggleStarRef = useRef(null);

  /* ───────────── Modals ───────────── */

  const showCascadeConfirm = useCallback((chain) => {
    return new Promise((resolve) => {
      setCascadeModal({ chain, resolve });
    });
  }, []);

  const handleCascadeCancel = useCallback(() => {
    cascadeModal?.resolve(false);
    setCascadeModal(null);
  }, [cascadeModal]);

  const handleCascadeConfirm = useCallback(() => {
    cascadeModal?.resolve(true);
    setCascadeModal(null);
  }, [cascadeModal]);

  const showConfirmModal = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmModal({ open: true, message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmModal.resolve?.(true);
    setConfirmModal(EMPTY_CONFIRM);
  }, [confirmModal]);

  const handleCancel = useCallback(() => {
    confirmModal.resolve?.(false);
    setConfirmModal(EMPTY_CONFIRM);
  }, [confirmModal]);

  /* ───────────── Rows ───────────── */

  const handleRowClick = useCallback(
    (itemId) => {
      setContextItem(null);
      handleSelect(itemId);
    },
    [setContextItem, handleSelect],
  );

  const handleRowDoubleClick = useCallback(
    async (type, id, name) => {
      if (type === "google-directory") {
        window.open(`https://drive.google.com/drive/folders/${id}`, "_blank");
        return;
      }
      if (type === "directory") {
        navigate(`/directory/${id}`, {
          state: { dirContext: previousDirContext.current },
        });
        if (isMobile) {
          setPath((prev) =>
            [...prev, { id, name }].filter((p) => !p.name?.startsWith("root")),
          );
          restartAnimation();
          setMobileHeaderDirName(name);
        }
        return;
      }
      const item = combinedItems.find((i) => (i.id ?? i._id) === id);
      if (item) setViewItem(item);
      if (type === "google-file") return;
      try {
        await updateFileViewTime(id);
        setFilesList((prev) =>
          prev.map((item) =>
            item._id === id
              ? { ...item, viewedByMeTime: new Date().toISOString() }
              : item,
          ),
        );
      } catch (err) {
        console.log("err", err.message);
      }
    },
    [
      navigate,
      previousDirContext,
      isMobile,
      restartAnimation,
      combinedItems,
      setFilesList,
    ],
  );

  /* ───────────── Downloads ───────────── */

  const handleDownloadFolder = useCallback(
    async (item) => {
      showError("");
      const type = getResourceType(item);

      // for google drive folders
      if (type.startsWith("google")) {
        window.open(
          `https://drive.google.com/drive/folders/${item.id}`,
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
      const fileId = item._id;

      const controller = new AbortController();
      downloadControllers.current[fileId] = controller;

      setDownloadQueue((prev) => [
        ...prev.filter((f) => f._id !== fileId),
        item,
      ]);

      setDownloadProgressMap((prev) => ({ ...prev, [fileId]: 0 }));

      try {
        const response = await fetch(
          `${BASE_URL}/directory/${fileId}/download`,
          { credentials: "include", signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Download failed");
        }

        const total = Number(response.headers.get("Content-Length") || 0);
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          received += value.length;

          if (total > 0) {
            const progress = Math.round((received / total) * 100);
            setDownloadProgressMap((prev) => ({
              ...prev,
              [fileId]: progress,
            }));
          }
        }

        const blob = new Blob(chunks);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = `${item.name}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setDownloadProgressMap((prev) => ({ ...prev, [fileId]: 100 }));

        // remove only AFTER download finishes
        setTimeout(() => {
          setDownloadQueue((prev) => prev.filter((f) => f._id !== fileId));
          setDownloadProgressMap((prev) => {
            const next = { ...prev };
            delete next[fileId];
            return next;
          });
        }, 1000);
      } catch (err) {
        if (err.status === 429) {
          // NOTE: `setError` is not defined in this hook (see notes).
          setError("Too many requests. Try again later.");
          return;
        }
        if (err.name === "AbortError") {
          console.log("Download cancelled");
        } else {
          console.error("Download error:", err);
          showError(err.message);
        }

        setDownloadQueue((prev) => prev.filter((f) => f._id !== fileId));
        setDownloadProgressMap((prev) => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
      } finally {
        delete downloadControllers.current[fileId];
      }
    },
    [showError],
  );

  const handleCancelDownload = useCallback((fileId) => {
    const controller = downloadControllers.current[fileId];
    if (controller) {
      controller.abort();
    }
  }, []);

  const handleDownload = useCallback(
    (item) => {
      try {
        const url = isGoogleDriveRoute
          ? `${BASE_URL}/auth/google-drive/download?fileId=${item.id}`
          : `${BASE_URL}/file/${item._id}?action=download`;

        const a = document.createElement("a");
        a.href = url;
        a.style.display = "none";

        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        if (err.status === 429) {
          setError("Too many requests. Try again later.");
          return;
        }
        console.error("Download error:", err);
        showError(err.message);
      }
    },
    [isGoogleDriveRoute, showError],
  );

  /* ───────────── Sharing ───────────── */

  const handleToggleResourcePublic = useCallback(
    async (item, role, access) => {
      setIsShareLoading(true);

      const isMultiShare = selectedItems.size > 1;

      try {
        const restricted = access === "restricted";
        const userRole = toDriveRole(role);

        // In multi mode `peopleWithAccess` is the COMMON permission set, so the
        // per-item permissions are the only correct source of truth there.
        const currentPermissions = isMultiShare
          ? (item.permissions ?? [])
          : peopleWithAccess;

        const publicPermission = currentPermissions.find(isAnyone);
        const currentAccess = publicPermission ? "anyone" : "restricted";
        const currentRole = publicPermission
          ? toDriveRole(publicPermission.role)
          : null;

        // Nothing to do
        if (currentAccess === access) {
          if (restricted) return;
          if (currentRole === userRole) return;
        }

        const itemId = item._id ?? item.id;
        const type = getResourceType(item);
        const isFolder =
          Boolean(item.isDirectory) ||
          item.mimeType === "application/vnd.google-apps.folder";
        const iconType = isFolder ? null : getFileType(item?.name || "");

        // Revert the modal UI when the user cancels a confirmation.
        // (Multi mode has no shared link state, so nothing to revert.)
        const revertLinkState = () => {
          if (isMultiShare) return;
          setLinkAccess(publicPermission ? "anyone" : "restricted");
          setLinkRole(currentRole || "reader");
          setPeopleWithAccess(prevPermissions);
        };

        const buildChain = ({
          ancestorId,
          ancestorName,
          ancestorRole,
          toLabel,
        }) => [
          {
            id: ancestorId,
            name: ancestorName,
            fromLabel: `Anyone with the link → ${ancestorRole}`,
            toLabel,
            isDirectory: true,
            iconType: null,
          },
          {
            id: itemId,
            name: item.name,
            fromLabel: `Anyone with the link → ${currentRole ?? "restricted"}`,
            toLabel,
            isDirectory: isFolder,
            iconType,
          },
        ];

        let permission = null;
        let isMe;
        let myRole;
        let updatedParentId;

        /* ───────────── Google Drive route ───────────── */
        if (isGoogleDriveRoute) {
          if (restricted) {
            const dryRun = await revokeFileAccess(
              "google",
              itemId,
              "anyoneWithLink",
            );

            if (dryRun?.needsConfirmation) {
              const { ancestorId, ancestorName, previousRole } =
                dryRun.conflict;
              updatedParentId = ancestorId;

              const confirmed = await showCascadeConfirm(
                buildChain({
                  ancestorId,
                  ancestorName,
                  ancestorRole: previousRole,
                  toLabel: "restricted",
                }),
              );

              if (!confirmed) {
                revertLinkState();
                return;
              }

              await revokeFileAccess(
                "google",
                itemId,
                "anyoneWithLink",
                null,
                true,
              );
            }
          } else {
            const dryRun = await toggleDriveFilePermission(itemId, userRole);

            if (dryRun?.needsConfirmation) {
              const { ancestorId, ancestorName, ancestorRole } =
                dryRun.conflict;
              updatedParentId = ancestorId;

              const confirmed = await showCascadeConfirm(
                buildChain({
                  ancestorId,
                  ancestorName,
                  ancestorRole,
                  toLabel: userRole,
                }),
              );

              if (!confirmed) {
                revertLinkState();
                return;
              }

              const data = await toggleDriveFilePermission(
                itemId,
                userRole,
                true,
              );
              permission = data.permission;
            } else {
              permission = dryRun.permission;
            }
          }
        } else {
          /* ───────────── Local route ───────────── */
          const incomingRole = currentPermissions.find(
            (p) => p.emailAddress === user.email,
          );
          const isOwnerViewing = item.owners?.some(
            (o) => o.emailAddress === user.email,
          );

          isMe = incomingRole ? true : !isOwnerViewing;
          myRole = incomingRole?.role;

          // Will lose ability to share
          if (
            isMe &&
            (((userRole === "reader" || restricted) && myRole === "reader") ||
              myRole === "remove")
          ) {
            const confirmed = await showConfirmModal(
              "You will not be able to share. Are you sure?",
            );
            if (!confirmed) {
              revertLinkState();
              return;
            }
          }

          // Will lose all access
          if (
            restricted &&
            isMe &&
            (myRole === undefined || myRole === "remove")
          ) {
            const confirmed = await showConfirmModal(
              "You will no longer have access. Are you sure?",
            );
            if (!confirmed) {
              revertLinkState();
              return;
            }
          }

          let result = await toggleFilePublic(itemId, userRole, access, type);

          if (result?.needsConfirmation) {
            const { ancestorId, ancestorName, ancestorRole } = result.conflict;
            updatedParentId = ancestorId;

            const confirmed = await showCascadeConfirm(
              buildChain({
                ancestorId,
                ancestorName,
                ancestorRole,
                toLabel: restricted ? "Restricted" : userRole,
              }),
            );

            if (!confirmed) {
              revertLinkState();
              return;
            }

            result = await toggleFilePublic(
              itemId,
              userRole,
              access,
              type,
              true,
            );
          }

          // Use the server permission (with its id) if the API returns one
          permission = result?.permission ?? null;
        }

        /* ───────────── Update lists ───────────── */
        const allIdsToBeMatched = [
          updatedParentId,
          itemId,
          ...(isGoogleDriveRoute ? (item.childrenIds ?? []) : []),
        ]
          .filter(Boolean)
          .map(String);

        const matches = (resource) => {
          const resourceId = String(resource?._id ?? resource?.id);
          const parentDirId = String(
            resource?.parentDirId ?? resource?.parents?.[0],
          );
          return (
            allIdsToBeMatched.includes(resourceId) ||
            allIdsToBeMatched.includes(parentDirId)
          );
        };

        const lostAccess =
          restricted && isMe && (myRole === "remove" || myRole === undefined);

        const applyLinkUpdate = (list) =>
          lostAccess
            ? list.filter((resource) => !matches(resource))
            : list.map((resource) => {
                if (!matches(resource)) return resource;

                const others = (resource.permissions ?? []).filter(
                  (p) => !isAnyone(p),
                );

                return {
                  ...resource,
                  capabilities: {
                    ...resource.capabilities,
                    canShare: isMe
                      ? userRole !== "reader" || myRole !== "reader"
                      : true,
                  },
                  isPublic: !restricted,
                  publicRole: restricted ? null : userRole,
                  permissions: restricted
                    ? others
                    : [
                        ...others,
                        {
                          ...(permission ?? {}),
                          type: "anyone",
                          role: userRole,
                        },
                      ],
                };
              });

        setFilesList(applyLinkUpdate);
        setDirectoriesList(applyLinkUpdate);

        /* ───────────── Update modal state (single mode only) ───────────── */
        const updatedPeopleWithAccess = peopleWithAccess
          .map((p) => {
            if (p?.role === "remove" && userRole === "writer") return null;
            if (restricted && isAnyone(p)) return null;
            if (!restricted && isAnyone(p)) {
              return {
                ...p,
                id: "anyoneWithLink",
                type: "anyone",
                role: userRole,
              };
            }
            return p;
          })
          .filter(Boolean);

        if (!restricted && !updatedPeopleWithAccess.some(isAnyone)) {
          updatedPeopleWithAccess.push({
            id: "anyoneWithLink",
            type: "anyone",
            role: userRole,
            allowFileDiscovery: false,
          });
        }

        if (!isMultiShare) {
          setPeopleWithAccess(updatedPeopleWithAccess);
          setPrevPermissions(updatedPeopleWithAccess); // keeps "Pending changes" from showing
          setLinkAccess(restricted ? "restricted" : "anyone");
          setLinkRole(restricted ? "reader" : userRole);
        }

        /* ───────────── User chose to drop their own "remove" pending change ───────────── */
        if (!isMultiShare && myRole === "remove") {
          const personsToRemove = peopleWithAccess.filter(
            (p) => p?.role === "remove",
          );
          const removeType = item.isDirectory ? "folder" : "file";

          const messages = await Promise.all(
            personsToRemove.map((person) =>
              revokeFileAccess(removeType, itemId, person.id, person.role),
            ),
          );

          const setList =
            removeType === "folder" ? setDirectoriesList : setFilesList;
          const sameItem = (resource) =>
            String(resource?._id ?? resource?.id) === String(itemId);

          if (userRole === "reader") {
            setList((prev) =>
              restricted
                ? prev.filter((r) => !sameItem(r))
                : prev.map((r) =>
                    sameItem(r)
                      ? {
                          ...r,
                          capabilities: {
                            ...r.capabilities,
                            canShare: false,
                            canRename: false,
                          },
                          permissions: updatedPeopleWithAccess,
                        }
                      : r,
                  ),
            );
            setPeopleWithAccess(updatedPeopleWithAccess);
            setPrevPermissions(updatedPeopleWithAccess);
            setShareItem(null);
          } else {
            setList((prev) =>
              prev.map((r) =>
                sameItem(r)
                  ? { ...r, permissions: updatedPeopleWithAccess }
                  : r,
              ),
            );
            setPeopleWithAccess(updatedPeopleWithAccess);
            setPrevPermissions(updatedPeopleWithAccess);
            setShareItem((prev) =>
              Array.isArray(prev)
                ? prev
                : prev
                  ? { ...prev, permissions: updatedPeopleWithAccess }
                  : prev,
            );
          }

          toast({ message: messages, type: "success" }); // unchanged from original
          return;
        }

        toast({ message: "Public Access updated", type: "success" });
      } catch (error) {
        if (error.status === 429) {
          setError("Too many requests. Try again later.");
          return;
        }
        toast({
          message: error?.message || "Something went wrong!",
          type: "error",
        });
      } finally {
        setIsShareLoading(false);
      }
    },
    [
      selectedItems,
      peopleWithAccess,
      prevPermissions,
      isGoogleDriveRoute,
      user,
      showCascadeConfirm,
      showConfirmModal,
      setFilesList,
      setDirectoriesList,
      toast,
    ],
  );

  const handleSharedRoleUpdate = useCallback(
    async (item, type, message) => {
      setIsShareLoading(true);
      const itemId = item._id ?? item.id;
      let confirmCascade = false;

      let updatedParentId;

      try {
        const allPermissions = item?.permissions ?? [];

        const mergedPermissions = allPermissions.map((permission) => {
          const changedPermission = peopleWithAccess.find(
            (person) => String(person.id) === String(permission.id),
          );

          if (!changedPermission) {
            return permission;
          }

          return { ...permission, role: changedPermission.role };
        });

        const newPermissions = mergedPermissions.filter(
          (permission) =>
            permission?.type !== "anyone" && permission?.role !== "owner",
        );

        const previousEditablePermissions = (item?.permissions ?? []).filter(
          (permission) =>
            permission?.type !== "anyone" && permission?.role !== "owner",
        );

        const prevRole = previousEditablePermissions.find(
          (p) => p.emailAddress === userRole.emailAddress,
        )?.role;

        const incomingRole = newPermissions.find(
          (p) => p.emailAddress === userRole.emailAddress,
        );

        const myRole = incomingRole?.role;

        const isMe = incomingRole
          ? (incomingRole?.emailAddress ?? incomingRole.emailAddress) ===
            user.email
          : false;
        const publicRole = linkRole;

        if (
          publicRole &&
          publicRole === "reader" &&
          myRole === "reader" &&
          isMe
        ) {
          const confirmed = await showConfirmModal(
            "You will not be able to share. Are you sure?",
          );

          if (!confirmed) {
            setPeopleWithAccess(prevPermissions);
            return;
          }
        }

        if (linkAccess === "restricted" && myRole === "remove" && isMe) {
          const confirmed = await showConfirmModal(
            "You will no longer have access. Are you sure?",
          );
          if (!confirmed) {
            setPeopleWithAccess(prevPermissions);
            return;
          }
        }

        const dryRun = await updateSharedAccess({
          item,
          type,
          peopleWithAccess: newPermissions,
          prevPermissions: previousEditablePermissions,
          message,
          grantAccessById,
          revokeFileAccess,
          confirmCascade,
        });

        if (!dryRun?.changed) {
          setShareItem(null);
          return;
        }

        if (dryRun?.response?.needsConfirmation) {
          const { ancestorId, ancestorName, previousRole, requestedRole } =
            dryRun.response.conflict[0] || dryRun.response.conflict;
          updatedParentId = ancestorId;
          const iconType =
            (item.isDirectory ??
            item.mimeType === "application/vnd.google-apps.folder")
              ? null
              : getFileType(item?.name || "");

          const chain = [
            {
              id: ancestorId,
              name: ancestorName,
              fromLabel: `${previousRole}`,
              toLabel: ` → ${DRIVE_ROLES[requestedRole] || requestedRole || "remove"}`,
              isDirectory: true,
              iconType: null,
            },
            {
              id: dryRun.itemId,
              name: item.name,
              fromLabel: `${DRIVE_ROLES[prevRole] || prevRole}`,
              toLabel: ` → ${DRIVE_ROLES[myRole] || myRole}`,
              isDirectory:
                item.isDirectory ||
                item.mimeType === "application/vnd.google-apps.folder",
              iconType,
            },
          ];
          const publicPermission = peopleWithAccess.find(
            (p) => p.type === "anyone",
          );
          const confirmed = await showCascadeConfirm(chain);
          if (!confirmed) {
            const currentPublicRole = publicPermission?.role;
            setLinkAccess(currentPublicRole ? "anyone" : "restricted");
            setLinkRole(currentPublicRole || "reader");
            setPeopleWithAccess(prevPermissions);
            return;
          }

          confirmCascade = true;
        }
        if (confirmCascade) {
          const result = await updateSharedAccess({
            item,
            type,
            peopleWithAccess: newPermissions,
            prevPermissions: previousEditablePermissions,
            message,
            grantAccessById,
            revokeFileAccess,
            confirmCascade,
          });

          if (!result?.changed) {
            setShareItem(null);
            return;
          }
        }

        const updatedPeopleWithAccess = peopleWithAccess
          .map((p) => {
            if (p.role === "remove") return null;
            if (p.type === "anyone") return { ...p, role: linkRole };
            return p;
          })
          .filter(Boolean);

        const allIdsToBeMatched = [
          updatedParentId,
          itemId,
          ...(isGoogleDriveRoute ? (item.childrenIds ?? []) : []),
        ].filter(Boolean);

        const update = (list) =>
          linkAccess === "restricted" && myRole === "remove" && isMe
            ? list.filter((resource) => {
                const resourceId = String(resource?.id ?? resource?._id);
                const parentDirId = String(
                  resource?.parentDirId ?? resource?.parents?.[0],
                );

                return (
                  !allIdsToBeMatched.includes(resourceId) &&
                  !allIdsToBeMatched.includes(parentDirId)
                );
              })
            : list.map((resource) => {
                const resourceId = String(resource?._id ?? resource?.id);
                const parentDirId = String(
                  resource?.parentDirId ?? resource?.parents?.[0],
                );

                if (
                  !allIdsToBeMatched.includes(resourceId) &&
                  !allIdsToBeMatched.includes(parentDirId)
                ) {
                  return resource;
                }

                return {
                  ...resource,
                  capabilities: {
                    ...resource.capabilities,
                    canShare: isMe
                      ? publicRole !== "reader" || myRole !== "reader"
                      : true,
                    canRename: isMe
                      ? publicRole !== "reader" || myRole !== "reader"
                      : true,
                  },
                  permissions: updatedPeopleWithAccess,
                };
              });

        setFilesList((prev) => update(prev));
        setDirectoriesList((prev) => update(prev));
        setPeopleWithAccess(updatedPeopleWithAccess);
        setPrevPermissions(updatedPeopleWithAccess);
        setShareItem(null);

        toast({ message: "Access updated", type: "success" });
      } catch (error) {
        if (error.status === 429) {
          setError("Too many requests. Try again later.");
          return;
        }
        console.error("handleSharedRoleUpdate:", error);

        toast({
          message: error?.message || "Something went wrong!",
          type: "error",
        });
      } finally {
        setIsShareLoading(false);
      }
    },
    [
      userRole,
      user,
      linkRole,
      linkAccess,
      peopleWithAccess,
      prevPermissions,
      isGoogleDriveRoute,
      showConfirmModal,
      showCascadeConfirm,
      setFilesList,
      setDirectoriesList,
      toast,
    ],
  );

  /* ───────────── Copy ───────────── */

  const handleCopyItems = useCallback(
    async (items) => {
      try {
        showError("");

        const providerType = items.some((item) => item?.webViewLink)
          ? "google"
          : "local";

        const {
          message,
          data: { copiedItems },
        } = await copyItem({ items, providerType });

        toast({ message, type: "success" });

        const isInsideItem =
          isMobile &&
          items.some((item) => String(item._id) === String(lastDirectory?._id));

        if (isInsideItem) return;

        const newFolders = [];
        const newFiles = [];

        copiedItems.forEach((result, index) => {
          const item = items[index];
          const type = item.isDirectory ? "folder" : "file";

          const newItem = {
            ...result.copiedItem,
            owners: result.owners || [],
            capabilities: result.capabilities || {},
            permissions: result.permissions || [],
            sortName: item.name,
            sortModifiedTime: item.modifiedTime || item.updatedAt,
            isDirectory: type === "folder",
          };

          if (type === "folder") {
            newFolders.push(newItem);
          } else {
            newFiles.push(newItem);
          }
        });

        if (newFolders.length) {
          setDirectoriesList((prev) => [...newFolders, ...prev]);
        }

        if (newFiles.length) {
          setFilesList((prev) => [...newFiles, ...prev]);
        }
      } catch (error) {
        if (error.status === 429) {
          setError("Too many requests. Try again later.");
          return;
        }
        showError(
          error?.response?.data?.message ||
            error?.message ||
            "Failed to copy items",
        );
      }
    },
    [
      showError,
      toast,
      isMobile,
      lastDirectory,
      setDirectoriesList,
      setFilesList,
    ],
  );

  /* ───────────── Trash / restore / delete ───────────── */

  const handleMoveToTrash = useCallback(
    async (input, isUndo = false) => {
      try {
        showError("");

        // Normalize single item or array into an array
        const items = Array.isArray(input) ? input : input ? [input] : [];

        if (!items.length) return;

        const fileIds = items
          .filter((i) => !i.isDirectory)
          .map((i) => i._id ?? i.id);

        const dirIds = items
          .filter((i) => i.isDirectory)
          .map((i) => i._id ?? i.id);

        const responses = await Promise.all([
          fileIds.length ? softDeleteFile("/file/soft-delete", fileIds) : null,
          dirIds.length
            ? softDeleteFile("/directory/soft-delete", dirIds)
            : null,
        ]);

        const trashedIds = new Set(
          responses
            .filter(Boolean)
            .flatMap((r) => r.trashedIds ?? [])
            .map(String),
        );

        const trashed = items.filter((i) =>
          trashedIds.has(String(i._id ?? i.id)),
        );

        if (trashed.length) {
          await refreshUser();

          const noun = trashed.every((i) => !i.isDirectory)
            ? "file"
            : trashed.every((i) => i.isDirectory)
              ? "folder"
              : "item";

          const ids = new Set(trashed.map((i) => String(i._id ?? i.id)));

          setDirectoriesList((prev) =>
            prev.filter((i) => !ids.has(String(i._id ?? i.id))),
          );

          setFilesList((prev) =>
            prev.filter((i) => !ids.has(String(i._id ?? i.id))),
          );

          if (isUndo) return;
          toast({
            message: `${trashed.length} ${noun}${trashed.length === 1 ? "" : "s"} moved to trash`,
            type: "success",
            duration: 5000,
            undoAction: {
              type: "trash",
              items: trashed,
              onUndo: () =>
                handleUndoRef.current?.({ type: "trash", items: trashed }),
            },
          });
        }

        if (trashed.length < items.length) {
          showError(
            `${items.length - trashed.length} item(s) couldn't be moved to trash`,
          );
        }

        clearSelection();
      } catch (err) {
        if (err.response?.status === 429) {
          showError("Too many requests. Please slow down.");
          return;
        }

        showError(err.response?.data?.message ?? err.message);
      }
    },
    [
      showError,
      refreshUser,
      setDirectoriesList,
      setFilesList,
      toast,
      clearSelection,
    ],
  );

  const handleRestoreItem = useCallback(
    async (items, isUndo = false) => {
      try {
        showError("");

        const fileIds = items
          .filter((i) => !i.isDirectory)
          .map((i) => i._id ?? i.id);

        const dirIds = items
          .filter((i) => i.isDirectory)
          .map((i) => i._id ?? i.id);

        // Allow files and folders to restore independently.
        const results = await Promise.allSettled([
          fileIds.length
            ? restoreFile("/file/restore", fileIds)
            : Promise.resolve(null),

          dirIds.length
            ? restoreFile("/directory/restore", dirIds)
            : Promise.resolve(null),
        ]);

        const restoredIds = new Set(
          results
            .filter((r) => r.status === "fulfilled" && r.value)
            .flatMap((r) => (r.value.restoredIds ?? []).map(String)),
        );

        const restored = items.filter((i) =>
          restoredIds.has(String(i._id ?? i.id)),
        );

        // Update successfully restored items.
        if (restored.length) {
          await refreshUser();
          setDirectoriesList((prev) =>
            prev.filter((i) => !restoredIds.has(String(i.id ?? i._id))),
          );

          setFilesList((prev) =>
            prev.filter((i) => !restoredIds.has(String(i.id ?? i._id))),
          );
          if (isUndo) return;
          toast({
            message: `${restored.length} item${restored.length === 1 ? "" : "s"} restored`,
            type: "success",
            undoAction: {
              type: "restore",
              items: restored,
              onUndo: () =>
                handleUndoRef.current?.({ type: "restore", items: restored }),
            },
          });
        }

        // Handle individual API failures.
        const failure = results.find((r) => r.status === "rejected");

        if (failure) {
          const status = failure.reason?.response?.status;

          if (status === 401) {
            navigate("/login");
            return;
          }

          showError(
            status === 507
              ? (failure.reason?.response?.data?.message ??
                  "Free up space to restore these items.")
              : (failure.reason?.response?.data?.message ??
                  failure.reason?.message ??
                  "Failed to restore some items."),
          );
        }
      } catch (error) {
        console.error("Restore error:", error);
        if (error.status === 429) {
          setError("Too many requests. Try again later.");
          return;
        }
        const status = error.response?.status;

        if (status === 401) {
          navigate("/login");
          return;
        }

        showError(
          error.response?.data?.message ??
            error.message ??
            "Something went wrong while restoring items.",
        );
      } finally {
        clearSelection();
      }
    },
    [
      showError,
      refreshUser,
      setDirectoriesList,
      setFilesList,
      toast,
      navigate,
      clearSelection,
    ],
  );

  const handleDelete = useCallback(
    async (items, type) => {
      try {
        showError("");

        const fileIds = items
          .filter((i) => !i.isDirectory)
          .map((i) => i._id ?? i.id);

        const dirIds = items
          .filter((i) => i.isDirectory)
          .map((i) => i._id ?? i.id);

        const responses = await Promise.all([
          fileIds.length
            ? deleteFile(`/file?type=${type}`, fileIds, type)
            : null,
          dirIds.length ? deleteFile("/directory", dirIds) : null,
        ]);

        const deletedIds = new Set(
          responses.filter(Boolean).flatMap((r) => r.deletedIds ?? []),
        );

        const deleted = items.filter((i) =>
          deletedIds.has(String(i._id ?? i.id)),
        );

        if (deleted.length) {
          await refreshUser();

          const areAllFiles = deleted.every((i) => !i.isDirectory);
          const areAllFolders = deleted.every((i) => i.isDirectory);
          const noun = areAllFiles ? "file" : areAllFolders ? "folder" : "item";

          toast({
            message: `${deleted.length} ${noun}${deleted.length === 1 ? "" : "s"} deleted permanently`,
            type: "success",
          });

          setViewItem(null);

          setDirectoriesList((prev) =>
            prev.filter((i) => !deletedIds.has(String(i._id ?? i.id))),
          );

          setFilesList((prev) =>
            prev.filter((i) => !deletedIds.has(String(i._id ?? i.id))),
          );
        }

        if (deleted.length < items.length) {
          showError(
            `${items.length - deleted.length} item(s) couldn't be deleted`,
          );
        }

        clearSelection();
      } catch (err) {
        if (err.response?.status === 429) {
          showError("Too many requests. Please slow down.");
          return;
        }

        showError(err.response?.data?.message ?? err.message);
      }
    },
    [
      showError,
      refreshUser,
      toast,
      setDirectoriesList,
      setFilesList,
      clearSelection,
    ],
  );

  /* ───────────── Create / rename ───────────── */

  const handleCreateDirectory = useCallback(
    async (e) => {
      e.preventDefault();
      showError("");
      setIsActionLoading(true);

      const type = isGoogleDriveRoute ? "google" : "local";
      try {
        // NOTE: `addDirectory` and `dirId` are not defined (see notes).
        const response = await addDirectory(dirId, newDirname, type);
        setShowCreateDir(false);
        setNewDirname("Untitled folder");
        setDirectoriesList((prev) => [response.data, ...prev]);
      } catch (err) {
        if (err.status === 429) {
          setError("Too many requests. Try again later.");
          return;
        }
        showError(err.message);
      } finally {
        setIsActionLoading(false);
      }
    },
    [showError, isGoogleDriveRoute, newDirname, setDirectoriesList],
  );

  const openRename = useCallback((item) => {
    setRenameType(
      item?.webViewLink ? "google" : item.isDirectory ? "directory" : "file",
    );
    setRenameId(item._id ?? item.id);
    setRenameValue(item.name);
    setShowRename(true);
  }, []);

  const handleRenameSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      showError("");
      try {
        setIsActionLoading(true);
        const url =
          renameType === "file" || renameType === "google"
            ? `/file/${renameId}?type=${renameType}`
            : `/directory/${renameId}`;
        const body =
          renameType === "google" || renameType === "file"
            ? { fileName: renameValue }
            : { newDirName: renameValue };

        const { data } = await axiosWithCreds.patch(url, body);
        setShowRename(false);

        toast({ message: data.message, type: "success" });

        if (viewItem) {
          setViewItem((prev) => ({ ...prev, name: renameValue }));
        }

        if (isMobile) {
          // NOTE: `setPath` is not defined in this hook (see notes).
          setPath((prev) =>
            prev.map((item) =>
              item.id === renameId ? { ...item, name: renameValue } : item,
            ),
          );
          setLastDirectory((prev) =>
            prev._id === renameId ? { ...prev, name: renameValue } : prev,
          );
        }

        setDirectoriesList((prev) =>
          prev.map((item) =>
            (item.id ?? item._id) === renameId
              ? { ...item, name: renameValue }
              : item,
          ),
        );
        setFilesList((prev) =>
          prev.map((item) =>
            (item.id ?? item._id) === renameId
              ? {
                  ...item,
                  name: renameValue,
                  modifiedByMeTime: new Date().toISOString(),
                }
              : item,
          ),
        );
      } catch (err) {
        if (err.status === 429) {
          setError("Too many requests. Try again later.");
          return;
        }
        showError(err.message);
      } finally {
        setIsActionLoading(false);
      }
    },
    [
      showError,
      renameType,
      renameId,
      renameValue,
      viewItem,
      isMobile,
      toast,
      setLastDirectory,
      setDirectoriesList,
      setFilesList,
    ],
  );

  /* ───────────── Star ───────────── */

  const handleToggleStar = useCallback(
    async (items, isUndo = false) => {
      showError("");

      // Support both single item and multiple items
      const selectedItems = Array.isArray(items) ? items : [items];

      if (!selectedItems.length || !selectedItems[0]) return;

      const previousStates = selectedItems.map((item) => ({
        id: String(item._id),
        starred: Boolean(isStarred[item._id]),
      }));

      try {
        await Promise.all(
          selectedItems.map((item) =>
            toggleItemStar(item._id, item.isDirectory ? "folder" : "file"),
          ),
        );

        // Update starred state
        setIsStarred((prev) => {
          const updated = { ...prev };
          selectedItems.forEach((item) => {
            updated[item._id] = !Boolean(prev[item._id]);
          });
          return updated;
        });

        const ids = new Set(selectedItems.map((item) => String(item._id)));

        if (isStarredRoute) {
          if (isUndo) {
            setDirectoriesList((prev) => [
              ...prev,
              ...selectedItems.filter((item) => item.isDirectory),
            ]);

            setFilesList((prev) => [
              ...prev,
              ...selectedItems.filter((item) => !item.isDirectory),
            ]);
          } else {
            setDirectoriesList((prev) =>
              prev.filter((item) => !ids.has(String(item._id))),
            );

            setFilesList((prev) =>
              prev.filter((item) => !ids.has(String(item._id))),
            );
          }
        }

        if (isUndo) return;

        const allStarred = previousStates.every((item) => item.starred);
        const allFiles = selectedItems.every((item) => !item.isDirectory);
        const allFolders = selectedItems.every((item) => item.isDirectory);

        const noun = allFiles ? "file" : allFolders ? "folder" : "item";
        const action = allStarred ? "removed from" : "added to";

        toast({
          message: `${selectedItems.length} ${noun}${selectedItems.length === 1 ? "" : "s"} ${action} starred`,
          type: "success",
          undoAction: {
            type: "star",
            items: selectedItems,
            // Goes through a ref so the undo always uses the latest closure.
            onUndo: () => handleToggleStarRef.current?.(selectedItems, true),
          },
        });
      } catch (error) {
        if (error.response?.status === 429 || error.status === 429) {
          showError("Too many requests. Try again later.");
          return;
        }

        showError(error.response?.data?.message ?? error.message);
      }
    },
    [
      showError,
      isStarred,
      isStarredRoute,
      setIsStarred,
      setDirectoriesList,
      setFilesList,
      toast,
    ],
  );

  /* ───────────── Undo (defined after the handlers it calls) ───────────── */

  const handleUndo = useCallback(
    async (undoAction) => {
      try {
        if (!undoAction) return;
        const items = undoAction?.items;

        if (undoAction.type === "trash") {
          await handleRestoreItem(items, true);

          const folders = items.filter((item) => item.isDirectory);
          const files = items.filter((item) => !item.isDirectory);
          if (!isTrashRoute) {
            setDirectoriesList((prev) => [...prev, ...folders]);
            setFilesList((prev) => [...prev, ...files]);
          }
        }
        if (undoAction.type === "restore") {
          await handleMoveToTrash(items, true);
          const folders = items.filter((item) => item.isDirectory);
          const files = items.filter((item) => !item.isDirectory);

          if (previousDirContext.current === "trash") {
            setDirectoriesList((prev) => [...prev, ...folders]);
            setFilesList((prev) => [...prev, ...files]);
          } else {
            const ids = Array.isArray(items)
              ? new Set(items.map((item) => String(item._id ?? item.id)))
              : new Set(items._id ?? items.id);

            setDirectoriesList((prev) =>
              prev.filter((item) => !ids.has(String(item._id))),
            );

            setFilesList((prev) =>
              prev.filter((item) => !ids.has(String(item._id))),
            );
          }
        }
        if (undoAction.type === "star") {
          await handleToggleStar(items, true);

          if (previousDirContext.current === "starred") {
            const folders = items.filter((item) => item.isDirectory);
            const files = items.filter((item) => !item.isDirectory);

            setDirectoriesList((prev) => [...prev, ...folders]);
            setFilesList((prev) => [...prev, ...files]);
          }
        }
        toast({ message: "Action undone", type: "success" });
      } catch (error) {
        console.log("error", error);
      }
    },
    [
      handleRestoreItem,
      handleMoveToTrash,
      handleToggleStar,
      isTrashRoute,
      previousDirContext,
      setDirectoriesList,
      setFilesList,
      toast,
    ],
  );

  // Keep the refs pointed at the latest handlers.
  useEffect(() => {
    handleUndoRef.current = handleUndo;
  }, [handleUndo]);

  useEffect(() => {
    handleToggleStarRef.current = handleToggleStar;
  }, [handleToggleStar]);

  return {
    isActionLoading,
    isShareLoading,
    setIsShareLoading,
    handleCascadeConfirm,
    handleCascadeCancel,
    handleRowClick,
    handleRowDoubleClick,
    handleCopyItems,
    handleUndo,
    handleDownloadFolder,
    handleDownload,
    handleCancel,
    handleConfirm,
    handleCancelDownload,
    handleMoveToTrash,
    handleDelete,
    handleRestoreItem,
    handleCreateDirectory,
    openRename,
    handleRenameSubmit,
    handleToggleStar,
    handleToggleResourcePublic,
    handleSharedRoleUpdate,
    mobileHeaderDirName,
    path,
    setPath,
    showCreateDir,
    setShowCreateDir,
    showRename,
    setShowRename,
    renameValue,
    setRenameValue,
    shareItem,
    setShareItem,
    viewItem,
    setViewItem,
    moveItem,
    setMoveItem,
    downloadQueue,
    downloadProgressMap,
    prevPermissions,
    setPrevPermissions,
    peopleWithAccess,
    setPeopleWithAccess,
    setUserRole,
    linkRole,
    setLinkRole,
    linkAccess,
    setLinkAccess,
    cascadeModal,
    confirmModal,
  };
}

export default useDriveActions;
