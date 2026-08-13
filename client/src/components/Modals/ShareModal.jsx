import { useState, useRef, useEffect } from "react";
import {
  IconClose,
  IconPersonAdd,
  IconLink,
  IconLinkOff,
  IconCheck,
  IconChevronDown,
  IconGlobe,
  IconLock,
} from "../Icons/Icons.jsx";
import RoleDropdown from "../Dropdowns/RoleDropdown.jsx";
import {
  DRIVE_ROLES,
  ROLE_DESC,
  ROLE_LABEL,
} from "../../../Utils/displayUtils.js";
import { searchUsers } from "../../../apis/userApi.js";
import "./ShareModal.css";
import { useClickOutside } from "../../Hooks/useClickOutside.jsx";
import { UseAvatar } from "../../Hooks/useAvatar.jsx";
import {
  fetchFilePermissions,
  grantAccessById,
  revokeFileAccess,
} from "../../../apis/fileApi.js";
import { useToast } from "../../Contexts/ToastContext.jsx";
import {
  cancelPendingOwnership,
  sendLink,
  sendOwnershipMail,
} from "../../../apis/resourceApi.js";
import { useAuth } from "../../Contexts/AuthContext.jsx";
import ConfirmationModal from "./ConfirmationModal.jsx";
import { createPortal } from "react-dom";
import { getResourceType } from "../../../Utils/getResourceType.js";
import { updateItemState } from "../../../Utils/updateItemState.js";
import { GlobeAmericasIcon } from "@heroicons/react/24/solid";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import MouseTooltip from "../Tooltip/Tooltip.jsx";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export default function ShareModal({
  item,
  setItem = null,
  allUsers,
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
  const [emailInput, setEmailInput] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [personRole, setPersonRole] = useState({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [message, setMessage] = useState("");
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showInviteSuggestions, setShowInviteSuggestions] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [activePerson, setActivePerson] = useState(null);
  const [showAccessDropdown, setShowAccessDropdown] = useState(false);
  const [updatedPerson, setUpdatedPerson] = useState([]);
  const [isConfirmation, setIsConfirmation] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isOwnerPending, setIsOwnerPending] = useState({});
  const [hasImgError, setHasImgError] = useState(false);

  const inviteRoleRef = useRef(null);
  const linkRoleRef = useRef(null);
  const personRefs = useRef([]);
  const suggestionsRef = useRef(null);
  const inviteSuggestionsRef = useRef(null);
  const accessDropdownRef = useRef(null);
  const prevRoleRef = useRef(null);
  const shareModalOverlayRef = useRef(null);
  const type = item?.webViewLink
    ? "google"
    : item.isDirectory
      ? "folder"
      : "file";

  const isOwner = item.owners?.[0].me === true;
  const capabilities =
    item.permissions?.find((p) => p.id === user.id)?.capabilities || {};

  const canChangeRole = capabilities?.canChangeRole ?? true;
  const canShare = capabilities.canShare === true;
  const canRename = capabilities.canRename === true;
  const { toast } = useToast();

  useEffect(() => {
    const authorizedUsers = item.permissions
      ?.filter(
        (person) =>
          person.type !== "anyone" &&
          person.type !== "superuser" &&
          person.role !== "owner",
      )
      .map((p) => p);
    setPeopleWithAccess(authorizedUsers);
    setPrevPermissions(authorizedUsers);
  }, [item]);

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

  useEffect(() => {
    setLinkAccess(
      item.permissions?.some((p) => p?.type === "anyone")
        ? "anyone"
        : "restricted",
    );
    setLinkRole(
      item.permissions?.find((p) => p.type === "anyone")?.role || "reader",
    );
  }, [item]);

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

  async function handleSend(e) {
    e.preventDefault();

    if (!selectedUsers.length) return;

    setIsShareLoading(true);

    try {
      const itemId = String(item?._id ?? item?.id);

      await grantAccessById(type, itemId, selectedUsers, message);

      const updatedUsers = selectedUsers.map((user) => ({
        id: user.id,
        photoLink: user.avatar,
        displayName: user.name,
        type: "user",
        emailAddress: user.emailAddress ?? user.email,
        role: DRIVE_ROLES[user.role] ?? user.role,
      }));

      const currentPermissions = item?.permissions ?? [];

      const updatedPermissions = currentPermissions.map((permission) => {
        const updatedUser = updatedUsers.find(
          (user) => String(user.id) === String(permission.id),
        );

        if (!updatedUser) {
          return permission;
        }

        if (permission.role === "owner") {
          return permission;
        }

        return {
          ...permission,
          ...updatedUser,
        };
      });

      const existingIds = new Set(
        currentPermissions.map((permission) => String(permission.id)),
      );

      const newPermissions = updatedUsers.filter(
        (user) => !existingIds.has(String(user.id)),
      );

      const finalPermissions = [...updatedPermissions, ...newPermissions];

      setFilesList((list) =>
        list.map((resource) => {
          if (String(resource._id ?? resource.id) !== itemId) {
            return resource;
          }

          return {
            ...resource,
            permissions: finalPermissions,
          };
        }),
      );

      setDirectoriesList((list) =>
        list.map((resource) => {
          if (String(resource._id ?? resource.id) !== itemId) {
            return resource;
          }

          return {
            ...resource,
            permissions: finalPermissions,
          };
        }),
      );

      if (setItem) {
        updateItemState(setItem, itemId, {
          permissions: finalPermissions,
        });
      }

      setSelectedUsers([]);
      setShowInvitePanel(false);
      setMessage("");
      setInviteInput("");

      toast({
        message: "Access updated",
        type: "success",
      });

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
    setSelectedUsers((prev) => [
      ...prev,
      {
        email: inviteInput,
        message: message,
      },
    ]);
    if (isShareLoading) return;
    if (!selectedUsers.length) return;
    const type = getResourceType(item);
    const { email } = selectedUsers[0];
    const url = item.webViewLink
      ? item.webViewLink
      : item
        ? `${window.location.origin}/${item.isDirectory ? "directory" : "file"}/${item._id}?usp=drive_link`
        : window.location.href;
    try {
      setIsShareLoading(true);
      await sendLink({
        toEmail: email,
        message,
        type,
        id: item._id ?? item.id,
        name: item.name,
        url,
        isPublic:
          item.isPublic || item.permissions?.some((p) => p.type === "anyone"),
        publicRole:
          item.publicRole ||
          item.permissions?.find((p) => p.type === "anyone")?.role,
      });

      toast({ message: "Link sent successfully", type: "success" });
      setShareItem(null);
    } catch (error) {
      console.log(error);
      toast({
        message: error.message || "Something went wrong",
        type: "error",
      });
      setShareItem(null);
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

  async function updatePersonRole(person, idx, role) {
    const userId = person.id;
    setPeopleWithAccess((prev) =>
      prev.map((p) =>
        p.id === person.id
          ? { ...p, role: role !== "remove" ? DRIVE_ROLES[role] : role }
          : p,
      ),
    );

    if (prevRoleRef.current === role) {
      setOpenDropdown(null);
      return;
    }

    setOpenDropdown(null);
  }

  async function sendOwnershipTransferMail(person) {
    setIsShareLoading(true);

    try {
      const message = await sendOwnershipMail({
        newOwner: person,
        itemId: item._id ?? item.id,
        type,
      });
      const update = () => {
        const updatePermissions = (resource) => {
          if (!resource?.permissions) {
            return resource;
          }

          return {
            ...resource,

            permissions: resource.permissions.map((permission) =>
              String(permission?.id ?? permission?._id) ===
              String(person?.id ?? person?._id)
                ? {
                    ...permission,
                    pendingOwner: true,
                  }
                : permission,
            ),
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

  async function cancelOwnershipTransferMail(person) {
    try {
      setIsShareLoading(true);
      const message = await cancelPendingOwnership({
        newOwner: person,
        itemId: item._id ?? item.id,
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
    const url = item.webViewLink
      ? item.webViewLink
      : item
        ? `${window.location.origin}/${item.isDirectory ? "directory" : "file"}/${item._id}?usp=drive_link`
        : window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast({ message: "Link copied to clipboard", type: "success" });
      })
      .catch(() => {});
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  if (!canShare) {
    return (
      <>
        <div className="gd-modal-overlay confirmation-tab">
          {isConfirmation && (
            <ConfirmationModal
              title="Discard unsaved changes?"
              action_1="Cancel"
              action_2="Discard"
              onAction_1={() => setIsConfirmation(false)}
              onAction_2={() => setShareItem(null)}
            />
          )}
        </div>
        <div
          key={item}
          className="gd-modal-overlay"
          onClick={() =>
            isChanged ? setIsConfirmation(true) : setShareItem(null)
          }
        >
          <div className="gd-share-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="gd-share-header">
              <h2>Send the link for "{item.name}"</h2>
              <button
                className="gd-icon-btn"
                onClick={() => setShareItem(null)}
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
                You'll send an email with the link from below
              </p>

              {/* Email input */}
              <form onSubmit={handleSend}>
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
                    <div key={u._id} className="gd-invite-chip">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span
                          className="gd-avatar"
                          style={{
                            width: 20,
                            height: 20,
                            fontSize: 18,
                            background: "#1a73e8",
                          }}
                        >
                          {u.name?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
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
                      suggestions
                        .filter((user) => {
                          const owners = item.owners?.map(
                            (o) => o.permissionId.toString() || [],
                          );

                          return owners?.includes(user.id.toString());
                        })
                        .map((user) => (
                          <div
                            key={user.id}
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
                                name={user.name}
                                avatar={user.avatar}
                                size={36}
                              />

                              <div className="people-details">
                                <span className="people-name">{user.name}</span>
                                <span className="people-email">
                                  {user.email}
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

                {/* General access info */}
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
                        style={{ fontSize: 14, color: "var(--text-secondary)" }}
                      >
                        {linkAccess === "anyone"
                          ? "Anyone with the link"
                          : "Restricted"}
                      </div>
                      <div
                        style={{ fontSize: 12, color: "var(--text-tertiary)" }}
                      >
                        {linkAccess === "anyone"
                          ? `Anyone on the internet with the link ${ROLE_DESC[linkRole]}`
                          : "Only people with access can open with this link"}
                      </div>
                    </div>
                    {linkAccess === "anyone" && (
                      <span
                        style={{ fontSize: 13, color: "var(--text-secondary)" }}
                      >
                        {ROLE_LABEL[linkRole]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    style={{ width: "36px", height: "36px" }}
                    className="gd-icon-btn"
                    onClick={handleCopyLink}
                    title="Copy link"
                  >
                    <IconLink size={20} />
                  </button>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="gd-btn gd-btn-text"
                      onClick={() => setShareItem(null)}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendLink}
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
    return (
      <>
        {isConfirmation && (
          <div className="gd-modal-confirmation">
            <ConfirmationModal
              title="Discard unsaved changes?"
              action_1="Cancel"
              action_2="Discard"
              onAction_1={() => setIsConfirmation(false)}
              onAction_2={() => setShareItem(null)}
            />
          </div>
        )}
        <div
          ref={shareModalOverlayRef}
          className="gd-modal-overlay"
          onClick={() =>
            isChanged ? setIsConfirmation(true) : setShareItem(null)
          }
        >
          <div className="gd-share-modal" onClick={(e) => e.stopPropagation()}>
            {/* ── Header ── */}
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
              <h2>Share "{item.name}"</h2>
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
              <form onSubmit={handleSend} style={{ padding: "0 24px 24px" }}>
                <div
                  className="gd-share-invite-row"
                  style={{ marginBottom: 16 }}
                >
                  <div
                    className="gd-share-input-wrap gd-invite-chip-wrap"
                    ref={inviteSuggestionsRef}
                    style={{ position: "relative" }}
                  >
                    {selectedUsers.map((u) => (
                      <div key={u._id ?? u.id} className="gd-invite-chip">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.name}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <span
                            className="gd-avatar"
                            style={{
                              width: 20,
                              height: 20,
                              fontSize: 18,
                              background: "#1a73e8",
                            }}
                          >
                            {u.name?.charAt(0)?.toUpperCase()}
                          </span>
                        )}
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

                    {showInviteSuggestions && inviteSuggestions.length > 0 && (
                      <div className="people-card-container transition-grow">
                        {inviteSuggestions.map((user) => (
                          <div
                            key={user.id}
                            className="people-row"
                            onClick={() => handleAddUser(user)}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <UseAvatar
                                name={user.name}
                                avatar={user.avatar}
                                size={36}
                              />

                              <div className="people-details">
                                <span className="people-name">{user.name}</span>
                                <span className="people-email">
                                  {user.email}
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
                    {openDropdown === "invite" && (
                      <RoleDropdown
                        containerRef={shareModalOverlayRef}
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
                    )}
                  </div>
                </div>

                <textarea
                  className="gd-invite-message"
                  placeholder="Message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />

                <div
                  className="gd-share-footer"
                  style={{ justifyContent: "flex-end", gap: 8, paddingTop: 12 }}
                >
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
                    {isShareLoading ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            ) : (
              /* ── Normal share view ── */
              <>
                {/* Search row */}
                <div style={{ margin: "0 24px", position: "relative" }}>
                  <div className="gd-share-invite-row">
                    <div className="gd-share-input-wrap">
                      <IconPersonAdd
                        size={18}
                        style={{ color: "var(--text-tertiary)", flexShrink: 0 }}
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
                    {suggestions.map((user) => (
                      <div
                        key={user.id}
                        className="people-row"
                        onClick={(e) => handleSelectUser(e, user)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <UseAvatar
                            name={user.name}
                            avatar={user.avatar}
                            size={36}
                          />

                          <div className="people-details">
                            <span className="people-name">{user.name}</span>
                            <span className="people-email">{user.email}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Owner Info */}
                <>
                  <div className="gd-share-section-label">
                    People with access
                  </div>
                  <div
                    onClick={() =>
                      setActivePerson(activePerson === "owner" ? null : "owner")
                    }
                    className={`gd-share-owner ${activePerson === "owner" ? "gd-active" : ""}`}
                  >
                    <div
                      key={item?.userId?._id || item.owners?.[0]?.permissionId}
                      className="gd-share-person-row"
                    >
                      <UseAvatar
                        name={
                          item?.userId?.name || item.owners?.[0].displayName
                        }
                        avatar={
                          item?.userId?.avatar || item.owners?.[0].photoLink
                        }
                      />
                      <div className="gd-share-person-info">
                        <div className="gd-share-person-name">
                          {item?.userId?.name || item.owners?.[0].displayName}{" "}
                          {(item?.userId?.email ||
                            item.owners?.[0].emailAddress) === user.email
                            ? "(you)"
                            : ""}
                        </div>
                        <div className="gd-share-person-email">
                          {item?.userId?.email || item.owners?.[0].emailAddress}
                        </div>
                      </div>
                      <div className="gd-share-role-select">
                        <span className="gd-share-owner-label">Owner</span>
                      </div>
                    </div>
                  </div>
                </>

                {item.permissions?.length > 0 && (
                  <div className="gd-share-people-list">
                    {peopleWithAccess?.map((person, idx) => {
                      if (
                        person.type === "superuser" ||
                        person.role === "owner"
                      )
                        return;
                      if (!personRefs.current[idx])
                        personRefs.current[idx] = { current: null };
                      return (
                        <div
                          key={person.email || person.emailAddress}
                          onClick={() =>
                            setActivePerson(activePerson === idx ? null : idx)
                          }
                          className={`gd-share-person ${activePerson === idx ? "gd-active" : ""}`}
                        >
                          <div className="gd-share-person-row">
                            <UseAvatar
                              name={person.displayName}
                              avatar={person.photoLink}
                            />
                            <div className="gd-share-person-info">
                              <div
                                className={`gd-share-person-name ${person.role === "remove" ? "line-through" : ""}`}
                              >
                                {person.displayName}{" "}
                                {person.emailAddress === user.email
                                  ? "(you)"
                                  : ""}
                              </div>
                              <div className="gd-share-person-email">
                                {person.emailAddress}
                              </div>
                              <div className="gd-share-person-pending-owner">
                                {person.pendingOwner && "Pending owner"}
                              </div>
                            </div>
                            <div className="gd-share-role-select">
                              <MouseTooltip
                                disabled={!canChangeRole}
                                message="Can't reduce permission because it's set on a parent folder"
                              >
                                <button
                                  ref={(el) =>
                                    (personRefs.current[idx] = { current: el })
                                  }
                                  className="gd-share-person-role-btn"
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
                                    cursor: !canChangeRole
                                      ? "not-allowed"
                                      : "pointer",
                                    pointerEvents: !canChangeRole
                                      ? "none"
                                      : "auto",
                                  }}
                                >
                                  {ROLE_LABEL[person.role]}{" "}
                                  {canChangeRole && (
                                    <IconChevronDown size={12} />
                                  )}
                                </button>
                              </MouseTooltip>
                              {openDropdown === idx && (
                                <RoleDropdown
                                  isChanged={isChanged}
                                  isOwnerPending={person.pendingOwner}
                                  onTransfer={() =>
                                    sendOwnershipTransferMail(person)
                                  }
                                  onCancel={() =>
                                    cancelOwnershipTransferMail(person)
                                  }
                                  anchorRef={personRefs.current[idx]}
                                  current={ROLE_LABEL[person.role]}
                                  onChange={(r) =>
                                    updatePersonRole(person, idx, r)
                                  }
                                  onClose={() => setOpenDropdown(null)}
                                  showRemove={true}
                                  isOwner={isOwner}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Link sharing */}

                <div className="gd-share-section-label">General access</div>

                <div className="gd-share-link-section">
                  <div className="gd-share-link-row">
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
                      {/* ✅ custom access dropdown */}
                      <div
                        className="gd-share-link-title"
                        ref={accessDropdownRef}
                        style={{ position: "relative" }}
                      >
                        <div
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
                        </div>

                        {showAccessDropdown && (
                          <div className="gd-share-access-dropdown">
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
                            {ROLE_LABEL[linkRole]} <IconChevronDown size={14} />
                          </button>
                          {openDropdown === "link" && (
                            <RoleDropdown
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
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="gd-share-footer">
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
                  <div className="gd-pending-span">
                    {isChanged && <span>Pending changes</span>}
                  </div>
                  <button
                    className={`gd-btn  ${isShareLoading ? "btn-loading" : "gd-btn-primary"}`}
                    onClick={() => onUpdateRoleAfterSave(item, type, message)}
                  >
                    {isShareLoading ? "Saving..." : isChanged ? "Save" : "Done"}
                  </button>
                </div>
              </>
            )}
            {isShareLoading && <div className="gd-share-modal-loader"></div>}
          </div>
        </div>
      </>
    );
  }
}
