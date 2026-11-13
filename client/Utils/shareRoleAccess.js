
export const updateSharedAccess = async ({
  item,
  type,
  peopleWithAccess,
  prevPermissions,
  message,
  grantAccessById,
  revokeFileAccess,
  confirmCascade,
  notifyPeople,
}) => {

  const previousPermissions = prevPermissions ?? [];
  const currentPermissions = peopleWithAccess ?? [];

  const personsToGrant = currentPermissions.filter(
    (person) =>
      person?.role !== "remove" &&
      person?.role !== "owner"
  );

  const personsToRemove = currentPermissions.filter(
    (person) => person?.role === "remove"
  );

  const equal =
    previousPermissions.length === currentPermissions.length &&
    previousPermissions.every((prev) =>
      currentPermissions.some(
        (person) =>
          String(person?.id) === String(prev?.id) &&
          person?.role === prev?.role
      )
    );

  if (equal) {
    return {
      changed: false,
      permissions: previousPermissions,
    };
  }

  const itemId = String(item?._id ?? item?.id);

  let grantResponse = null;
  let revokeResponses = [];

  // STEP 1: Grant / update permissions
  if (personsToGrant.length) {
    grantResponse = await grantAccessById(
      type,
      itemId,
      personsToGrant,
      message,
      confirmCascade,
      notifyPeople
    );
  }

  // STEP 2: Revoke permissions
  if (personsToRemove.length) {
    revokeResponses = await Promise.all(
      personsToRemove.map((person) =>
        revokeFileAccess(
          type,
          itemId,
          person.id,
          person.role,
          confirmCascade
        )
      )
    );
  }

 const allResponses = [
  ...(grantResponse ? [grantResponse] : []),
  ...revokeResponses,
];

const confirmationResponse = allResponses.find(
  (r) => r?.needsConfirmation
);


return {
  changed: true,
  itemId,
  grantResponse,
  revokeResponses,
  responses: allResponses,
  response: confirmationResponse || grantResponse || revokeResponses[0] || null,
};
};
