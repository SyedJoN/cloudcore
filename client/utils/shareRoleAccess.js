export const updateSharedAccess = async ({
  item,
  type,
  peopleWithAccess,
  prevPermissions,
  message,
  grantAccessById,
  revokeFileAccess,
}) => {
  const previousPermissions = prevPermissions ?? [];
  const currentPermissions = peopleWithAccess ?? [];

  /*
   * peopleWithAccess contains the permissions being submitted
   * by the share UI.
   */

  const personsToGrant = currentPermissions.filter(
    (person) => person?.role !== "remove",
  );

  const personsToRemove = currentPermissions.filter(
    (person) => person?.role === "remove",
  );

  /*
   * Nothing changed.
   */
  const equal =
    previousPermissions.length === currentPermissions.length &&
    previousPermissions.every((prev) =>
      currentPermissions.some(
        (person) =>
          String(person?.id) === String(prev?.id) &&
          person?.role === prev?.role,
      ),
    );

  if (equal) {
    return {
      changed: false,
      permissions: previousPermissions,
    };
  }

  const itemId = String(item?._id ?? item?.id);

  /*
   * Apply grants / role changes.
   */
  if (personsToGrant.length) {
    await grantAccessById(
      type,
      itemId,
      personsToGrant,
      message,
    );
  }

  /*
   * Apply removals.
   */
  if (personsToRemove.length) {
    await Promise.all(
      personsToRemove.map((person) =>
        revokeFileAccess(
          type,
          itemId,
          person.id,
          person.role,
        ),
      ),
    );
  }

  /*
   * IMPORTANT:
   *
   * Start with ALL existing permissions.
   * Then replace only the users that were submitted.
   */
  const updatedPermissionMap = new Map(
    previousPermissions.map((permission) => [
      String(permission?.id),
      permission,
    ]),
  );

  /*
   * Update / add granted users.
   */
  for (const person of personsToGrant) {
    updatedPermissionMap.set(
      String(person?.id),
      person,
    );
  }

  /*
   * Remove users that were explicitly removed.
   */
  for (const person of personsToRemove) {
    updatedPermissionMap.delete(
      String(person?.id),
    );
  }

  const finalPermissions = Array.from(
    updatedPermissionMap.values(),
  );

  return {
    changed: true,
    itemId,

    // THIS IS NOW THE FULL PERMISSION ARRAY
    permissions: finalPermissions,

    granted: personsToGrant,

    removed: personsToRemove,
  };
};
