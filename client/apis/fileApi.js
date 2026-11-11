import { axiosWithCreds, axiosWithoutCreds } from "./axiosInstances";

export async function getSignedUploadUrl(data) {
  const response = await axiosWithCreds.post("/file/uploads/initiate", data);
  return response.data;
}
export async function notifyBackend(fileId) {
  const response = await axiosWithCreds.post(`/file/uploads/complete`, {
    fileId,
  });
  return response;
}
export const uploadDriveFileToS3 = (driveFileId) =>
  axiosWithCreds.post("/file/uploads/google/complete", { driveFileId }, { withCredentials: true });

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

export async function toggleFilePublic(
  itemId,
  role,
  access,
  type,
  confirmCascade = false,
) {
  const { data } = await axiosWithCreds.patch(
    `/file/${itemId}/public/${role}?access=${access}&type=${type}&confirmCascade=${confirmCascade}`,
  );

  return data;
}
export async function toggleDriveFilePermission(
  fileId,
  role,
  confirmCascade = false,
) {
  const { data } = await axiosWithCreds.patch(
    `/file/google-drive/permissions/update`,
    { fileId, role, confirmCascade },
  );

  return data;
}


export async function grantAccessById(
  type,
  fileId,
  usersArray,
  message,
  confirmCascade = false,
  notifyPeople = false,
  items = []
) {
  const isBatch = items.length > 0;

  const url = isBatch
    ? "/file/grant-access"
    : `/file/grant-access/${fileId}`;

  const { data } = await axiosWithCreds.post(url, {
    usersArray,
    message,
    type,
    confirmCascade,
    notifyPeople,
    ...(isBatch && { items }),
  });

  return data;
}
export async function revokeFileAccess(
  type,
  fileId,
  targetId,
  relation,
  confirmCascade = false,
) {
  const { data } = await axiosWithCreds.post(`/file/revoke-access/${fileId}`, {
    targetId,
    relation,
    type,
    confirmCascade,
  });

  return data;
}

export async function getRecentFiles(_id, config = {}) {
  const response = await axiosWithCreds.get(`/file/recent-files`, config); // apna URL rakho
  return response;
}
export async function fetchUserFiles() {
  const { data } = await axiosWithCreds.get(`/file/user-files`);

  return data.users;
}
export async function softDeleteFile(url, ids) {
  const { data } = await axiosWithCreds.patch(url, { ids });
  return data; 
}
export async function deleteFile(url, ids, type) {
  const { data } = await axiosWithCreds.delete(url, {
    data: { ids, type },
  });

  return data;
}
export async function restoreFile(url, ids) {
  const { data } = await axiosWithCreds.patch(url, { ids });
  return data; 
}

export async function updateFileViewTime(id) {
  const response = await axiosWithCreds.patch(`/file/${id}/activity/view`);
  return response;
}
