import { axiosWithCreds } from "./axiosInstances";

export async function sendLink(
  emailInput,
  message,
  type,
  itemId,
  name,
  url,
  isPublic,
  publicRole,
) {
  const { data } = await axiosWithCreds.post(" /resource/send-link", {
    toEmail: emailInput,
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
