import { axiosWithCreds } from "./axiosInstances";

export async function getRootDirectory(_id, config = {}) {
  const response = await axiosWithCreds.get(`/directory/`, config);
  return response;
}

export async function getDirectory(dirId, config = {}) {
  const response = await axiosWithCreds.get(`/directory/${dirId || ""}`, config);
  return response;
}

export async function getTrash(dirId, config = {}) {
  const response = await axiosWithCreds.get(`/trash/${dirId || ""}`, config);
  return response;
}

export async function getGoogleDrive(_id, config = {}) {
  const response = await axiosWithCreds.get("/auth/google-drive/files", config);
  return response;
}

export async function getSharedItems(_id, config = {}) {
  const response = await axiosWithCreds.get(`/shared`, config);
  return response;
}

export async function getStarredItems(_id, config = {}) {
  const response = await axiosWithCreds.get(`/starred`, config);
  return response;
}
export async function initiateFolderUpload(data) {
  const response = await axiosWithCreds.post(
    "directory/uploads/initiate",
    data,
  );
  return response.data;
}
export async function completeFolderUpload(fileId) {
  const response = await axiosWithCreds.post(`/directory/uploads/complete`, {
    fileId,
  });
  return response.data;
}
export async function addDirectory(dirId, newDirName, type) {
  const response = await axiosWithCreds.post(`/directory/${dirId || ""}`, {
    dirName: newDirName,
    type
  });
  return response.data;
}

export async function createGoogleDriveUploadSession({
  name,
  size,
  contentType,
  parentDirId,
}) {
  const { data } = await axiosWithCreds.post(
    "/auth/google-drive/upload-session",
    {
      name,
      size,
      contentType,
      parentDirId,
    },
  );

  return data;
}
