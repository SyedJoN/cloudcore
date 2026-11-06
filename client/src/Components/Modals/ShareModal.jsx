import { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  IconClose,
  IconPersonAdd,
  IconLink,
  IconCheck,
  IconChevronDown,
  IconGlobe,
} from "../Icons/Icons.jsx";
import RoleDropdown from "../Dropdowns/RoleDropdown.jsx";
import {
  DRIVE_ROLES,
  ROLE_DESC,
  ROLE_LABEL,
} from "../../../Utils/displayUtils.js";
import "./ShareModal.css";
import { useClickOutside } from "../../Hooks/useClickOutside.jsx";
import { UseAvatar } from "../../Hooks/useAvatar.jsx";
import { grantAccessById } from "../../../apis/fileApi.js";
import { useToast } from "../../Contexts/ToastContext.jsx";
import {
  cancelPendingOwnership,
  sendLink,
  sendOwnershipMail,
} from "../../../apis/resourceApi.js";
import { useAuth } from "../../Contexts/AuthContext.jsx";
import ConfirmationModal from "./ConfirmationModal.jsx";
import { getResourceType } from "../../../Utils/getResourceType.js";
import { updateItemState } from "../../../Utils/updateItemState.js";
import { GlobeAmericasIcon } from "@heroicons/react/24/solid";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import MouseTooltip from "../Tooltip/Tooltip.jsx";

export const ROLE_PRIORITY = {
  reader: 1,
  writer: 2,
  owner: 3,
};

/* ───────────── helpers ───────────── */

const getItemType = (it) =>
  it?.webViewLink ? "google" : it?.isDirectory ? "folder" : "file";

const getItemId = (it) => String(it?._id ?? it?.id);

const getItemUrl = (it) =>
  it?.webViewLink
    ? it.webViewLink
    : it
      ? `${window.location.origin}/${it.isDirectory ? "directory" : "file"}/${it._id}?usp=drive_link`
      : window.location.href;

// "2 files" | "3 folders" | "5 items" (mixed)
function getCountLabel(list) {
  const dirs = list.filter((i) => i?.isDirectory).length;
  const noun =
    dirs === list.length ? "folders" : dirs === 0 ? "files" : "items";
  return `${list.length} ${noun}`;
}

export default function ShareModal({
  item: itemProp = null, // single item (backward compatible)
  items = null, // NEW: array of items
  setItem = null,
  allUsers,
  setUserRole,
  selectedUsers,
  peopleWithAccess,
  setPeopleWithAccess,
  setSelectedUsers,
  setDirectoriesList,
  setFilesList,
  onClose,
  prevPermissions,
  setPrevPermissions,
  linkAccess,
  setLinkAccess,
  linkRole,
  setLinkRole,
  setShareItem,
  isShareLoading,
  setIsShareLoading,
  onUpdateRoleAfterSave,
  isGoogleDriveRoute,
}) {
  const { user } = useAuth();

  // Normalise: always work with an array, `item` is the first one.
  const shareItems = items?.length ? items : itemProp ? [itemProp] : [];
  const isMulti = shareItems.length > 1;
  const item = shareItems[0];

  const [emailInput, setEmailInput] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [message, setMessage] = useState("");
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showInviteSuggestions, setShowInviteSuggestions] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [activePerson, setActivePerson] = useState(null);
  const [showAccessDropdown, setShowAccessDropdown] = useState(false);

  const [isConfirmation, setIsConfirmation] = useState(false);
  const [isChanged, setIsChanged] = useState(false);

  const inviteRoleRef = useRef(null);
  const linkRoleRef = useRef(null);
  const personRefs = useRef([]);
  const suggestionsRef = useRef(null);
  const inviteSuggestionsRef = useRef(null);
  const accessDropdownRef = useRef(null);
  const prevRoleRef = useRef(null);
  const shareModalOverlayRef = useRef(null);
  const [notifyPeople, setNotifyPeople] = useState(true);
  const modalContentRef = useRef(null);
  const [modalHeight, setModalHeight] = useState(null);
  const [heightReady, setHeightReady] = useState(false);

  const type = getItemType(item);
  const isOwner = item?.owners?.[0]?.me === true;
  const capabilities = item?.capabilities || {};

  const canChangeRole = capabilities?.canChangeRole ?? true;
  // For multiple items the user must be able to share ALL of them
  const canShare = shareItems.every((it) => it?.capabilities?.canShare === true);

  const { toast } = useToast();

  // Title text
  const shareTitle = isMulti
    ? `Share ${getCountLabel(shareItems)}`
    : `Share "${item?.name}"`;
  const sendLinkTitle = isMulti
    ? `Send the links for ${getCountLabel(shareItems)}`
    : `Send the link for "${item?.name}"`;

  // Owners pool for the "send link" (no share permission) flow, de-duplicated
  const ownersPool = Object.values(
    shareItems
      .flatMap((it) => it?.owners ?? [])
      .reduce((acc, o) => {
        const key = o.emailAddress || o.email || o.id || o.permissionId;
        if (key && !acc[key]) acc[key] = o;
        return acc;
      }, {}),
  );

  useLayoutEffect(() => {
    const element = modalContentRef.current;
    if (!element) return;

    setModalHeight(element.scrollHeight);

    const observer = new ResizeObserver(() => {
      setModalHeight(element.scrollHeight);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Multi-select: permissions differ per item, so we only invite.
    if (isMulti) {
      setPeopleWithAccess([]);
      setPrevPermissions([]);
      setLinkAccess("restricted");
      setLinkRole("reader");
      return;
    }

    const permissions = item?.permissions ?? [];
    const linkPermission = permissions.find((p) => p?.type === "anyone");

    setPeopleWithAccess(permissions);
    setPrevPermissions(permissions);
    setLinkAccess(linkPermission ? "anyone" : "restricted");
    setLinkRole(linkPermission?.role || "reader");
  }, [item, isMulti]);

  useEffect(() => {
    const previous = prevPermissions ?? [];
    const current = peopleWithAccess ?? [];

    const equal =
      previous.length === current.length &&
      previous.every((prev) => {
        const prevId = String(prev?.id ?? prev?._id);

        const currentPermission = current.find(
          (p) => String(p?.id ?? p?._id) === prevId,
        );

        return currentPermission?.role === prev?.role;
      });

    setIsChanged(!equal);
  }, [prevPermissions, peopleWithAccess]);

  useClickOutside(suggestionsRef, () => setShowSuggestions(false));
  useClickOutside(inviteSuggestionsRef, () => setShowInviteSuggestions(false));
  useClickOutside(accessDropdownRef, () => setShowAccessDropdown(false));

  const suggestions = emailInput.trim()
    ? allUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(emailInput.toLowerCase()) ||
          u.email?.toLowerCase().includes(emailInput.toLowerCase()),
      )
    : allUsers;

  const inviteSuggestions = (
    inviteInput.trim()
      ? allUsers?.filter(
          (u) =>
            u.name?.toLowerCase().includes(inviteInput.toLowerCase()) ||
            u.email?.toLowerCase().includes(inviteInput.toLowerCase()),
        )
      : allUsers
  )?.filter((u) => !selectedUsers.find((s) => s.id === u.id));

  // Emails that should NOT be suggested (already owner / already has access).
  // With multiple items access differs per item, so only single mode excludes.
  function getExcludedEmails() {
    if (isMulti) return [];
    return [
      ...(item?.owners || []).map((o) => o.emailAddress),
      ...(peopleWithAccess ?? []).map((p) => p.emailAddress),
    ]
      .filter(Boolean)
      .map((e) => e.toLowerCase());
  }

  function handleSelectUser(e, user) {
    e.stopPropagation();
    setSelectedUsers([{ ...user, role: DRIVE_ROLES[inviteRole] }]);
    setEmailInput("");
    setShowSuggestions(false);
    setShowInvitePanel(true);
  }

  function handleAddUser(user) {
    if (selectedUsers.find((s) => s.id === user.id)) return;
    setSelectedUsers((prev) => [
      ...prev,
      { ...user, role: DRIVE_ROLES[inviteRole] },
    ]);
    setInviteInput("");
    setShowInviteSuggestions(false);
  }

  function handleRemoveSelected(id) {
    const next = selectedUsers.filter((u) => u.id !== id);
    setSelectedUsers(next);
    if (next.length === 0) {
      setShowInvitePanel(false);
      setMessage("");
    }
  }

  /* Share ONE item with selectedUsers and sync local state */
  async function shareWithItem(it) {
    const itemType = getItemType(it);
    const itemId = getItemId(it);

    const response = await grantAccessById(
      itemType,
      itemId,
      selectedUsers,
      message,
      false,
      notifyPeople,
    );

    let updatedUsers;

    if (!isGoogleDriveRoute) {
      updatedUsers = selectedUsers.map((u) => ({
        id: u.id,
        photoLink: u.avatar,
        displayName: u.name,
        type: "user",
        emailAddress: u.email,
        role: DRIVE_ROLES[u.role] ?? u.role,
      }));
    } else {
      updatedUsers = response?.permissions?.map((u) => ({
        id: u.id,
        photoLink: u.avatar,
        displayName: u.displayName,
        type: "user",
        emailAddress: u.emailAddress,
        role: DRIVE_ROLES[u.role] ?? u.role,
      }));
    }

    const currentPermissions = it?.permissions ?? [];

    const updatedPermissions = currentPermissions.map((permission) => {
      const updatedUser = updatedUsers?.find(
        (u) => String(u.id) === String(permission.id),
      );

      if (!updatedUser) return permission;
      if (permission.role === "owner") return permission;

      return { ...permission, ...updatedUser };
    });

    const existingIds = new Set(
      currentPermissions.map((permission) => String(permission.id)),
    );

    const newPermissions =
      updatedUsers?.filter((u) => !existingIds.has(String(u.id))) ?? [];

    const finalPermissions = [...updatedPermissions, ...newPermissions];

    const childrenIds = isGoogleDriveRoute
      ? [itemId, ...(it.childrenIds ?? [])]
      : [itemId];

    const applyPermissions = (list) =>
      list.map((resource) => {
        const resourceId = String(resource._id ?? resource.id);
        if (!childrenIds.includes(resourceId)) return resource;
        return { ...resource, permissions: finalPermissions };
      });

    setFilesList(applyPermissions);
    setDirectoriesList(applyPermissions);

    if (setItem) {
      updateItemState(setItem, itemId, { permissions: finalPermissions });
    }
  }

  async function handleSend(e) {
    e.preventDefault();

    if (!selectedUsers.length) return;

    setIsShareLoading(true);

    try {
      const results = await Promise.allSettled(
        shareItems.map((it) => shareWithItem(it)),
      );
      const failed = results.filter((r) => r.status === "rejected");

      if (failed.length === shareItems.length) {
        throw failed[0].reason;
      }

      if (failed.length > 0) {
        toast({
          message: `Access updated for ${shareItems.length - failed.length} of ${shareItems.length} items`,
          type: "error",
        });
      } else {
        toast({ message: "Access updated", type: "success" });
      }

      setSelectedUsers([]);
      setShowInvitePanel(false);
      setMessage("");
      setInviteInput("");
      setShareItem(null);
    } catch (error) {
      console.error(error);

      toast({
        message: error?.message ?? "Something went wrong",
        type: "error",
      });
    } finally {
      setIsShareLoading(false);
    }
  }

  async function handleSendLink(e) {
    e.preventDefault();

    if (isShareLoading) return;

    if (!selectedUsers.length) {
      toast({
        message: "Please select a person",
        type: "error",
      });
      return;
    }

    try {
      setIsShareLoading(true);

      const results = await Promise.allSettled(
        shareItems.map((it) => {
          const { emailAddress } = it.owners?.[0] ?? {};

          return sendLink({
            toEmail: emailAddress,
            message,
            type: getResourceType(it),
            id: it._id ?? it.id,
            name: it.name,
            url: getItemUrl(it),
            isPublic:
              it.isPublic || it.permissions?.some((p) => p.type === "anyone"),
            publicRole:
              it.publicRole ||
              it.permissions?.find((p) => p.type === "anyone")?.role,
            notifyPeople: notifyPeople,
          });
        }),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === shareItems.length) throw failed[0].reason;

      toast({
        message:
          failed.length > 0
            ? `Sent ${shareItems.length - failed.length} of ${shareItems.length} links`
            : isMulti
              ? "Links sent successfully"
              : "Link sent successfully",
        type: failed.length > 0 ? "error" : "success",
      });
      setSelectedUsers([]);
      setShareItem(null);
    } catch (error) {
      console.log(error);

      toast({
        message: error.message || "Something went wrong",
        type: "error",
      });
    } finally {
      setIsShareLoading(false);
    }
  }

  function handleCancel() {
    setShowInvitePanel(false);
    setSelectedUsers([]);
    setMessage("");
    setInviteInput("");
  }

  async function updatePersonRole(person, role) {
    const userEmail = person.emailAddress;
    setUserRole({ emailAddress: userEmail, role });
    setPeopleWithAccess((prev) => {
      const hasPublicAccess = prev.some((p) => p.type === "anyone");

      let updated = prev.map((p) => {
        const isPublicAccess = p.type === "anyone";

        if (isPublicAccess && linkAccess === "restricted") {
          return null;
        }

        if (isPublicAccess && linkAccess === "anyone") {
          return {
            ...p,
            id: "anyoneWithLink",
            type: "anyone",
            role: linkRole,
          };
        }

        const isPersonMatched = p.id === person.id;

        if (isPersonMatched) {
          return {
            ...p,
            role: role !== "remove" ? DRIVE_ROLES[role] : role,
          };
        }

        return p;
      });

      updated = updated.filter(Boolean);
      if (linkAccess === "anyone" && !hasPublicAccess) {
        updated.push({
          id: "anyoneWithLink",
          type: "anyone",
          role: linkRole,
          allowFileDiscovery: false,
        });
      }

      return updated;
    });

    if (prevRoleRef.current === role) {
      setOpenDropdown(null);
      return;
    }

    setOpenDropdown(null);
  }

  async function sendOwnershipTransferMail(person) {
    setIsShareLoading(true);
    try {
      const result = await sendOwnershipMail({
        newOwner: person,
        itemId: item._id ?? item.id,
        type,
      });
      const newPermission = result.permission;
      const update = () => {
        const updatePermissions = (resource) => {
          if (!resource?.permissions) {
            return resource;
          }

          return {
            ...resource,
            permissions:
              type === "google"
                ? resource.permissions.map((p) =>
                    p.emailAddress === result.permission.emailAddress
                      ? { ...p, ...newPermission }
                      : p,
                  )
                : result.permissions,
          };
        };

        setShareItem((currentItem) => {
          if (!currentItem) {
            return currentItem;
          }

          return updatePermissions(currentItem);
        });

        setFilesList((prev) =>
          prev.map((resource) => {
            const resourceId = String(resource?._id ?? resource?.id);

            const itemId = String(item?._id ?? item?.id);

            if (resourceId !== itemId) {
              return resource;
            }

            return updatePermissions(resource);
          }),
        );

        setDirectoriesList((prev) =>
          prev.map((resource) => {
            const resourceId = String(resource?._id ?? resource?.id);

            const itemId = String(item?._id ?? item?.id);

            if (resourceId !== itemId) {
              return resource;
            }

            return updatePermissions(resource);
          }),
        );
      };

      update();
      setOpenDropdown(null);
      toast({ message: result.message, type: "success" });
    } catch (error) {
      toast({ message: error.message, type: "error" });
    } finally {
      setIsShareLoading(false);
    }
  }

  async function cancelOwnershipTransferMail(person) {
    try {
      setIsShareLoading(true);
      const { message } = await cancelPendingOwnership({
        newOwner: person,
        itemId: item._id ?? item.id,
        type,
      });

      const update = () => {
        const updatePermissions = (resource) => {
          if (!resource?.permissions) {
            return resource;
          }
          const permissions = resource.permissions.map((permission) => {
            const isTarget = String(permission?.id) === String(person?.id);

            if (!isTarget) {
              return permission;
            }
            const { pendingOwner, ...cleanPermission } = permission;
            return cleanPermission;
          });
          return {
            ...resource,
            permissions,
          };
        };

        setShareItem((currentItem) => {
          if (!currentItem) {
            return currentItem;
          }

          return updatePermissions(currentItem);
        });

        setFilesList((prev) =>
          prev.map((resource) => {
            const resourceId = String(resource?._id ?? resource?.id);

            const itemId = String(item?._id ?? item?.id);

            if (resourceId !== itemId) {
              return resource;
            }

            return updatePermissions(resource);
          }),
        );

        setDirectoriesList((prev) =>
          prev.map((resource) => {
            const resourceId = String(resource?._id ?? resource?.id);

            const itemId = String(item?._id ?? item?.id);

            if (resourceId !== itemId) {
              return resource;
            }

            return updatePermissions(resource);
          }),
        );
      };

      update();
      setOpenDropdown(null);
      toast({ message, type: "success" });
    } catch (error) {
      toast({ message: error.message, type: "error" });
    } finally {
      setIsShareLoading(false);
    }
  }

  function handleCopyLink() {
    // Only shown for a single item
    navigator.clipboard
      .writeText(getItemUrl(item))
      .then(() => {
        toast({ message: "Link copied to clipboard", type: "success" });
      })
      .catch(() => {});
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  if (!item) return null;

  if (!canShare) {
    return (
      <>
        {isConfirmation && (
          <ConfirmationModal
            title="Discard unsaved changes?"
            action_1="Cancel"
            action_2="Discard"
            onAction_1={() => setIsConfirmation(false)}
            onAction_2={() => setShareItem(null)}
          />
        )}

        <div
          key={shareItems.map(getItemId).join(",")}
          className="gd-modal-overlay"
          onClick={() => {
            isChanged ? setIsConfirmation(true) : setSelectedUsers([]);
            setShareItem(null);
          }}
        >
          <div className="gd-share-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="gd-share-header">
              <h2>{sendLinkTitle}</h2>
              <button
                className="gd-icon-btn"
                onClick={() => {
                  setSelectedUsers([]);
                  setShareItem(null);
                }}
              >
                <IconClose size={20} />
              </button>
            </div>

            <div
              style={{
                padding: "0 24px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                {isMulti
                  ? "You'll send an email with the links from below"
                  : "You'll send an email with the link from below"}
              </p>

              {/* Email input */}
              <form onSubmit={handleSendLink}>
                <div
                  className="gd-share-input-wrap gd-invite-chip-wrap"
                  ref={inviteSuggestionsRef}
                  style={{
                    border: "2px solid #1a73e8",
                    borderRadius: 6,
                    padding: "10px 14px",
                  }}
                >
                  {selectedUsers.map((u) => (
                    <div key={u._id ?? u.id} className="gd-invite-chip">
                      <UseAvatar
                        avatar={u.avatar || u.photoLink}
                        name={u.name || u.displayName}
                        size={20}
                        fontSize={12}
                      />
                      <span>
                        {(u.email ?? u.emailAddress) ||
                          (u.displayName ?? u.name)}
                      </span>
                      <button
                        type="button"
                        className="gd-invite-chip-remove"
                        onClick={() => handleRemoveSelected(u.id)}
                      >
                        <IconClose size={12} />
                      </button>
                    </div>
                  ))}
                  <input
                    type="text"
                    placeholder="Add people to send the link to"
                    value={inviteInput}
                    onChange={(e) => {
                      setInviteInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onClick={() => setShowSuggestions(true)}
                    autoFocus
                    style={{ color: "#1a73e8" }}
                  />
                  <div
                    ref={suggestionsRef}
                    className={`people-card-container ${showSuggestions ? "transition-grow" : ""}`}
                  >
                    {!selectedUsers.length &&
                      ownersPool.map((user) => (
                        <div
                          key={user.id || user.permissionId || user.emailAddress}
                          className="people-row"
                          onClick={(e) => handleSelectUser(e, user)}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <UseAvatar
                              name={user.name || user.displayName}
                              avatar={user.avatar || user.photoLink}
                              size={46}
                            />

                            <div className="people-details">
                              <span className="people-name">
                                {user.name || user.displayName}
                              </span>
                              <span className="people-email">
                                {user.email || user.emailAddress}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Message */}
                <textarea
                  className="gd-invite-message"
                  placeholder="Message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />

                {/* General access info (single item only) */}
                {!isMulti && (
                  <div>
                    <div
                      style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}
                    >
                      General access
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#e6f4ea",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconGlobe size={18} style={{ color: "#1e8e3e" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 14,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {linkAccess === "anyone"
                            ? "Anyone with the link"
                            : "Restricted"}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {linkAccess === "anyone"
                            ? `Anyone on the internet with the link ${ROLE_DESC[linkRole]}`
                            : "Only people with access can open with this link"}
                        </div>
                      </div>
                      {linkAccess === "anyone" && (
                        <span
                          style={{
                            fontSize: 13,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {ROLE_LABEL[linkRole]}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: isMulti ? "flex-end" : "space-between",
                    marginTop: 8,
                  }}
                >
                  {!isMulti && (
                    <button
                      type="button"
                      style={{ width: "36px", height: "36px" }}
                      className="gd-icon-btn"
                      onClick={handleCopyLink}
                      title="Copy link"
                    >
                      <IconLink size={20} />
                    </button>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="gd-btn gd-btn-text"
                      onClick={() => {
                        setSelectedUsers([]);
                        setShareItem(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="gd-btn gd-btn-primary"
                      disabled={isShareLoading}
                      style={{
                        opacity: isShareLoading ? 0.5 : 1,
                      }}
                    >
                      {isShareLoading ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
            {isShareLoading && <div className="gd-share-modal-loader"></div>}
          </div>
        </div>
      </>
    );
  } else {
    const excludedEmails = getExcludedEmails();

    return (
      <>
        {isConfirmation && (
          <ConfirmationModal
            title="Discard unsaved changes?"
            action_1="Cancel"
            action_2="Discard"
            onAction_1={() => setIsConfirmation(false)}
            onAction_2={() => setShareItem(null)}
          />
        )}
        <div
          ref={shareModalOverlayRef}
          className="gd-modal-overlay"
          onClick={() =>
            isChanged ? setIsConfirmation(true) : setShareItem(null)
          }
        >
          <div
            className={`gd-share-modal ${heightReady ? "gd-height-ready" : ""}`}
            style={{
              height: modalHeight !== null ? `${modalHeight}px` : "auto",
            }}
            onAnimationEnd={() => setHeightReady(true)}
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={modalContentRef}>
              <div className="gd-share-header">
                {showInvitePanel && (
                  <button
                    className="gd-icon-btn"
                    onClick={handleCancel}
                    style={{ marginRight: 4 }}
                  >
                    ←
                  </button>
                )}
                <h2 className="text-left">{shareTitle}</h2>
                <button
                  className="gd-icon-btn"
                  onClick={() =>
                    isChanged ? setIsConfirmation(true) : setShareItem(null)
                  }
                >
                  <IconClose size={20} />
                </button>
              </div>

              {showInvitePanel && selectedUsers.length > 0 ? (
                /* ── Invite panel ── */
                <form onSubmit={handleSend} style={{ padding: "0 24px" }}>
                  <div className="gd-share-invite-row my-4">
                    <div
                      className="gd-share-input-wrap gd-invite-chip-wrap"
                      ref={inviteSuggestionsRef}
                      style={{ position: "relative" }}
                    >
                      {selectedUsers.map((u) => (
                        <div key={u._id ?? u.id} className="gd-invite-chip">
                          <UseAvatar
                            avatar={u.avatar || u.photoLink}
                            name={u.name || u.displayName}
                            size={20}
                            fontSize={12}
                          />
                          <span>{u.email || u.name}</span>
                          <button
                            type="button"
                            className="gd-invite-chip-remove"
                            onClick={() => handleRemoveSelected(u.id)}
                          >
                            <IconClose size={12} />
                          </button>
                        </div>
                      ))}

                      <input
                        type="text"
                        className="gd-invite-chip-input"
                        placeholder="Add more people..."
                        value={inviteInput}
                        onChange={(e) => {
                          setInviteInput(e.target.value);
                          setShowInviteSuggestions(true);
                        }}
                        onClick={() => setShowInviteSuggestions(true)}
                      />

                      {showInviteSuggestions &&
                        inviteSuggestions.length > 0 && (
                          <div className="people-card-container transition-grow">
                            {inviteSuggestions
                              .filter((u) => {
                                const email = u?.email?.toLowerCase();
                                if (!email) return false;

                                if (
                                  isGoogleDriveRoute &&
                                  u.provider === "local"
                                )
                                  return false;

                                return !excludedEmails.includes(email);
                              })

                              .map((u) => (
                                <div
                                  key={u.id}
                                  className="people-row"
                                  onClick={() => handleAddUser(u)}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 10,
                                    }}
                                  >
                                    <UseAvatar
                                      name={u.name}
                                      avatar={u.avatar}
                                      size={36}
                                    />

                                    <div className="people-details">
                                      <span className="people-name">
                                        {u.name}
                                      </span>
                                      <span className="people-email">
                                        {u.email}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                    </div>

                    <div className="gd-share-role-select">
                      <button
                        ref={inviteRoleRef}
                        type="button"
                        className="gd-share-role-btn"
                        onClick={() =>
                          setOpenDropdown(
                            openDropdown === "invite" ? null : "invite",
                          )
                        }
                      >
                        {ROLE_LABEL[inviteRole] || inviteRole}{" "}
                        <IconChevronDown size={14} />
                      </button>

                      <RoleDropdown
                        open={openDropdown === "invite"}
                        anchorRef={inviteRoleRef}
                        current={inviteRole}
                        onChange={(r) => {
                          setInviteRole(r);
                          setSelectedUsers((prev) =>
                            prev.map((u) => ({
                              ...u,
                              role: DRIVE_ROLES[r],
                            })),
                          );
                          setOpenDropdown(null);
                        }}
                        onClose={() => setOpenDropdown(null)}
                      />
                    </div>
                  </div>
                  <div className="my-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyPeople}
                        onChange={(e) => setNotifyPeople(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-(--text-secondary)">
                        Notify people
                      </span>
                    </label>
                  </div>

                  <div className={`${notifyPeople ? "block" : "hide"}`}>
                    <textarea
                      className="gd-invite-message"
                      placeholder="Message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div
                    className="gd-share-footer"
                    style={{
                      justifyContent: "flex-end",
                      gap: 8,
                      paddingTop: 12,
                    }}
                  >
                    {!isMulti && (
                      <button
                        type="button"
                        style={{
                          width: "36px",
                          height: "36px",
                          marginRight: "auto",
                        }}
                        className="gd-icon-btn"
                        onClick={handleCopyLink}
                        title="Copy link"
                      >
                        <IconLink size={20} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="gd-btn gd-btn-text"
                      onClick={handleCancel}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="gd-btn gd-btn-primary"
                      disabled={isShareLoading}
                      style={{
                        opacity: isShareLoading ? 0.5 : 1,
                      }}
                    >
                      {isShareLoading
                        ? !notifyPeople
                          ? "Sending..."
                          : "Sharing"
                        : notifyPeople
                          ? "Send"
                          : "Share"}
                    </button>
                  </div>
                </form>
              ) : (
                /* ── Normal share view ── */
                <>
                  <div style={{ margin: "0 24px", position: "relative" }}>
                    <div className="gd-share-invite-row">
                      <div className="gd-share-input-wrap">
                        <IconPersonAdd
                          size={18}
                          style={{
                            color: "var(--text-tertiary)",
                            flexShrink: 0,
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Add people and groups"
                          value={emailInput}
                          onChange={(e) => {
                            setEmailInput(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onClick={() => setShowSuggestions(true)}
                          autoFocus
                        />
                      </div>
                    </div>

                    <div
                      ref={suggestionsRef}
                      className={`people-card-container ${showSuggestions ? "transition-grow" : ""}`}
                    >
                      {suggestions
                        .filter((s) => {
                          const email = s.email?.toLowerCase();
                          if (!email) return false;

                          if (email === user.email) return false;

                          if (isGoogleDriveRoute) {
                            if (s.provider === "local") return false;
                          }

                          return !excludedEmails.includes(email);
                        })
                        .map((u) => (
                          <div
                            key={u.id}
                            className="people-row"
                            onClick={(e) => handleSelectUser(e, u)}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <UseAvatar
                                name={u.name}
                                avatar={u.avatar}
                                size={36}
                              />

                              <div className="people-details">
                                <span className="people-name">{u.name}</span>
                                <span className="people-email">{u.email}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* People with access + General access: single item only */}
                  {!isMulti && (
                    <>
                      <div className="gd-share-section-label">
                        People with access
                      </div>

                      {item.permissions?.length > 0 && (
                        <div className="gd-share-people-list">
                          {peopleWithAccess
                            .sort(
                              (a, b) =>
                                ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role],
                            )
                            ?.map((person, idx) => {
                              if (person?.type === "anyone") return null;
                              if (!personRefs.current[idx])
                                personRefs.current[idx] = { current: null };
                              return (
                                <div
                                  key={person?.email || person?.emailAddress}
                                  onClick={() =>
                                    setActivePerson(
                                      activePerson === idx ? null : idx,
                                    )
                                  }
                                  className={`gd-share-person ${activePerson === idx ? "gd-active" : ""}`}
                                >
                                  <div className="gd-share-person-row">
                                    <UseAvatar
                                      name={person?.displayName || person?.name}
                                      avatar={
                                        person?.photoLink || person?.avatar
                                      }
                                    />
                                    <div className="gd-share-person-info">
                                      <div
                                        className={`gd-share-person-name ${person?.role === "remove" ? "line-through" : ""}`}
                                      >
                                        {person?.displayName}{" "}
                                        {person?.emailAddress === user.email
                                          ? "(you)"
                                          : ""}
                                      </div>
                                      <div className="gd-share-person-email">
                                        {person?.emailAddress}
                                      </div>
                                      <div className="gd-share-person-pending-owner">
                                        {person?.pendingOwner &&
                                          "Pending owner"}
                                      </div>
                                    </div>
                                    <div className="gd-share-role-select">
                                      <MouseTooltip
                                        disabled={!canChangeRole}
                                        message="Can't reduce permission because it's set on a parent folder"
                                      >
                                        <button
                                          ref={(el) =>
                                            (personRefs.current[idx] = {
                                              current: el,
                                            })
                                          }
                                          disabled={
                                            person.role === "owner" ||
                                            !canChangeRole
                                          }
                                          className={`${person.role === "owner" ? "gd-share-owner-role-btn" : "gd-share-person-role-btn"}`}
                                          aria-disabled={!canChangeRole}
                                          onClick={(e) => {
                                            if (!canChangeRole) return;
                                            e.stopPropagation();
                                            setOpenDropdown(
                                              openDropdown === idx ? null : idx,
                                            );
                                          }}
                                          style={{
                                            opacity: !canChangeRole ? 0.5 : 1,
                                            cursor:
                                              !canChangeRole ||
                                              person.role === "owner"
                                                ? "default"
                                                : "pointer",
                                            pointerEvents: !canChangeRole
                                              ? "none"
                                              : "auto",
                                          }}
                                        >
                                          {ROLE_LABEL[person?.role]}{" "}
                                          {canChangeRole &&
                                            person.role !== "owner" && (
                                              <IconChevronDown size={12} />
                                            )}
                                        </button>
                                      </MouseTooltip>

                                      <RoleDropdown
                                        open={openDropdown === idx}
                                        isChanged={isChanged}
                                        isOwnerPending={person?.pendingOwner}
                                        onTransfer={() =>
                                          sendOwnershipTransferMail(person)
                                        }
                                        onCancel={() =>
                                          cancelOwnershipTransferMail(person)
                                        }
                                        anchorRef={personRefs.current[idx]}
                                        current={ROLE_LABEL[person?.role]}
                                        onChange={(r) =>
                                          updatePersonRole(person, r)
                                        }
                                        onClose={() => setOpenDropdown(null)}
                                        showRemove={true}
                                        isOwner={isOwner}
                                        person={person}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                            .filter(Boolean)}
                        </div>
                      )}

                      {/* Link sharing */}
                      <div className="gd-share-section-label">
                        General access
                      </div>

                      <div className="gd-share-link-section">
                        <div className={`gd-share-link-row`}>
                          <div
                            className={`gd-share-link-icon ${linkAccess === "anyone" ? "active" : ""}`}
                          >
                            {linkAccess === "anyone" ? (
                              <GlobeAmericasIcon className="text-green-900 w-5 h-5" />
                            ) : (
                              <LockClosedIcon className="text-black w-5 h-5" />
                            )}
                          </div>
                          <div className="gd-share-link-info">
                            <div
                              className="gd-share-link-title"
                              ref={accessDropdownRef}
                              style={{ position: "relative" }}
                            >
                              <button
                                className="gd-share-access-btn"
                                onClick={() =>
                                  setShowAccessDropdown(!showAccessDropdown)
                                }
                              >
                                <span>
                                  {" "}
                                  {linkAccess === "anyone"
                                    ? "Anyone with the link"
                                    : "Restricted"}
                                </span>
                                <IconChevronDown size={14} />
                              </button>

                              {showAccessDropdown && (
                                <div className="gd-share-access-dropdown origin-top-left animate-[sortDropdown_80ms_ease-out]">
                                  {["restricted", "anyone"].map((opt) => (
                                    <button
                                      key={opt}
                                      className="gd-share-access-option"
                                      onClick={() => {
                                        setLinkAccess(opt);
                                        onClose(item, linkRole, opt);
                                        setShowAccessDropdown(false);
                                      }}
                                    >
                                      <span className="gd-share-access-check">
                                        {linkAccess === opt && (
                                          <IconCheck size={16} />
                                        )}
                                      </span>
                                      {opt === "anyone"
                                        ? "Anyone with the link"
                                        : "Restricted"}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="gd-share-link-sub">
                              {linkAccess === "anyone"
                                ? `Anyone on the internet with the link ${ROLE_DESC[linkRole]}`
                                : "Only people with access can open with this link"}
                            </div>
                          </div>

                          <div className="gd-share-link-actions">
                            {linkAccess === "anyone" && (
                              <div className="gd-share-link-role-wrap">
                                <button
                                  ref={linkRoleRef}
                                  className="gd-share-role-btn"
                                  onClick={() =>
                                    setOpenDropdown(
                                      openDropdown === "link" ? null : "link",
                                    )
                                  }
                                >
                                  {ROLE_LABEL[linkRole]}{" "}
                                  {<IconChevronDown size={14} />}
                                </button>

                                <RoleDropdown
                                  open={openDropdown === "link"}
                                  anchorRef={linkRoleRef}
                                  containerRef={shareModalOverlayRef}
                                  current={ROLE_LABEL[linkRole]}
                                  onChange={(r) => {
                                    setLinkRole(r);
                                    setOpenDropdown(null);
                                    onClose(item, r, linkAccess);
                                  }}
                                  onClose={() => setOpenDropdown(null)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Footer */}
                  <div
                    className={`${!showInvitePanel ? "mx-6" : ""} gd-share-footer`}
                    style={isMulti ? { justifyContent: "flex-end" } : undefined}
                  >
                    {!isMulti && (
                      <button
                        className={`gd-copy-link-btn ${copyFeedback ? "copied" : ""}`}
                        onClick={handleCopyLink}
                      >
                        {copyFeedback ? (
                          <>
                            <IconCheck size={14} /> Copied!
                          </>
                        ) : (
                          <>
                            <IconLink size={14} /> Copy link
                          </>
                        )}
                      </button>
                    )}
                    <div className="gd-pending-span">
                      {!isMulti && isChanged && <span>Pending changes</span>}
                    </div>
                    <button
                      className={`gd-btn  ${isShareLoading ? "btn-loading" : "gd-btn-primary"}`}
                      onClick={() =>
                        isMulti
                          ? setShareItem(null)
                          : onUpdateRoleAfterSave(item, type, message)
                      }
                    >
                      {isShareLoading
                        ? "Saving..."
                        : isChanged
                          ? "Save"
                          : "Done"}
                    </button>
                  </div>
                </>
              )}
              {isShareLoading && <div className="gd-share-modal-loader"></div>}
            </div>
          </div>
        </div>
      </>
    );
  }
}