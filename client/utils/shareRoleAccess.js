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

  let response;
  let access;
  if (personsToGrant.length) {
   response = await grantAccessById(
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
    access = "remove"
   response = await Promise.all(
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


  return {
    changed: true,
    itemId,
    access,
    finalPermissions: type.startsWith('google') ? response : response.permissions
  };
};
