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
export async function uploadDriveFileToS3(fileId, driveFileId) {
  const response = await axiosWithCreds.post(`/file/uploads/google/complete`, {
    fileId,
    driveFileId,
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
  showMessageBox
) {
  const { data } = await axiosWithCreds.post(`/file/grant-access/${fileId}`, {
    usersArray,
    message,
    type,
    confirmCascade,
    showMessageBox
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

export async function getRecentFiles() {
  const response = await axiosWithCreds.get(`/file/recent-files`);
  return response;
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

export async function updateFileViewTime(id) {
  const response = await axiosWithCreds.patch(`/file/${id}/activity/view`);
  return response;
}
