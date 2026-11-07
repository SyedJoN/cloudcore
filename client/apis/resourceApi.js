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

export async function sendLink(payload) {
  const { data } = await axiosWithCreds.post("/item/send-link", payload);
  return data; 
} 

export async function toggleItemStar(id, type) {
  const response = await axiosWithCreds.patch(
    `/item/${type}/${id}/toggle-star`,
  );
  return response;
}

export async function copyItem({ items, type, providerType }) {
  const { data } = await axiosWithCreds.post(`/items/copy`, {
    items,
    type,
    providerType
  });

  return data;
}
export async function moveItem({ items, destinationId, destinationName }) {
  const { data } = await axiosWithCreds.post(`/items/move`, {
    items,
    destinationId,
    destinationName
  });

  return data.message;
}
