import { axiosWithCreds } from "./axiosInstances";

export async function getCurrentUser(setServerError = "") {
  const { data } = await axiosWithCreds.get("/user/current-user");
  return data;
}

export async function updateUser(editedUser) {
  const { data } = await axiosWithCreds.patch("/user", editedUser);
  return data;
}

export async function fetchUsers() {
  const { data } = await axiosWithCreds.get("/user");
  return data;
}

export async function searchUsers(userId) {
  const { data } = await axiosWithCreds.patch(`/user/search/${userId}`);
  return data;
}

export async function revokeUser(userId) {
  const { data } = await axiosWithCreds.post(`/user/${userId}/revoke`);
  return data;
}

export async function softDeleteUser(userId) {
  const { data } = await axiosWithCreds.delete(`/user/${userId}/soft-delete`);
  return data;
}

export async function deleteUserFromDB(userId) {
  const { data } = await axiosWithCreds.delete(`/user/${userId}/delete`);
  return data;
}

export async function recoverUser(userId) {
  const { data } = await axiosWithCreds.patch(`/user/${userId}/recover`);
  return data;
}
