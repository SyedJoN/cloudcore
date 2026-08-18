import { ROLE_PRIORITY } from "./getRolePriority.js";

/**
 * Accumulates one user's permission across possibly many merge() calls —
 * one for a direct grant on the item, plus one per ancestor folder it
 * inherits from — into a single entry in `permissionMap`, keyed by user
 * id.
 *
 * `directRole` / `inheritedRole` / `inheritedFrom` are tracked at the top
 * level of the permission object on every call, regardless of `isShared`.
 * That's required for correctness: without persisting them somewhere,
 * there'd be no way to compare a role coming in on *this* call against
 * roles merged in on *earlier* calls, and the result would just be
 * whichever call happened to run last instead of whichever role is
 * actually highest-priority.
 *
 * `permission.role` is always the effective role (best of direct vs
 * inherited, direct winning ties).
 *
 * When `isShared` is true, the same information is *also* exposed as
 * `permissionDetails[0]` — kept for compatibility with whatever already
 * reads that nested shape elsewhere in the app (e.g. the share dialog).
 * It's always derived from the same top-level fields, so the two can't
 * drift apart the way they could before.
 */
export const mergePermission = ({
  permissionMap,
  user,
  relation,
  source,
  inheritedFrom = null,
  isShared = false,
}) => {
  if (!user?._id) {
    return;
  }

  if (!ROLE_PRIORITY[relation]) {
    return;
  }

  const id = user._id.toString();

  let permission = permissionMap.get(id);

  if (!permission) {
    permission = {
      id: user._id,
      photoLink: user.avatar || null,
      displayName: user.name,
      type: "user",
      emailAddress: user.email,
      role: null,
      directRole: null,
      inheritedRole: null,
      inheritedFrom: null,
    };

    permissionMap.set(id, permission);
  }

  if (source === "direct") {
    permission.directRole = relation;
  }

  if (source === "parent") {
    const currentPriority = ROLE_PRIORITY[permission.inheritedRole] || 0;
    const incomingPriority = ROLE_PRIORITY[relation] || 0;

    if (incomingPriority > currentPriority) {
      permission.inheritedRole = relation;
      permission.inheritedFrom = {
        id: inheritedFrom?._id || null,
        name: inheritedFrom?.name || null,
        role: relation,
      };
    }
  }

  const directPriority = ROLE_PRIORITY[permission.directRole] || 0;
  const inheritedPriority = ROLE_PRIORITY[permission.inheritedRole] || 0;
  const directWins = directPriority >= inheritedPriority;

  permission.role = directWins ? permission.directRole : permission.inheritedRole;

  if (isShared) {
    permission.permissionDetails = [
      {
        directRole: permission.directRole,
        inheritedRole: permission.inheritedRole,
        inherited: !directWins,
        inheritedFrom: permission.inheritedFrom,
      },
    ];
  }
};