import { ROLE_PRIORITY } from "./getRolePriority.js";

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