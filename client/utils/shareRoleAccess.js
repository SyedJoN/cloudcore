

export const updateSharedAccess = async ({
  item,
  type,
  peopleWithAccess,
  prevPermissions,
  message,
  grantAccessById,
  revokeFileAccess,
}) => {

  const equal =
    prevPermissions?.length === peopleWithAccess?.length &&
    prevPermissions?.every(
      (prev) =>
        peopleWithAccess?.some(
          (person) =>
            String(person.id) === String(prev.id) &&
            person.role === prev.role,
        ),
    );


  if (equal) {
    return {
      changed: false,
      permissions: prevPermissions,
    };
  }

  const itemId = String(item?._id ?? item?.id);


  const personsToGrant = peopleWithAccess.filter(
    (person) => person.role !== "remove",
  );


  const personsToRemove = peopleWithAccess.filter(
    (person) => person.role === "remove",
  );


  if (personsToGrant.length) {
    await grantAccessById(
      type,
      itemId,
      personsToGrant,
      message,
    );
  }

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

  return {
    changed: true,
    itemId,
    permissions: personsToGrant,
    granted: personsToGrant,
    removed: personsToRemove,
  };
};

