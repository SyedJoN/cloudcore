export const updateSharedAccess = async ({
  item,
  type,
  peopleWithAccess,
  prevPermissions,
  message,
  grantAccessById,
  revokeFileAccess,
  confirmCascade
}) => {
  const previousPermissions = prevPermissions ?? [];
  const currentPermissions = peopleWithAccess ?? [];

  const personsToGrant = currentPermissions.filter(
    (person) => person?.role !== "remove" && person.role !== "owner",
  );

  const personsToRemove = currentPermissions.filter(
    (person) => person?.role === "remove",
  );



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


  let response;
  let access;
  if (personsToGrant.length) {
    
   response = await grantAccessById(
      type,
      itemId,
      personsToGrant,
      message,
      confirmCascade
    );
  }


  if (personsToRemove.length) {
    access = "remove"
   response = await Promise.all(
      personsToRemove.map((person) =>
        revokeFileAccess(
          type,
          itemId,
          person.id,
          person.role,
          confirmCascade
        ),
      ),
    );
  }


  return {
    changed: true,
    itemId,
    access,
    response: response.length ? response[0] : response
  };
};
