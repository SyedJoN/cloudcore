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
} from "./Icons";
import RoleDropdown from "./RoleDropdown.jsx";
import { ROLE_LABEL } from "./utils";
import { searchUsers } from "../../apis/userApi.js";
import "./ShareModal.css";
import { useClickOutside } from "../hooks/useClickOutside.jsx";
import { UseAvatar } from "../hooks/useAvatar.jsx";
import {
  fetchFilePermissions,
  grantAccessById,
  revokeFileAccess,
} from "../../apis/fileApi.js";
import { useToast } from "../Contexts/ToastContext.jsx";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL

export default function ShareModal({
  item,
  onClose,
  setShareItem,
  isShareLoading,
  setIsShareLoading,
}) {
  const [emailInput, setEmailInput] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [allUsers, setAllUsers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [peopleWithAccess, setPeopleWithAccess] = useState([]);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [linkAccess, setLinkAccess] = useState(
    item.isPublic ? "anyone" : "restricted",
  );
  const [linkRole, setLinkRole] = useState(item.publicRole || "viewer");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showInviteSuggestions, setShowInviteSuggestions] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [activePerson, setActivePerson] = useState(null);
  const [showAccessDropdown, setShowAccessDropdown] = useState(false);

  const inviteRoleRef = useRef(null);
  const linkRoleRef = useRef(null);
  const personRefs = useRef([]);
  const suggestionsRef = useRef(null);
  const inviteSuggestionsRef = useRef(null);
  const accessDropdownRef = useRef(null);

  const type = item.isDirectory ? "folder" : "file";
  const isOwner = item.userRole === "owner";
  const { toast } = useToast();

  useEffect(()=> {
    console.log('item', item)
  }, [item])
  useEffect(() => {
    if (!isOwner) return;
    async function load() {
      try {
        const data = await searchUsers(item?.userId?._id);
        setAllUsers(
          data.users.map((u) => ({
            id: u._id,
            name: u.name,
            email: u.email,
            relation: u.role,
            avatar: u.avatar,
          })),
        );
      } catch (_) {}
      try {
        const data = await fetchFilePermissions(item._id, type);
        setPeopleWithAccess(data.users);
      } catch (_) {}
    }
    load();
  }, [isOwner]);

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
      ? allUsers.filter(
          (u) =>
            u.name?.toLowerCase().includes(inviteInput.toLowerCase()) ||
            u.email?.toLowerCase().includes(inviteInput.toLowerCase()),
        )
      : allUsers
  ).filter((u) => !selectedUsers.find((s) => s.id === u.id));

  function handleSelectUser(e, user) {
    e.stopPropagation();
    setSelectedUsers([{ ...user, relation: inviteRole }]);
    setEmailInput("");
    setShowSuggestions(false);
    setShowInvitePanel(true);
  }

  function handleAddUser(user) {
    if (selectedUsers.find((s) => s.id === user.id)) return;
    setSelectedUsers((prev) => [...prev, { ...user, relation: inviteRole }]);
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
    try {
      setIsShareLoading(true);
      e.preventDefault();
      if (!selectedUsers.length) return;
      await grantAccessById(type, item._id, selectedUsers, message);
      setShowInvitePanel(false);
      setSelectedUsers([]);
      setMessage("");
      setInviteInput("");
      toast({ message: "Access updated", type: "success" });
    } catch (error) {
      console.log(error);
    } finally {
      setIsShareLoading(false);
    }
  }
  async function handleSendLink(e) {
    if (isShareLoading) return;
    e.preventDefault();
    if (!emailInput.trim()) return;
    try {
      setIsShareLoading(true);
      const response = await fetch(`${BASE_URL}/directory/${item._id}/send-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          toEmail: emailInput,
          message,
          type: item.isDirectory ? "folder" : "file",
        }),
      });
      const data = await response.json();
         if (!response.ok) {
      throw new Error(data.error || "Failed to send link");
    }
      toast({ message: "Link sent successfully", type: "success" });
      setShareItem(null);
    } catch (error) {

      toast({ message: error.message || "Something went wrong", type: "error" });
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
    if (role === "remove") {
      await revokeFileAccess(type, item._id, userId, person.relation);
      setPeopleWithAccess((prev) => prev.filter((_, i) => i !== idx));
    } else {
      const personArray = [{ ...person, relation: role }];
      await grantAccessById(type, item._id, personArray, message);
      setPeopleWithAccess((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, relation: role } : p)),
      );
    }
    setOpenDropdown(null);
  }

  function handleCopyLink() {
    const url = item
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
  if (!isOwner) {
    return (
      <div className="gd-modal-overlay" onClick={() => setShareItem(null)}>
        <div className="gd-share-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="gd-share-header">
            <h2>Send the link for "{item.name}"</h2>
            <button className="gd-icon-btn" onClick={() => setShareItem(null)}>
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
            <div
              className="gd-share-input-wrap"
              style={{
                border: "2px solid #1a73e8",
                borderRadius: 6,
                padding: "10px 14px",
              }}
            >
              <input
                type="text"
                placeholder="Add people to send the link to"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                autoFocus
                style={{ color: "#1a73e8" }}
              />
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
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                General access
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    {item.isPublic ? "Anyone with the link" : "Restricted"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    {item.isPublic
                      ? `Anyone on the internet with the link can ${item.publicRole || "view"}`
                      : "Only people with access can open with this link"}
                  </div>
                </div>
                {item.isPublic && (
                  <span
                    style={{ fontSize: 13, color: "var(--text-secondary)" }}
                  >
                    {ROLE_LABEL[item.publicRole] || "Viewer"}
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
                  disabled={isShareLoading || !emailInput.trim()}
                  style={{
                    opacity: !emailInput.trim() || isShareLoading ? 0.5 : 1,
                  }}
                >
                  {isShareLoading ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gd-modal-overlay" onClick={() => setShareItem(null)}>
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
          <button className="gd-icon-btn" onClick={() => setShareItem(null)}>
            <IconClose size={20} />
          </button>
        </div>

        {showInvitePanel && selectedUsers.length > 0 ? (
          /* ── Invite panel ── */
          <form onSubmit={handleSend} style={{ padding: "0 24px 24px" }}>
            <div className="gd-share-invite-row" style={{ marginBottom: 16 }}>
              <div
                className="gd-share-input-wrap gd-invite-chip-wrap"
                ref={inviteSuggestionsRef}
                style={{ position: "relative" }}
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
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <span
                              className="gd-avatar"
                              style={{
                                width: 36,
                                height: 36,
                                background: "#1a73e8",
                                fontSize: 18,
                                fontWeight: 100,
                              }}
                            >
                              {user.name?.charAt(0)?.toUpperCase()}
                            </span>
                          )}
                          <div className="people-details">
                            <span className="people-name">{user.name}</span>
                            <span className="people-email">{user.email}</span>
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
                    setOpenDropdown(openDropdown === "invite" ? null : "invite")
                  }
                >
                  {ROLE_LABEL[inviteRole] || inviteRole}{" "}
                  <IconChevronDown size={14} />
                </button>
                {openDropdown === "invite" && (
                  <RoleDropdown
                    anchorRef={inviteRoleRef}
                    current={inviteRole}
                    onChange={(r) => {
                      setInviteRole(r);
                      setSelectedUsers((prev) =>
                        prev.map((u) => ({ ...u, relation: r })),
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
              <button type="submit" className="gd-btn gd-btn-primary">
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
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span
                          className="gd-avatar"
                          style={{
                            width: 36,
                            height: 36,
                            background: "#1a73e8",
                            fontSize: 18,
                            fontWeight: 100,
                          }}
                        >
                          {user.name?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
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
              <div className="gd-share-section-label">People with access</div>
              <div
                onClick={() =>
                  setActivePerson(activePerson === "owner" ? null : "owner")
                }
                className={`gd-share-owner ${activePerson === "owner" ? "gd-active" : ""}`}
              >
                <div key={item.userId.id} className="gd-share-person-row">
                  <UseAvatar
                    name={item.userId.name}
                    avatar={item.userId.avatar}
                  />
                  <div className="gd-share-person-info">
                    <div className="gd-share-person-name">
                      {item.userId.name} (you)
                    </div>
                    <div className="gd-share-person-email">
                      {item.userId.email}
                    </div>
                  </div>
                  <div className="gd-share-role-select">
                    <span className="gd-share-owner-label">Owner</span>
                  </div>
                </div>
              </div>
            </>

            {peopleWithAccess.length > 0 && (
              <div className="gd-share-people-list">
                {peopleWithAccess.map((person, idx) => {
                  if (!personRefs.current[idx])
                    personRefs.current[idx] = { current: null };
                  return (
                    <div
                      key={person.email}
                      onClick={() =>
                        setActivePerson(activePerson === idx ? null : idx)
                      }
                      className={`gd-share-person ${activePerson === idx ? "gd-active" : ""}`}
                    >
                      <div className="gd-share-person-row">
                        <UseAvatar name={person.name} avatar={person.avatar} />
                        <div className="gd-share-person-info">
                          <div className="gd-share-person-name">
                            {person.name}
                          </div>
                          <div className="gd-share-person-email">
                            {person.email}
                          </div>
                        </div>
                        <div className="gd-share-role-select">
                          <button
                            ref={(el) =>
                              (personRefs.current[idx] = { current: el })
                            }
                            className="gd-share-person-role-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdown(
                                openDropdown === idx ? null : idx,
                              );
                            }}
                          >
                            {ROLE_LABEL[person.relation] || person.relation}{" "}
                            <IconChevronDown size={12} />
                          </button>
                          {openDropdown === idx && (
                            <RoleDropdown
                              anchorRef={personRefs.current[idx]}
                              current={person.relation}
                              onChange={(r) => updatePersonRole(person, idx, r)}
                              onClose={() => setOpenDropdown(null)}
                              showRemove={isOwner}
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

            <div className="gd-share-divider" />
            <div className="gd-share-section-label">General access</div>

            <div className="gd-share-link-section">
              <div className="gd-share-link-row">
                <div
                  className={`gd-share-link-icon ${linkAccess === "anyone" ? "active" : ""}`}
                >
                  {linkAccess === "anyone" ? (
                    <IconGlobe size={18} />
                  ) : (
                    <IconLock size={18} />
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
                      onClick={() => setShowAccessDropdown(!showAccessDropdown)}
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
                              {linkAccess === opt && <IconCheck size={16} />}
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
                      ? `Anyone on the internet with the link can ${linkRole}`
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
                          current={linkRole}
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
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="gd-share-footer">
              <button
                className={`gd-btn  ${isShareLoading ? "btn-loading" : "gd-btn-primary"}`}
                onClick={() => setShareItem(null)}
              >
                {isShareLoading ? "Saving..." : "Done"}
              </button>
            </div>
          </>
        )}
        {isShareLoading && <div className="gd-share-modal-loader"></div>}
      </div>
    </div>
  );
}
