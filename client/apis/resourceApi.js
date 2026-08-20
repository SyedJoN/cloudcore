import { axiosWithCreds } from "./axiosInstances";

export async function sendOwnershipMail({ newOwner, itemId, type }) {
  const { data } = await axiosWithCreds.post(
    "/item/sendMail/transfer-ownership",
    {
      newOwner,
      itemId,
      type,
    },
  );

  return data;
}

export async function cancelPendingOwnership({ newOwner, itemId, type }) {
  const { data } = await axiosWithCreds.post("/item/cancel-pending-ownership", {
    newOwner,
    itemId,
    type
  });

  return data;
}

export async function sendLink({
  toEmail,
  message,
  type,
  id,
  name,
  url,
  isPublic,
  publicRole,
}) {
  const { data } = await axiosWithCreds.post("/item/send-link", {
    toEmail,
    message,
    type,
    id,
    name,
    url,
    isPublic,
    publicRole,
  });

  return data.message;
}

export async function toggleItemStar(id, type) {
  const response = await axiosWithCreds.patch(
    `/item/${type}/${id}/toggle-star`,
  );
  return response;
}

export async function copyItem({ item, type, providerType }) {
  const { data } = await axiosWithCreds.post(`/item/copy`, {
    item,
    type,
    providerType
  });

  return data;
}
export async function moveItem({ item, destinationId, destinationName }) {
  const { data } = await axiosWithCreds.post(`/item/move`, {
    item,
    destinationId,
    destinationName
  });

  return data.message;
}
