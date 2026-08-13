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

      role: relation,
      permissionDetails: isShared
        ? [
            {
              directRole: source === "direct" ? relation : null,

              inheritedRole: source === "parent" ? relation : null,

              inherited: source === "parent",

              inheritedFrom:
                source === "parent"
                  ? {
                      id: inheritedFrom?._id || null,

                      name: inheritedFrom?.name || null,

                      role: relation,
                    }
                  : null,
            },
          ]
        : null,
    };

    permissionMap.set(id, permission);

    return;
  }

  // Direct permission
  if (isShared && source === "direct") {
    permission.permissionDetails[0].directRole = relation;
  }

  // Inherited permission
  if (isShared && source === "parent") {
    const currentPriority = ROLE_PRIORITY[permission.permissionDetails[0].inheritedRole ] || 0;

    const incomingPriority = ROLE_PRIORITY[relation] || 0;

    if (incomingPriority > currentPriority) {
      permission.permissionDetails[0].inheritedRole = relation;

      permission.permissionDetails[0].inheritedFrom = {
        id: inheritedFrom?._id || null,

        name: inheritedFrom?.name || null,

        role: relation,
      };
    }
  }

  // Decide effective role
  let directRole;
  let inheritedRole;
  if (isShared) {
    directRole = permission.directRole;
    inheritedRole = permission.inheritedRole;
  } else {
      directRole = source === "direct" ? relation : null;
  inheritedRole = source === "parent" ? relation : null;
  }

  const directPriority = ROLE_PRIORITY[directRole] || 0;

  const inheritedPriority = ROLE_PRIORITY[inheritedRole] || 0;

  if (directPriority >= inheritedPriority) {
    permission.role = directRole;
  } else {
    permission.role = inheritedRole;
  }
};
