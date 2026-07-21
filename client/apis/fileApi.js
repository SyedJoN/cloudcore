import { axiosWithCreds, axiosWithoutCreds } from "./axiosInstances";

export async function getSignedUploadUrl(data) {
  const response = await axiosWithCreds.post("file/uploads/initiate", data);
  return response.data;
}
export async function notifyBackend(fileId) {
  const response = await axiosWithCreds.post(`/file/uploads/complete`, {
    fileId,
  });
  return response;
}

export async function fetchFilePermissions(fileId, type) {
  const { data } = await axiosWithCreds.get(
    `/file/${fileId}/permissions?type=${type}`,
  );

  return {
    ...data,
    users: data.users || [],
  };
}

export async function getFileByMetaId(fileId) {
  const { data } = await axiosWithCreds.get(`/file/${fileId}/meta`);

  return data;
}

export async function toggleFilePublic(itemId, role, access, type) {
  const { data } = await axiosWithCreds.patch(
    `/file/${itemId}/public/${role}?access=${access}&type=${type}`,
  );

  return data.message;
}

export async function grantAccessById(type, fileId, usersArray, message) {
  const { data } = await axiosWithCreds.post(`/file/grant-access/${fileId}`, {
    usersArray,
    message,
    type,
  });

  return data.message;
}

export async function revokeFileAccess(type, fileId, userId, relation) {
  const { data } = await axiosWithCreds.post(`/file/revoke-access/${fileId}`, {
    userId,
    relation,
    type,
  });

  return data.message;
}


export async function fetchUserFiles() {
  const { data } = await axiosWithCreds.get(`/file/user-files`);

  return data.users;
}
export async function softDeleteFile(url) {
  const response = await axiosWithCreds.delete(url);
  return response;
}
export async function deleteFile(url) {
  const response = await axiosWithCreds.delete(url);
  return response;
}
export async function restoreFile(url) {
  const response = await axiosWithCreds.patch(url);
  return response;
}
