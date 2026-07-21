import { axiosWithCreds } from "./axiosInstances";


export async function createSubscription({priceId}) {
  const { data } = await axiosWithCreds.post("/subscription/stripe/create", {priceId});
  return data;
}

export async function fetchPortalUrl() {
  const { data } = await axiosWithCreds.get("/subscription/stripe/my-plans");
  return data.url;
}
