import { axiosWithCreds } from "./axiosInstances";

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
