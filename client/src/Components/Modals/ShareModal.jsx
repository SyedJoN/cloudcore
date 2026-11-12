import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  IconClose,
  IconPersonAdd,
  IconLink,
  IconCheck,
  IconChevronDown,
  IconGlobe,
  IconFolder,
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
import { GlobeAmericasIcon } from "@heroicons/react/24/solid";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import MouseTooltip from "../Tooltip/Tooltip.jsx";
import FileBadge from "../File/FileBadge.jsx";
import { getFileKind } from "../../../Utils/fileKind.js";

export const ROLE_PRIORITY = {
  reader: 1,
  writer: 2,
  owner: 3,
};

// Approx height of the 2-option dropdown, used to decide whether to open upwards
const ITEM_DROPDOWN_HEIGHT = 96;

// Literal class names so Tailwind can detect them
const ORIGIN_CLASS = {
  "top-left": "origin-top-left",
  "top-right": "origin-top-right",
  "bottom-left": "origin-bottom-left",
  "bottom-right": "origin-bottom-right",
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

const getAnyonePermission = (it) =>
  it?.permissions?.find((p) => p?.type === "anyone");

const hasAnyone = (it) => Boolean(getAnyonePermission(it));

const emailOf = (p) => (p?.emailAddress ?? p?.email ?? "").toLowerCase();

// People who have access to EVERY selected item (lowest role wins)
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

export default function ShareModal({
  item: itemProp = null, // single item (backward compatible)
  items = null, // array of items
  setItem = null,
  setViewItem,
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
  const idsKey = shareItems.map(getItemId).join(",");

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
  // multi mode: which per-item dropdown is open -> `${itemId}:access` | `${itemId}:role`
  const [itemAccessDropdown, setItemAccessDropdown] = useState(null);
  // multi mode: fixed screen position + origin of the portaled dropdown
  const [itemDropdownPos, setItemDropdownPos] = useState(null);

  const [isConfirmation, setIsConfirmation] = useState(false);
  const [isChanged, setIsChanged] = useState(false);

  const inviteRoleRef = useRef(null);
  const linkRoleRef = useRef(null);
  const personRefs = useRef([]);
  const suggestionsRef = useRef(null);
  const inviteSuggestionsRef = useRef(null);
  const accessDropdownRef = useRef(null);
  const multiAccessRef = useRef(null);
  const itemDropdownRef = useRef(null); // the portaled dropdown itself
  const prevRoleRef = useRef(null);
  const shareModalOverlayRef = useRef(null);
  const [notifyPeople, setNotifyPeople] = useState(true);
  const modalContentRef = useRef(null);
  const [modalHeight, setModalHeight] = useState(null);
  const [heightReady, setHeightReady] = useState(false);

  const type = getItemType(item);
  const iconType = item.isDirectory ? null : getFileKind(item);

  const isOwner = item?.owners?.[0]?.me === true;

  // For multiple items, every one must allow the action
  const canChangeRole = shareItems.every(
    (it) => (it?.capabilities?.canChangeRole ?? true) === true,
  );
  const canShare = shareItems.every(
    (it) => it?.capabilities?.canShare === true,
  );

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

    const update = () => {
      const h = element.scrollHeight;
      if (h > 0) setModalHeight(h);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Sync permissions + link access whenever the selected items change
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

  // Multi-mode dropdown: the dropdown now lives in a portal (outside
  // multiAccessRef), so "outside" must exclude BOTH the list and the dropdown.
  useEffect(() => {
    if (!itemAccessDropdown) return;

    const onDown = (e) => {
      if (multiAccessRef.current?.contains(e.target)) return;
      if (itemDropdownRef.current?.contains(e.target)) return;
      setItemAccessDropdown(null);
    };
    // Fixed-position dropdown would float in the air if anything moves
    const close = () => setItemAccessDropdown(null);

    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true); // capture: catches inner scroll containers
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [itemAccessDropdown]);

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
  // With multiple items access differs per item, so only people who have
  // access to ALL items are excluded.
  function getExcludedEmails() {
    return [
      ...(isMulti ? [] : (item?.owners || []).map((o) => o.emailAddress)),
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
    setViewItem(applyPermissions);

    if (setItem) {
      updateItemState(setItem, itemId, { permissions: finalPermissions });
    }
  }

  const toLinkItems = (list) =>
    list.map((it) => ({
      id: it._id ?? it.id,
      type: getResourceType(it),
      ...(it.webViewLink && {
        name: it.name,
        url: it.webViewLink,
        isPublic: it.permissions?.some((p) => p.type === "anyone"),
        publicRole: it.permissions?.find((p) => p.type === "anyone")?.role,
      }),
    }));

  async function handleSend(e) {
    e.preventDefault();

    if (isShareLoading || !selectedUsers.length || !shareItems.length) {
      return;
    }

    setIsShareLoading(true);

    try {
      const uniqueItems = [
        ...new Map(
          shareItems.map((item) => {
            const id = String(getItemId(item));
            const type = getItemType(item);

            return [
              `${type}:${id}`,
              {
                id,
                type,
                name: item.name || "Shared item",
                url: item.webViewLink || item.url || null,
                isFolder:
                  type === "folder" ||
                  item.mimeType === "application/vnd.google-apps.folder",
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
          succeeded.push({
            ...result,
            permissions: permissionSuccesses,
          });
        } else {
          failed.push(result);
        }
      }

      const updatedIds = new Set();

      for (const result of succeeded) {
        const key = `${result.type}:${result.id}`;

        if (updatedIds.has(key)) continue;

        updatedIds.add(key);

        const item = shareItems.find(
          (it) =>
            String(getItemId(it)) === String(result.id) &&
            getItemType(it) === result.type,
        );

        if (item) {
          applyShareToState(item, result);
        }
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
      setShareItem(null);
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
      setShareItem(null);
      return;
    }

    try {
      setIsShareLoading(true);

      const previous = prevPermissions ?? [];
      const current = peopleWithAccess ?? [];

      // Find users whose roles have changed
      const changedUsers = current.filter((person) => {
        if (person.role === "remove" || person.role === "owner") {
          return false;
        }

        const oldPerson = previous.find(
          (p) => String(p.id ?? p._id) === String(person.id ?? person._id),
        );

        return oldPerson && oldPerson.role !== person.role;
      });

      // Find users whose access should be removed
      const removedUsers = current.filter((person) => person.role === "remove");

      if (!changedUsers.length && !removedUsers.length) {
        toast({
          message: "No permission changes found",
          type: "error",
        });
        return;
      }

      const successfulUpdates = new Map();
      const failed = [];

      // Process every selected file/folder
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

        // STEP 1: Update existing user roles
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

        // STEP 2: Remove users
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

      // STEP 3: Update local files and folders
      const updateList = (list) =>
        list.map((resource) => {
          const resourceId = getItemId(resource);
          const resourceType = getItemType(resource);

          const itemKey = `${resourceType}:${resourceId}`;
          const update = successfulUpdates.get(itemKey);

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

              if (!changedUser) return p;

              return {
                ...p,
                role: changedUser.role,
              };
            });

          return {
            ...resource,
            permissions,
          };
        });

      setFilesList(updateList);
      setDirectoriesList(updateList);

      // STEP 4: Update modal permission state only
      // when every operation succeeds.
      if (!failed.length) {
        const updatedPermissions = current.filter((p) => p.role !== "remove");

        setPeopleWithAccess(updatedPermissions);
        setPrevPermissions(updatedPermissions);

        setShareItem(null);

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
    e.preventDefault();

    if (isShareLoading) return;

    if (!selectedUsers.length) {
      toast({
        message: "Please select a person",
        type: "error",
      });
      return;
    }

    if (!shareItems.length) {
      toast({
        message: "No items selected",
        type: "error",
      });
      return;
    }

    try {
      setIsShareLoading(true);

      // Normalize and deduplicate selected files/folders
      const uniqueItems = [
        ...new Map(
          shareItems.map((it) => {
            const id = String(it._id ?? it.id);
            const type = getResourceType(it);

            return [
              `${type}:${id}`,
              {
                id,
                type,
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
      setShareItem(null);
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

  // Copies one link, or all links (one per line) when several items are open
  function handleCopyLink() {
    const text = shareItems.map(getItemUrl).join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({
          message: isMulti
            ? "Links copied to clipboard"
            : "Link copied to clipboard",
          type: "success",
        });
      })
      .catch(() => {});
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  // Single-item mode: apply a link access / role change
  function applyLinkChange(role, access) {
    shareItems.forEach((it) => onClose(it, role, access));
  }

  // Multi mode: apply a link access / role change to ONE item only
  function applyLinkChangeToItem(it, role, access) {
    onClose(it, role, access);
  }

  // Multi mode: open (or toggle) a per-item dropdown. The dropdown is rendered
  // in a portal with position: fixed, so we compute its position from the
  // trigger button's bounding rect. align: "left" | "right" (which trigger edge).
  function openItemDropdown(e, key, align) {
    e.stopPropagation();

    if (itemAccessDropdown === key) {
      setItemAccessDropdown(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const openUp =
      window.innerHeight - rect.bottom < ITEM_DROPDOWN_HEIGHT &&
      rect.top > ITEM_DROPDOWN_HEIGHT;

    setItemDropdownPos({
      originClass:
        ORIGIN_CLASS[`${openUp ? "bottom" : "top"}-${align}`],
      style: {
        position: "fixed",
        top: openUp ? "auto" : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : "auto",
        left: align === "left" ? rect.left : "auto",
        right: align === "right" ? window.innerWidth - rect.right : "auto",
        zIndex: 11000, // above the modal
      },
    });
    setItemAccessDropdown(key);
  }

  // Resolve which item + kind the open multi-mode dropdown belongs to
  const activeItemDropdown = (() => {
    if (!isMulti || !itemAccessDropdown || !itemDropdownPos) return null;

    const sep = itemAccessDropdown.lastIndexOf(":");
    const id = itemAccessDropdown.slice(0, sep);
    const kind = itemAccessDropdown.slice(sep + 1); // "access" | "role"
    const it = shareItems.find((s) => getItemId(s) === id);
    if (!it) return null;

    const publicPermission = getAnyonePermission(it);
    return {
      it,
      kind,
      pub: Boolean(publicPermission),
      role: publicPermission?.role || "reader",
    };
  })();

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
          key={idsKey}
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
                          key={
                            user.id || user.permissionId || user.emailAddress
                          }
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
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    style={{ width: "36px", height: "36px" }}
                    className="gd-icon-btn"
                    onClick={handleCopyLink}
                    title={isMulti ? "Copy links" : "Copy link"}
                  >
                    <IconLink size={20} />
                  </button>
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
                    <button
                      type="button"
                      style={{
                        width: "36px",
                        height: "36px",
                        marginRight: "auto",
                      }}
                      className="gd-icon-btn"
                      onClick={handleCopyLink}
                      title={isMulti ? "Copy links" : "Copy link"}
                    >
                      <IconLink size={20} />
                    </button>
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

                  {/* People with access
                      (multi: only people who have access to ALL selected items) */}
                  <div className="gd-share-section-label">
                    People with access
                  </div>

                  {peopleWithAccess?.length > 0 && (
                    <div className="gd-share-people-list">
                      {[...peopleWithAccess]
                        .sort(
                          (a, b) =>
                            (ROLE_PRIORITY[b.role] ?? 0) -
                            (ROLE_PRIORITY[a.role] ?? 0),
                        )
                        .map((person, idx) => {
                          if (person?.type === "anyone") return null;
                          if (!personRefs.current[idx])
                            personRefs.current[idx] = { current: null };

                          const roleLocked =
                            person.role === "owner" || !canChangeRole;

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
                                  avatar={person?.photoLink || person?.avatar}
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
                                    {person?.pendingOwner && "Pending owner"}
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
                                      disabled={roleLocked}
                                      className={`${person.role === "owner" ? "gd-share-owner-role-btn" : "gd-share-person-role-btn"}`}
                                      aria-disabled={roleLocked}
                                      onClick={(e) => {
                                        if (roleLocked) return;
                                        e.stopPropagation();
                                        setOpenDropdown(
                                          openDropdown === idx ? null : idx,
                                        );
                                      }}
                                      style={{
                                        opacity: !canChangeRole ? 0.5 : 1,
                                        cursor: roleLocked
                                          ? "default"
                                          : "pointer",
                                        pointerEvents: !canChangeRole
                                          ? "none"
                                          : "auto",
                                      }}
                                    >
                                      {ROLE_LABEL[person?.role]}{" "}
                                      {!roleLocked && (
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

                  {/* Link sharing (single item: one shared control) */}
                  {!isMulti && (
                    <>
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
                                        applyLinkChange(linkRole, opt);
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
                                    const driveRole = DRIVE_ROLES[r] ?? r;
                                    setLinkRole(driveRole);
                                    setOpenDropdown(null);
                                    applyLinkChange(driveRole, linkAccess);
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

                  {/* Per-item General access (multi only) — each item is independent */}
                  {isMulti && (
                    <>
                      <div className="gd-share-section-label">
                        General access
                      </div>
                      <div
                        ref={multiAccessRef}
                        style={{
                          margin: "0 24px",
                          maxHeight: 260,
                          overflowY: "auto",
                          display: "flex",
                          flexDirection: "column",
                          gap: 16,
                          // (old paddingBottom: 56 hack removed — the dropdowns
                          // no longer render inside this scroll container)
                          paddingBottom: 8,
                        }}
                      >
                        {shareItems.map((it) => {
                          const id = getItemId(it);
                          const publicPermission = getAnyonePermission(it);
                          const pub = Boolean(publicPermission);
                          const role = publicPermission?.role || "reader";
                          const canShareThis =
                            it?.capabilities?.canShare === true;
                          const accessKey = `${id}:access`;
                          const roleKey = `${id}:role`;
                          // per-item icon (previously used the first item's)
                          const itemIconType = it.isDirectory
                            ? null
                            : getFileKind(item);

                          return (
                            <div key={id}>
                              <div
                                style={{
                                  display: "inline-flex",
                                  maxWidth: "100%",
                                  alignItems: "center",
                                  border:
                                    "1px solid var(--border-color, #dadce0)",
                                  borderRadius: 8,
                                  padding: "4px 12px",
                                  fontSize: 14,
                                }}
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-2 truncate font-medium text-(--text-primary)">
                                  <div className="flex shrink-0 items-center">
                                    {it.isDirectory ? (
                                      <IconFolder
                                        size={18}
                                        style={{
                                          color: "#5f6368",
                                          flexShrink: 0,
                                        }}
                                      />
                                    ) : (
                                      <FileBadge
                                        size={18}
                                        type={itemIconType}
                                      />
                                    )}
                                  </div>

                                  <span className="min-w-0 truncate px-2 text-[14px]">
                                    {it.name}
                                  </span>
                                </div>
                              </div>

                              <div
                                className="gd-share-link-row"
                                style={{ marginTop: 8, position: "relative" }}
                              >
                                <div
                                  className={`gd-share-link-icon ${pub ? "active" : ""}`}
                                >
                                  {pub ? (
                                    <GlobeAmericasIcon className="text-green-900 w-5 h-5" />
                                  ) : (
                                    <LockClosedIcon className="text-black w-5 h-5" />
                                  )}
                                </div>

                                <div className="gd-share-link-info">
                                  <div style={{ position: "relative" }}>
                                    <button
                                      type="button"
                                      className="gd-share-access-btn"
                                      disabled={!canShareThis}
                                      onClick={(e) =>
                                        openItemDropdown(e, accessKey, "left")
                                      }
                                    >
                                      <span>
                                        {pub
                                          ? "Anyone with the link"
                                          : "Restricted"}
                                      </span>
                                      <IconChevronDown size={14} />
                                    </button>
                                  </div>

                                  <div className="gd-share-link-sub">
                                    {pub
                                      ? `Anyone on the internet with the link ${ROLE_DESC[role] ?? ""}`
                                      : "Only people with access can open with this link"}
                                  </div>
                                </div>

                                {pub && (
                                  <div className="gd-share-link-actions">
                                    <div
                                      className="gd-share-link-role-wrap"
                                      style={{ position: "relative" }}
                                    >
                                      <button
                                        type="button"
                                        className="gd-share-role-btn"
                                        disabled={!canShareThis}
                                        onClick={(e) =>
                                          openItemDropdown(e, roleKey, "right")
                                        }
                                      >
                                        {ROLE_LABEL[role]}{" "}
                                        <IconChevronDown size={14} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Portaled dropdown: renders in document.body with
                          position: fixed so the scroll container can't clip it */}
                      {activeItemDropdown &&
                        createPortal(
                          <div
                            ref={itemDropdownRef}
                            className={`gd-share-access-dropdown ${itemDropdownPos.originClass} animate-[sortDropdown_80ms_ease-out]`}
                            style={itemDropdownPos.style}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {activeItemDropdown.kind === "access"
                              ? ["restricted", "anyone"].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    className="gd-share-access-option"
                                    onClick={() => {
                                      setItemAccessDropdown(null);
                                      if (
                                        (opt === "anyone") ===
                                        activeItemDropdown.pub
                                      )
                                        return;
                                      applyLinkChangeToItem(
                                        activeItemDropdown.it,
                                        activeItemDropdown.role,
                                        opt,
                                      );
                                    }}
                                  >
                                    <span className="gd-share-access-check">
                                      {(opt === "anyone") ===
                                        activeItemDropdown.pub && (
                                        <IconCheck size={16} />
                                      )}
                                    </span>
                                    {opt === "anyone"
                                      ? "Anyone with the link"
                                      : "Restricted"}
                                  </button>
                                ))
                              : ["reader", "writer"].map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    className="gd-share-access-option"
                                    onClick={() => {
                                      setItemAccessDropdown(null);
                                      if (r === activeItemDropdown.role) return;
                                      applyLinkChangeToItem(
                                        activeItemDropdown.it,
                                        r,
                                        "anyone",
                                      );
                                    }}
                                  >
                                    <span className="gd-share-access-check">
                                      {r === activeItemDropdown.role && (
                                        <IconCheck size={16} />
                                      )}
                                    </span>
                                    {ROLE_LABEL[r]}
                                  </button>
                                ))}
                          </div>,
                          document.body,
                        )}
                    </>
                  )}

                  {/* Footer */}
                  <div
                    className={`${!showInvitePanel ? "mx-6" : ""} gd-share-footer`}
                  >
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
                          <IconLink size={14} />{" "}
                          {isMulti ? "Copy links" : "Copy link"}
                        </>
                      )}
                    </button>
                    <div className="gd-pending-span">
                      {isChanged && <span>Pending changes</span>}
                    </div>
                    <button
                      className={`gd-btn  ${isShareLoading ? "btn-loading" : "gd-btn-primary"}`}
                      onClick={() =>
                        isMulti
                          ? handleSaveMultiPermissions()
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