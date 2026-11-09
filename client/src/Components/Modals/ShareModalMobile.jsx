import { useState, useRef, useEffect } from "react";
import {
  IconClose,
  IconPersonAdd,
  IconLink,
  IconCheck,
  IconChevronDown,
  IconTrash,
} from "../Icons/Icons.jsx";
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { GlobeAmericasIcon } from "@heroicons/react/24/solid";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import {
  DRIVE_ROLES,
  ROLE_DESC,
  ROLE_LABEL,
} from "../../../Utils/displayUtils.js";
import { UseAvatar } from "../../Hooks/useAvatar.jsx";
import { grantAccessById, revokeFileAccess } from "../../../apis/fileApi.js";
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
import { BottomSheet, SheetItem } from "../Drive/BottomSheet.jsx";
import ConfirmationModalMobile from "./ConfirmationModalMobile.jsx";


const SLIDE_MS = 300;
const EASE = "cubic-bezier(0.22, 0.8, 0.24, 1)";

const ROLE_PRIORITY = { reader: 1, writer: 2, owner: 3 };

/* ───────────── helpers (same as ShareModal) ───────────── */

const getItemType = (it) =>
  it?.webViewLink ? "google" : it?.isDirectory ? "folder" : "file";

const getItemId = (it) => String(it?._id ?? it?.id);

const getItemUrl = (it) =>
  it?.webViewLink
    ? it.webViewLink
    : it
      ? `${window.location.origin}/${it.isDirectory ? "directory" : "file"}/${it._id}?usp=drive_link`
      : window.location.href;

function getCountLabel(list) {
  const dirs = list.filter((i) => i?.isDirectory).length;
  const noun =
    dirs === list.length ? "folders" : dirs === 0 ? "files" : "items";
  return `${list.length} ${noun}`;
}

const getAnyonePermission = (it) =>
  it?.permissions?.find((p) => p?.type === "anyone");

const hasAnyone = (it) => Boolean(getAnyonePermission(it));

const emailOf = (p) => (p?.emailAddress ?? p?.email ?? "").toLowerCase();

function getCommonPermissions(list) {
  const people = (it) =>
    (it?.permissions ?? []).filter((p) => p?.type !== "anyone");

  const [first, ...rest] = list;
  if (!first) return [];

  return people(first)
    .filter((p) => {
      const email = emailOf(p);
      return (
        email &&
        rest.every((it) => people(it).some((q) => emailOf(q) === email))
      );
    })
    .map((p) => {
      const email = emailOf(p);
      const roles = list.map(
        (it) => people(it).find((q) => emailOf(q) === email)?.role,
      );
      const lowest = [...roles].sort(
        (a, b) => (ROLE_PRIORITY[a] ?? 0) - (ROLE_PRIORITY[b] ?? 0),
      )[0];
      return { ...p, role: lowest };
    });
}

const roleKeyLabel = (k) => ROLE_LABEL[DRIVE_ROLES[k]] ?? k;

/* ───────────── small UI pieces ───────────── */

function TopBar({ left, title, right }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-1 px-2">
      <div className="flex w-10 justify-center">{left}</div>
      <h2 className="min-w-0 flex-1 truncate text-left text-[18px] font-medium text-(--text-primary)">
        {title}
      </h2>
      <div className="flex min-w-10 justify-end pr-1">{right}</div>
    </div>
  );
}

function RoundBtn({ onClick, label, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full text-(--text-primary) active:bg-black/10 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="px-5 pb-1 pt-5 text-[13px] font-medium text-(--text-secondary)">
      {children}
    </div>
  );
}

function PersonRow({ avatar, name, title, subtitle, trailing, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-black/5"
    >
      <UseAvatar avatar={avatar} name={name} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] text-(--text-primary)">
          {title}
        </div>
        {subtitle && (
          <div className="truncate text-[13px] text-(--text-secondary)">
            {subtitle}
          </div>
        )}
      </div>
      {trailing}
    </Tag>
  );
}

function Chip({ user, onRemove }) {
  return (
    <div className="flex max-w-full items-center gap-1.5 rounded-full border border-black/15 py-0.5 pl-0.5 pr-2 text-[14px]">
      <UseAvatar
        avatar={user.avatar || user.photoLink}
        name={user.name || user.displayName}
        size={24}
        fontSize={12}
      />
      <span className="truncate">
        {user.email ?? user.emailAddress ?? user.name ?? user.displayName}
      </span>
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center rounded-full active:bg-black/10"
      >
        <IconClose size={12} />
      </button>
    </div>
  );
}

function CheckLabel({ checked, children }) {
  return (
    <span className="flex flex-1 items-center justify-between">
      {children}
      {checked && <IconCheck size={18} />}
    </span>
  );
}

/* ───────────── component ───────────── */

export default function ShareModalMobile({
  item: itemProp = null,
  items = null,
  setItem = null,
  allUsers = [],
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
  const { toast } = useToast();

  const shareItems = items?.length ? items : itemProp ? [itemProp] : [];
  const isMulti = shareItems.length > 1;
  const item = shareItems[0];
  const idsKey = shareItems.map(getItemId).join(",");

  const [emailInput, setEmailInput] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [message, setMessage] = useState("");
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [showInviteSuggestions, setShowInviteSuggestions] = useState(false);
  const [notifyPeople, setNotifyPeople] = useState(true);
  const [isConfirmation, setIsConfirmation] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // bottom sheet: null | {type:"person",person} | {type:"invite"}
  const [sheet, setSheet] = useState(null);
  // separate full-screen "General access" page: null | { id: itemId | null }
  // (id null => single mode)
  const [accessView, setAccessView] = useState(null);

  const [entered, setEntered] = useState(false);
  const lastAccess = useRef(null);
  const lastSheet = useRef(null);
  // optimistic per-item link state so changes show instantly (multi mode)
  const [linkOverride, setLinkOverride] = useState({});
  const searchRef = useRef(null);
  const inviteSearchRef = useRef(null);

  const type = getItemType(item);
  const isOwner = item?.owners?.[0]?.me === true;

  const canChangeRole = shareItems.every(
    (it) => (it?.capabilities?.canChangeRole ?? true) === true,
  );
  const canShare = shareItems.every(
    (it) => it?.capabilities?.canShare === true,
  );

  const shareTitle = isMulti
    ? `Share ${getCountLabel(shareItems)}`
    : `Share "${item?.name}"`;
  const sendLinkTitle = isMulti
    ? `Send links for ${getCountLabel(shareItems)}`
    : `Send link for "${item?.name}"`;

  const ownersPool = Object.values(
    shareItems
      .flatMap((it) => it?.owners ?? [])
      .reduce((acc, o) => {
        const key = o.emailAddress || o.email || o.id || o.permissionId;
        if (key && !acc[key]) acc[key] = o;
        return acc;
      }, {}),
  );

  /* slide the whole screen in from the right on mount */
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  /* lock page scroll while open */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* sync permissions + link access when selection changes */
  useEffect(() => {
    const permissions = isMulti
      ? getCommonPermissions(shareItems)
      : (item?.permissions ?? []);

    const allPublic = shareItems.length > 0 && shareItems.every(hasAnyone);
    const linkPermission = shareItems.map(getAnyonePermission).find(Boolean);

    setPeopleWithAccess(permissions);
    setPrevPermissions(permissions);
    setLinkAccess(allPublic ? "anyone" : "restricted");
    setLinkRole(linkPermission?.role || "reader");
  }, [idsKey]);

  useEffect(() => {
    const previous = prevPermissions ?? [];
    const current = peopleWithAccess ?? [];

    const equal =
      previous.length === current.length &&
      previous.every((prev) => {
        const prevId = String(prev?.id ?? prev?._id);
        const cur = current.find((p) => String(p?.id ?? p?._id) === prevId);
        return cur?.role === prev?.role;
      });

    setIsChanged(!equal);
  }, [prevPermissions, peopleWithAccess]);


  const matches = (u, q) =>
    u.name?.toLowerCase().includes(q.toLowerCase()) ||
    u.email?.toLowerCase().includes(q.toLowerCase());

  const suggestions = emailInput.trim()
    ? allUsers.filter((u) => matches(u, emailInput))
    : allUsers;

  const inviteSuggestions = (
    inviteInput.trim()
      ? allUsers.filter((u) => matches(u, inviteInput))
      : allUsers
  ).filter((u) => !selectedUsers.find((s) => s.id === u.id));

  function getExcludedEmails() {
    return [
      ...(isMulti ? [] : (item?.owners || []).map((o) => o.emailAddress)),
      ...(peopleWithAccess ?? []).map((p) => p.emailAddress),
    ]
      .filter(Boolean)
      .map((e) => e.toLowerCase());
  }

  const excludedEmails = getExcludedEmails();

  const isSelectable = (u, hideSelf) => {
    const email = u?.email?.toLowerCase();
    if (!email) return false;
    if (hideSelf && email === user.email) return false;
    if (isGoogleDriveRoute && u.provider === "local") return false;
    return !excludedEmails.includes(email);
  };

  /* ───────────── handlers (same logic as ShareModal) ───────────── */

  function handleSelectUser(e, u) {
    e.stopPropagation();
    setSelectedUsers([{ ...u, role: DRIVE_ROLES[inviteRole] }]);
    setEmailInput("");
    setShowSuggestions(false);
    setShowInvitePanel(true);
  }

  function handleAddUser(u) {
    if (selectedUsers.find((s) => s.id === u.id)) return;
    setSelectedUsers((prev) => [
      ...prev,
      { ...u, role: DRIVE_ROLES[inviteRole] },
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

  // slide the whole screen back out to the right, then unmount
  function closeShare() {
    setEntered(false);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => setShareItem(null), reduce ? 0 : SLIDE_MS);
  }

  function handleCancel() {
    setShowInvitePanel(false);
    // let the page finish sliding out before clearing its content
    setTimeout(() => {
      setSelectedUsers([]);
      setMessage("");
      setInviteInput("");
    }, SLIDE_MS);
  }

  function requestClose() {
    if (isChanged) setIsConfirmation(true);
    else {
      setSelectedUsers([]);
      closeShare();
    }
  }

  function applyShareToState(it, response) {
    const itemId = getItemId(it);

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

    const existingIds = new Set(currentPermissions.map((p) => String(p.id)));

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
    e?.preventDefault?.();

    if (isShareLoading || !selectedUsers.length || !shareItems.length) return;

    setIsShareLoading(true);

    try {
      const uniqueItems = [
        ...new Map(
          shareItems.map((it) => {
            const id = String(getItemId(it));
            const t = getItemType(it);

            return [
              `${t}:${id}`,
              {
                id,
                type: t,
                name: it.name || "Shared item",
                url: it.webViewLink || it.url || null,
                isFolder:
                  t === "folder" ||
                  it.mimeType === "application/vnd.google-apps.folder",
              },
            ];
          }),
        ).values(),
      ];

      const sendRequest = (confirmCascade = false) =>
        grantAccessById(
          null,
          null,
          selectedUsers,
          message,
          confirmCascade,
          notifyPeople,
          uniqueItems,
        );

      let data = await sendRequest(false);

      if (data?.needsConfirmation) {
        const conflicts = data.conflict || [];

        const details = conflicts
          .map(
            (c) => `${c.ancestorName}: ${c.previousRole} → ${c.requestedRole}`,
          )
          .join("\n");

        const confirmed = window.confirm(
          `Some users already have inherited permissions.\n\n${details}\n\nContinue?`,
        );

        if (!confirmed) return;

        data = await sendRequest(true);
      }

      if (!Array.isArray(data?.results)) {
        throw new Error(data?.message || "Invalid sharing response");
      }

      const succeeded = [];
      const failed = [];

      for (const result of data.results) {
        const permissions = result.permissions || [];
        const permissionFailures = permissions.filter(
          (p) => p.success === false,
        );
        const permissionSuccesses = permissions.filter(
          (p) => p.success === true,
        );

        const itemSucceeded =
          result.status >= 200 &&
          result.status < 300 &&
          !result.needsConfirmation &&
          permissionFailures.length === 0;

        if (itemSucceeded) {
          succeeded.push({ ...result, permissions: permissionSuccesses });
        } else {
          failed.push(result);
        }
      }

      const updatedIds = new Set();

      for (const result of succeeded) {
        const key = `${result.type}:${result.id}`;
        if (updatedIds.has(key)) continue;
        updatedIds.add(key);

        const found = shareItems.find(
          (it) =>
            String(getItemId(it)) === String(result.id) &&
            getItemType(it) === result.type,
        );

        if (found) applyShareToState(found, result);
      }

      const failedCount = uniqueItems.length - updatedIds.size;

      const permissionFailureCount = failed.reduce(
        (total, result) =>
          total +
          (result.permissions || []).filter((p) => p.success === false).length,
        0,
      );

      if (!updatedIds.size) {
        throw new Error(
          failed[0]?.permissions?.find((p) => p.success === false)?.message ||
            failed[0]?.message ||
            "Failed to share selected items",
        );
      }

      if (failedCount || permissionFailureCount) {
        toast({
          message: `Access updated for ${updatedIds.size} of ${uniqueItems.length} items. ${failedCount} item(s) failed.`,
          type: "error",
        });
      } else if (data.emailFailedFor?.length) {
        toast({
          message: "Access updated, but some notification emails failed.",
          type: "error",
        });
      } else {
        toast({
          message: `Successfully shared ${updatedIds.size} items`,
          type: "success",
        });
      }

      setSelectedUsers([]);
      setShowInvitePanel(false);
      setMessage("");
      setInviteInput("");
      closeShare();
    } catch (error) {
      console.error("handleSend error:", error.response?.data || error);
      toast({
        message:
          error.response?.data?.message ||
          error.message ||
          "Something went wrong while sharing",
        type: "error",
      });
    } finally {
      setIsShareLoading(false);
    }
  }

  async function handleSaveMultiPermissions() {
    if (isShareLoading || !isChanged) {
      closeShare();
      return;
    }

    try {
      setIsShareLoading(true);

      const previous = prevPermissions ?? [];
      const current = peopleWithAccess ?? [];

      const changedUsers = current.filter((person) => {
        if (person.role === "remove" || person.role === "owner") return false;
        const oldPerson = previous.find(
          (p) => String(p.id ?? p._id) === String(person.id ?? person._id),
        );
        return oldPerson && oldPerson.role !== person.role;
      });

      const removedUsers = current.filter((p) => p.role === "remove");

      if (!changedUsers.length && !removedUsers.length) {
        toast({ message: "No permission changes found", type: "error" });
        return;
      }

      const successfulUpdates = new Map();
      const failed = [];

      for (const selectedItem of shareItems) {
        const itemId = getItemId(selectedItem);
        const itemType = getItemType(selectedItem);
        const itemKey = `${itemType}:${itemId}`;

        successfulUpdates.set(itemKey, {
          itemId,
          itemType,
          granted: [],
          removed: [],
        });

        if (changedUsers.length) {
          try {
            const result = await grantAccessById(
              itemType,
              itemId,
              changedUsers,
              message,
              false,
              notifyPeople,
            );

            if (result?.needsConfirmation) {
              failed.push({
                item: selectedItem.name,
                message: "Role update requires confirmation",
              });
            } else {
              successfulUpdates.get(itemKey).granted.push(...changedUsers);
            }
          } catch (error) {
            failed.push({
              item: selectedItem.name,
              message: error.response?.data?.message || error.message,
            });
          }
        }

        for (const person of removedUsers) {
          try {
            const result = await revokeFileAccess(
              itemType,
              itemId,
              person.id,
              "remove",
              false,
            );

            if (result?.needsConfirmation) {
              failed.push({
                item: selectedItem.name,
                user: person.emailAddress,
                message: "Revoke requires confirmation",
              });
              continue;
            }

            successfulUpdates.get(itemKey).removed.push(person);
          } catch (error) {
            failed.push({
              item: selectedItem.name,
              user: person.emailAddress,
              message: error.response?.data?.message || error.message,
            });
          }
        }
      }

      const updateList = (list) =>
        list.map((resource) => {
          const update = successfulUpdates.get(
            `${getItemType(resource)}:${getItemId(resource)}`,
          );
          if (!update) return resource;

          const removedIds = new Set(
            update.removed.map((p) => String(p.id ?? p._id)),
          );

          const permissions = (resource.permissions ?? [])
            .filter((p) => !removedIds.has(String(p.id ?? p._id)))
            .map((p) => {
              const changedUser = update.granted.find(
                (u) => String(u.id ?? u._id) === String(p.id ?? p._id),
              );
              return changedUser ? { ...p, role: changedUser.role } : p;
            });

          return { ...resource, permissions };
        });

      setFilesList(updateList);
      setDirectoriesList(updateList);

      if (!failed.length) {
        const updatedPermissions = current.filter((p) => p.role !== "remove");
        setPeopleWithAccess(updatedPermissions);
        setPrevPermissions(updatedPermissions);
        closeShare();

        toast({
          message: `Permissions updated successfully for ${shareItems.length} items`,
          type: "success",
        });
      } else {
        toast({
          message: `${failed.length} permission operation(s) failed. Check console.`,
          type: "error",
        });
        console.error("Permission update failures:", failed);
      }
    } catch (error) {
      console.error("handleSaveMultiPermissions:", error);
      toast({
        message:
          error.response?.data?.message ||
          error.message ||
          "Failed to update permissions",
        type: "error",
      });
    } finally {
      setIsShareLoading(false);
    }
  }

  async function handleSendLink(e) {
    e?.preventDefault?.();

    if (isShareLoading) return;

    if (!selectedUsers.length) {
      toast({ message: "Please select a person", type: "error" });
      return;
    }

    if (!shareItems.length) {
      toast({ message: "No items selected", type: "error" });
      return;
    }

    try {
      setIsShareLoading(true);

      const uniqueItems = [
        ...new Map(
          shareItems.map((it) => {
            const id = String(it._id ?? it.id);
            const t = getResourceType(it);

            return [
              `${t}:${id}`,
              {
                id,
                type: t,
                name: it.name,
                ...(it.webViewLink && {
                  url: it.webViewLink,
                  isPublic: hasAnyone(it),
                  publicRole: getAnyonePermission(it)?.role ?? "reader",
                }),
              },
            ];
          }),
        ).values(),
      ];

      const data = await sendLink({
        message,
        notifyPeople,
        toEmails: [
          ...new Set(
            selectedUsers
              .map((u) => (u.email ?? u.emailAddress)?.trim().toLowerCase())
              .filter(Boolean),
          ),
        ],
        items: uniqueItems,
      });

      const failedItems = data.failed ?? [];
      const failedRecipients = data.failedRecipients ?? [];

      if (failedItems.length || failedRecipients.length) {
        toast({
          message:
            data.message ||
            `Some links could not be sent. ${failedItems.length} item(s) and ${failedRecipients.length} recipient(s) failed.`,
          type: "error",
        });
      } else {
        toast({
          message:
            data.message ||
            `Links successfully sent for ${uniqueItems.length} items`,
          type: "success",
        });
      }

      setSelectedUsers([]);
      closeShare();
      setMessage("");
      setInviteInput("");
      setShowInvitePanel(false);
    } catch (error) {
      console.error("handleSendLink error:", error.response?.data || error);
      toast({
        message:
          error.response?.data?.message ||
          error.message ||
          "Something went wrong while sending links",
        type: "error",
      });
    } finally {
      setIsShareLoading(false);
    }
  }

  function updatePersonRole(person, role) {
    setUserRole({ emailAddress: person.emailAddress, role });
    setPeopleWithAccess((prev) => {
      const hasPublicAccess = prev.some((p) => p.type === "anyone");

      let updated = prev.map((p) => {
        const isPublicAccess = p.type === "anyone";

        if (isPublicAccess && linkAccess === "restricted") return null;

        if (isPublicAccess && linkAccess === "anyone") {
          return { ...p, id: "anyoneWithLink", type: "anyone", role: linkRole };
        }

        if (p.id === person.id) {
          return { ...p, role: role !== "remove" ? DRIVE_ROLES[role] : role };
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
    setSheet(null);
  }

  // Patch the single open item's permissions everywhere it lives
  function patchOpenItem(updatePermissions) {
    const itemId = String(item?._id ?? item?.id);
    const sameItem = (r) => String(r?._id ?? r?.id) === itemId;

    setShareItem((current) => (current ? updatePermissions(current) : current));
    setFilesList((prev) =>
      prev.map((r) => (sameItem(r) ? updatePermissions(r) : r)),
    );
    setDirectoriesList((prev) =>
      prev.map((r) => (sameItem(r) ? updatePermissions(r) : r)),
    );
  }

  async function sendOwnershipTransferMail(person) {
    setSheet(null);
    setIsShareLoading(true);
    try {
      const result = await sendOwnershipMail({
        newOwner: person,
        itemId: item._id ?? item.id,
        type,
      });
      const newPermission = result.permission;

      patchOpenItem((resource) => {
        if (!resource?.permissions) return resource;
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
      });

      toast({ message: result.message, type: "success" });
    } catch (error) {
      toast({ message: error.message, type: "error" });
    } finally {
      setIsShareLoading(false);
    }
  }

  async function cancelOwnershipTransferMail(person) {
    setSheet(null);
    try {
      setIsShareLoading(true);
      const { message: msg } = await cancelPendingOwnership({
        newOwner: person,
        itemId: item._id ?? item.id,
        type,
      });

      patchOpenItem((resource) => {
        if (!resource?.permissions) return resource;
        return {
          ...resource,
          permissions: resource.permissions.map((permission) => {
            if (String(permission?.id) !== String(person?.id)) return permission;
            const { pendingOwner, ...clean } = permission;
            return clean;
          }),
        };
      });

      toast({ message: msg, type: "success" });
    } catch (error) {
      toast({ message: error.message, type: "error" });
    } finally {
      setIsShareLoading(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard
      .writeText(shareItems.map(getItemUrl).join("\n"))
      .then(() =>
        toast({
          message: isMulti
            ? "Links copied to clipboard"
            : "Link copied to clipboard",
          type: "success",
        }),
      )
      .catch(() => {});
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  // single mode applies to all (one) item(s); multi mode targets one item
  const applyLinkChange = (role, access) =>
    shareItems.forEach((it) => onClose(it, role, access));

  const applyLinkChangeToItem = (it, role, access) =>
    onClose(it, role, access);

  function handleSaveSingle() {
    onUpdateRoleAfterSave(item, type, message);
  }

  // live link state for one item: local override first, then its permissions
  const getLinkState = (it) => {
    const ov = linkOverride[getItemId(it)];
    const perm = getAnyonePermission(it);
    return {
      pub: ov?.pub ?? Boolean(perm),
      role: ov?.role ?? perm?.role ?? "reader",
    };
  };

  const saveLabel = isShareLoading ? "Saving..." : isChanged ? "Save" : "Done";

  if (!item) return null;

  /* ───────────── shared sub-views ───────────── */

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const dur = reduceMotion ? 0 : SLIDE_MS;

  // root: slides in from the right on open
  const shell = (children) => (
    <div
      className="fixed inset-0 z-1000 overflow-hidden bg-black/0 text-(--text-primary)"
      style={{
        transform: entered ? "translateX(0)" : "translateX(100%)",
        transition: `transform ${dur}ms ${EASE}`,
      }}
    >
      {children}
     {isShareLoading && (
  <div className="absolute inset-x-0 top-0 z-100 h-0.75 overflow-hidden bg-[#d2e3fc]">
    <div className="drive-progress-bar" />
  </div>
)}
    </div>
  );

  // a screen: slides in from the right; `shifted` nudges the one underneath
 const layer = (visible, children, shifted = false) => (
  <div
    aria-hidden={!visible}
    ref={(el) => {
      if (el && !visible && el.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    }}
    {...(!visible ? { inert: "" } : {})}
    className="absolute inset-0 flex flex-col bg-(--surface-white,#fff)"
    style={{
      paddingTop: "env(safe-area-inset-top, 0px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      transform: !visible
        ? "translateX(100%)"
        : shifted
          ? "translateX(-22%)"
          : "translateX(0)",
      visibility: visible ? "visible" : "hidden",
      boxShadow: visible ? "-8px 0 24px rgba(0,0,0,0.12)" : "none",
      transition: `transform ${dur}ms ${EASE}, visibility 0s linear ${visible ? 0 : dur}ms`,
    }}
  >
    {children}
  </div>
);

const discardDialog = (
  <ConfirmationModalMobile
    open={isConfirmation}
    title="Discard unsaved changes?"
    description="Your changes haven't been saved. Are you sure you want to discard them?"
    action_1="Cancel"
    action_2="Discard"
    onClose={() => setIsConfirmation(false)}
    onAction_1={() => setIsConfirmation(false)}
    onAction_2={() => {
      setIsConfirmation(false);
      closeShare();
    }}
  />
);
  const messageField = (
    <textarea
      className="mt-3 w-full resize-none rounded-lg border border-black/20 bg-transparent p-3 text-[15px] outline-none focus:border-[#1a73e8]"
      placeholder="Message"
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      rows={4}
    />
  );

  const copyLinkBar = (
    <div className="flex shrink-0 items-center gap-3 border-t border-black/10 px-4 py-3">
      <button
        type="button"
        onClick={handleCopyLink}
        className="flex items-center gap-2 rounded-full border border-black/20 px-4 py-2 text-[14px] font-medium text-[#1a73e8] active:bg-black/5"
      >
        {copyFeedback ? <IconCheck size={16} /> : <IconLink size={16} />}
        {copyFeedback
          ? "Copied!"
          : isMulti
            ? "Copy links"
            : "Copy link"}
      </button>
      <div className="flex-1 text-[13px] text-(--text-secondary)">
        {isChanged && "Pending changes"}
      </div>
    </div>
  );

  /* separate full-screen General access page (like the Drive app) */
  function renderAccessPage() {
    const view = accessView ?? lastAccess.current;
    if (!view) return null;
    if (accessView) lastAccess.current = accessView;

    const it = view.id
      ? shareItems.find((x) => getItemId(x) === view.id)
      : null;
    const live = it ? getLinkState(it) : null;
    const pub = it ? live.pub : linkAccess === "anyone";
    const role = it ? live.role : linkRole;
    const canEdit = it ? it?.capabilities?.canShare === true : true;

    const setAccess = (opt) => {
      if ((opt === "anyone") === pub) return;
      if (it) {
        setLinkOverride((o) => ({
          ...o,
          [getItemId(it)]: { pub: opt === "anyone", role },
        }));
        applyLinkChangeToItem(it, role, opt);
      }
      else {
        setLinkAccess(opt);
        applyLinkChange(linkRole, opt);
      }
    };

    const setRole = (r) => {
      if (r === role) return;
      if (it) {
        setLinkOverride((o) => ({
          ...o,
          [getItemId(it)]: { pub: true, role: r },
        }));
        applyLinkChangeToItem(it, r, "anyone");
      }
      else {
        setLinkRole(r);
        applyLinkChange(r, linkAccess);
      }
    };

    return layer(
      Boolean(accessView),
      <>
        <TopBar
          left={
            <RoundBtn label="Back" onClick={() => setAccessView(null)}>
              <ArrowLeftIcon className="h-6 w-6" />
            </RoundBtn>
          }
          title="General access"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          {it && (
            <div className="truncate px-5 pb-2 text-[14px] text-(--text-secondary)">
              {it.name}
            </div>
          )}

          {["restricted", "anyone"].map((opt) => {
            const selected = (opt === "anyone") === pub;
            return (
              <button
                key={opt}
                type="button"
                disabled={!canEdit}
                onClick={() => setAccess(opt)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-black/5 disabled:opacity-50"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    opt === "anyone" ? "bg-[#e6f4ea]" : "bg-black/5"
                  }`}
                >
                  {opt === "anyone" ? (
                    <GlobeAmericasIcon className="h-5 w-5 text-green-900" />
                  ) : (
                    <LockClosedIcon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px]">
                    {opt === "anyone" ? "Anyone with the link" : "Restricted"}
                  </div>
                  <div className="text-[13px] text-(--text-secondary)">
                    {opt === "anyone"
                      ? `Anyone on the internet with the link ${ROLE_DESC[role] ?? ""}`
                      : "Only people with access can open with this link"}
                  </div>
                </div>
                {selected && <IconCheck size={20} />}
              </button>
            );
          })}
<div
  className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
  style={{
    gridTemplateRows: pub ? "1fr" : "0fr",
    opacity: pub ? 1 : 0,
  }}
  aria-hidden={!pub}
  inert={pub ? undefined : ""}
>
  <div className="overflow-hidden">
    <SectionLabel>Link role</SectionLabel>

    {["reader", "writer"].map((r) => (
      <button
        key={r}
        type="button"
        disabled={!canEdit || !pub}
        onClick={() => setRole(r)}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-[15px] active:bg-black/5 disabled:opacity-50"
      >
        {ROLE_LABEL[r]}
        {r === role && <IconCheck size={20} />}
      </button>
    ))}
  </div>
</div>
        </div>

        {copyLinkBar}
      </>,
    );
  }

  /* person role bottom sheet */
  if (sheet) lastSheet.current = sheet;
  const sheetView = sheet ?? lastSheet.current;

  function renderPersonSheet() {
    if (sheetView?.type !== "person") return null;
    const person = sheetView.person;

    return (
      <div className="pb-4">
        <div className="truncate px-6 pb-2 pt-1 text-[15px] font-medium">
          {person.displayName || person.emailAddress}
        </div>
        {Object.keys(DRIVE_ROLES).map((k) => (
          <SheetItem
            key={k}
            icon={<span className="h-6 w-6" />}
            label={
              <CheckLabel checked={DRIVE_ROLES[k] === person.role}>
                {roleKeyLabel(k)}
              </CheckLabel>
            }
            onClick={() => updatePersonRole(person, k)}
          />
        ))}
        {isOwner && person.role === "writer" && !person.pendingOwner && (
          <SheetItem
            icon={<span className="h-6 w-6" />}
            label="Transfer ownership"
            disabled={isChanged}
            onClick={() => sendOwnershipTransferMail(person)}
          />
        )}
        {isOwner && person.pendingOwner && (
          <SheetItem
            icon={<span className="h-6 w-6" />}
            label="Cancel ownership transfer"
            onClick={() => cancelOwnershipTransferMail(person)}
          />
        )}
        <SheetItem
          icon={<IconTrash size={22} />}
          label="Remove access"
          onClick={() => updatePersonRole(person, "remove")}
        />
      </div>
    );
  }

  /* invite role bottom sheet */
  function renderInviteSheet() {
    if (sheetView?.type !== "invite") return null;
    return (
      <div className="pb-4">
        <div className="px-6 pb-2 pt-1 text-[15px] font-medium">
          Permission
        </div>
        {Object.keys(DRIVE_ROLES).map((k) => (
          <SheetItem
            key={k}
            icon={<span className="h-6 w-6" />}
            label={
              <CheckLabel checked={k === inviteRole}>
                {roleKeyLabel(k)}
              </CheckLabel>
            }
            onClick={() => {
              setInviteRole(k);
              setSelectedUsers((prev) =>
                prev.map((u) => ({ ...u, role: DRIVE_ROLES[k] })),
              );
              setSheet(null);
            }}
          />
        ))}
      </div>
    );
  }

  const sheets = (
    <BottomSheet
      open={Boolean(sheet)}
      onClose={() => setSheet(null)}
      zIndex={1100}
    >
      {renderPersonSheet()}
      {renderInviteSheet()}
    </BottomSheet>
  );

  /* ───────────── 1) no share permission: send link ───────────── */

  if (!canShare) {
    return (
      <>
        {discardDialog}
        {shell(layer(true,
          <>
            <TopBar
              left={
                <RoundBtn label="Close" onClick={requestClose}>
                  <IconClose size={22} />
                </RoundBtn>
              }
              title={sendLinkTitle}
              right={
                <RoundBtn
                  label="Send"
                  disabled={isShareLoading || !selectedUsers.length}
                  onClick={handleSendLink}
                >
                  <PaperAirplaneIcon className="h-6 w-6 text-[#1a73e8]" />
                </RoundBtn>
              }
            />

            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <p className="mb-3 text-[13px] text-(--text-secondary)">
                {isMulti
                  ? "You'll send an email with the links from below"
                  : "You'll send an email with the link from below"}
              </p>

              <div
                ref={inviteSearchRef}
                className="rounded-lg border-2 border-[#1a73e8] px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {selectedUsers.map((u) => (
                    <Chip
                      key={u._id ?? u.id}
                      user={u}
                      onRemove={() => handleRemoveSelected(u.id)}
                    />
                  ))}
                  <input
                    type="text"
                    className="min-w-30 flex-1 bg-transparent py-1 text-[15px] outline-none"
                    placeholder="Add people to send the link to"
                    value={inviteInput}
                    onChange={(e) => {
                      setInviteInput(e.target.value);
                      setShowInviteSuggestions(true);
                    }}
                    onFocus={() => setShowInviteSuggestions(true)}
                  />
                </div>
              </div>

              {showInviteSuggestions && !selectedUsers.length && (
                <div className="mt-2">
                  {ownersPool.map((u) => (
                    <PersonRow
                      key={u.id || u.permissionId || u.emailAddress}
                      avatar={u.avatar || u.photoLink}
                      name={u.name || u.displayName}
                      title={u.name || u.displayName}
                      subtitle={u.email || u.emailAddress}
                      onClick={(e) => handleSelectUser(e, u)}
                    />
                  ))}
                </div>
              )}

              {messageField}

              {!isMulti && (
                <>
                  <SectionLabel>General access</SectionLabel>
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6f4ea]">
                      {linkAccess === "anyone" ? (
                        <GlobeAmericasIcon className="h-5 w-5 text-[#1e8e3e]" />
                      ) : (
                        <LockClosedIcon className="h-5 w-5 text-[#1e8e3e]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px]">
                        {linkAccess === "anyone"
                          ? "Anyone with the link"
                          : "Restricted"}
                      </div>
                      <div className="text-[13px] text-(--text-secondary)">
                        {linkAccess === "anyone"
                          ? `Anyone on the internet with the link ${ROLE_DESC[linkRole]}`
                          : "Only people with access can open with this link"}
                      </div>
                    </div>
                    {linkAccess === "anyone" && (
                      <span className="text-[13px] text-(--text-secondary)">
                        {ROLE_LABEL[linkRole]}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {copyLinkBar}
          </>,
        ))}
      </>
    );
  }

  /* ───────────── 2) invite panel (after picking a person) ───────────── */

  function renderInvitePanel() {
    return layer(
          showInvitePanel,
          <>
            <TopBar
              left={
                <RoundBtn label="Back" onClick={handleCancel}>
                  <ArrowLeftIcon className="h-6 w-6" />
                </RoundBtn>
              }
              title={shareTitle}
              right={
                <RoundBtn
                  label={notifyPeople ? "Send" : "Share"}
                  disabled={isShareLoading}
                  onClick={handleSend}
                >
                  <PaperAirplaneIcon className="h-6 w-6 text-[#1a73e8]" />
                </RoundBtn>
              }
            />

            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {/* tap people below to add them */}
              <div ref={inviteSearchRef} className="rounded-lg border border-black/20 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedUsers.map((u) => (
                    <Chip
                      key={u._id ?? u.id}
                      user={u}
                      onRemove={() => handleRemoveSelected(u.id)}
                    />
                  ))}
                  <input
                    type="text"
                    className="min-w-30 flex-1 bg-transparent py-1 text-[15px] outline-none"
                    placeholder="Add more people..."
                    value={inviteInput}
                    onChange={(e) => {
                      setInviteInput(e.target.value);
                      setShowInviteSuggestions(true);
                    }}
                    onFocus={() => setShowInviteSuggestions(true)}
                  />
                </div>
              </div>

              {showInviteSuggestions && (
                <div className="-mx-5 mt-1">
                  <div className="flex justify-end px-5 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInviteSuggestions(false);
                        document.activeElement?.blur?.();
                      }}
                      className="py-1 text-[14px] font-medium text-[#1a73e8]"
                    >
                      Done
                    </button>
                  </div>
                  {inviteSuggestions
                    .filter((u) => isSelectable(u, false))
                    .map((u) => (
                      <PersonRow
                        key={u.id}
                        avatar={u.avatar}
                        name={u.name}
                        title={u.name}
                        subtitle={u.email}
                        onClick={() => handleAddUser(u)}
                      />
                    ))}
                </div>
              )}

              {!showInviteSuggestions && (
                <>
                  <button
                    type="button"
                    onClick={() => setSheet({ type: "invite" })}
                    className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-3 text-left active:bg-black/5"
                  >
                    <span className="text-[15px]">Permission</span>
                    <span className="flex items-center gap-1 text-[15px] text-[#1a73e8]">
                      {roleKeyLabel(inviteRole)}
                      <IconChevronDown size={14} />
                    </span>
                  </button>

                  <label className="flex cursor-pointer items-center justify-between px-1 py-3">
                    <span className="text-[15px]">Notify people</span>
                    <input
                      type="checkbox"
                      checked={notifyPeople}
                      onChange={(e) => setNotifyPeople(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-blue-600"
                    />
                  </label>

                  {notifyPeople && messageField}
                </>
              )}
            </div>

            {copyLinkBar}
          </>,
    );
  }

  /* ───────────── 3b) normal share view ───────────── */

  const sortedPeople = [...(peopleWithAccess ?? [])]
    .filter((p) => p?.type !== "anyone")
    .sort(
      (a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0),
    );

  return (
    <>
      {discardDialog}
      {shell(
        <>
          {layer(true, <>
          <TopBar
            left={
              <RoundBtn
                label="Close"
                onClick={() =>
                  isChanged ? setIsConfirmation(true) : closeShare()
                }
              >
                <IconClose size={22} />
              </RoundBtn>
            }
            title={shareTitle}
            right={
              <button
                type="button"
                disabled={isShareLoading}
                onClick={() =>
                  isMulti ? handleSaveMultiPermissions() : handleSaveSingle()
                }
                className="rounded-full px-3 py-1.5 text-[15px] font-medium text-[#1a73e8] active:bg-black/5 disabled:opacity-50"
              >
                {saveLabel}
              </button>
            }
          />

          <div className="flex-1 overflow-y-auto pb-6">
            {/* search */}
            <div ref={searchRef} className="flex items-center gap-2 px-4">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full px-0.5 py-2.5">
                <IconPersonAdd
                  size={18}
                  style={{ color: "var(--text-tertiary)", flexShrink: 0 }}
                />
                <input
                  type="text"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                  placeholder="Add people and groups"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {emailInput && (
                  <button
                    type="button"
                    aria-label="Clear"
                    onClick={() => setEmailInput("")}
                  >
                    <IconClose size={16} />
                  </button>
                )}
              </div>
              {showSuggestions && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSuggestions(false);
                    setEmailInput("");
                    document.activeElement?.blur?.();
                  }}
                  className="px-2 py-2 text-[15px] font-medium text-[#1a73e8]"
                >
                  Cancel
                </button>
              )}
            </div>

            {showSuggestions ? (
              <div className="mt-2">
                {suggestions
                  .filter((s) => isSelectable(s, true))
                  .map((u) => (
                    <PersonRow
                      key={u.id}
                      avatar={u.avatar}
                      name={u.name}
                      title={u.name}
                      subtitle={u.email}
                      onClick={(e) => handleSelectUser(e, u)}
                    />
                  ))}
              </div>
            ) : (
              <>
                <SectionLabel>People with access</SectionLabel>

                {sortedPeople.map((person) => {
                  const roleLocked = person.role === "owner" || !canChangeRole;

                  return (
                    <PersonRow
                      key={person?.email || person?.emailAddress}
                      avatar={person?.photoLink || person?.avatar}
                      name={person?.displayName || person?.name}
                      title={
                        <span
                          className={
                            person?.role === "remove" ? "line-through" : ""
                          }
                        >
                          {person?.displayName}
                          {person?.emailAddress === user.email ? " (you)" : ""}
                        </span>
                      }
                      subtitle={
                        person?.pendingOwner
                          ? `${person?.emailAddress} · Pending owner`
                          : person?.emailAddress
                      }
                      onClick={
                        roleLocked
                          ? undefined
                          : () => setSheet({ type: "person", person })
                      }
                      trailing={
                        <span
                          className={`flex items-center gap-1 text-[14px] ${
                            roleLocked
                              ? "text-(--text-secondary)"
                              : "text-(--text-primary)"
                          }`}
                        >
                          {ROLE_LABEL[person?.role] ?? person?.role}
                          {!roleLocked && <IconChevronDown size={12} />}
                        </span>
                      }
                    />
                  );
                })}

                {!canChangeRole && (
                  <p className="px-5 pt-1 text-[12px] text-(--text-secondary)">
                    Can't reduce permission because it's set on a parent folder
                  </p>
                )}

                <SectionLabel>General access</SectionLabel>

                {!isMulti ? (
                  <button
                    type="button"
                    onClick={() => setAccessView({ id: null })}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-black/5"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        linkAccess === "anyone" ? "bg-[#e6f4ea]" : "bg-black/5"
                      }`}
                    >
                      {linkAccess === "anyone" ? (
                        <GlobeAmericasIcon className="h-5 w-5 text-green-900" />
                      ) : (
                        <LockClosedIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px]">
                        {linkAccess === "anyone"
                          ? "Anyone with the link"
                          : "Restricted"}
                        {linkAccess === "anyone" && (
                          <span className="text-(--text-secondary)">
                            {" · "}
                            {ROLE_LABEL[linkRole]}
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-(--text-secondary)">
                        {linkAccess === "anyone"
                          ? `Anyone on the internet with the link ${ROLE_DESC[linkRole]}`
                          : "Only people with access can open with this link"}
                      </div>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-(--text-secondary)" />
                  </button>
                ) : (
                  shareItems.map((it) => {
                    const { pub, role } = getLinkState(it);
                    const canShareThis = it?.capabilities?.canShare === true;

                    return (
                      <button
                        key={getItemId(it)}
                        type="button"
                        disabled={!canShareThis}
                        onClick={() => setAccessView({ id: getItemId(it) })}
                        className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-black/5 disabled:opacity-50"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            pub ? "bg-[#e6f4ea]" : "bg-black/5"
                          }`}
                        >
                          {pub ? (
                            <GlobeAmericasIcon className="h-5 w-5 text-green-900" />
                          ) : (
                            <LockClosedIcon className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px]">{it.name}</div>
                          <div className="truncate text-[13px] text-(--text-secondary)">
                            {pub
                              ? `Anyone with the link · ${ROLE_LABEL[role]}`
                              : "Restricted"}
                          </div>
                        </div>
                        <ChevronRightIcon className="h-4 w-4 text-(--text-secondary)" />
                      </button>
                    );
                  })
                )}
              </>
            )}
          </div>

          {!showSuggestions && copyLinkBar}
          </>, showInvitePanel || Boolean(accessView))}
          {renderInvitePanel()}
          {renderAccessPage()}
        </>,
      )}
      {sheets}
    </>
  );
}