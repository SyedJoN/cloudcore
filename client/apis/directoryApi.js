import { axiosWithCreds } from "./axiosInstances";

export async function getRootDirectory() {
  const response = await axiosWithCreds.get(`/directory/`);
  return response;
}
export async function getDirectory(dirId) {
  console.log("dirId", dirId);
  const response = await axiosWithCreds.get(`/directory/${dirId || ""}`);
  return response;
}
export async function getTrash(dirId) {
  const response = await axiosWithCreds.get(`/trash/${dirId || ""}`);
  return response;
}

export async function getGoogleDrive() {
  const response = await axiosWithCreds.get("/auth/google-drive/files");
  return response;
}
export async function getSharedItems() {
  const response = await axiosWithCreds.get(`/shared`);
  return response;
}
export async function getStarredItems() {
  const response = await axiosWithCreds.get(`/starred`);
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
  const response = await axiosWithCreds.post(`directory/uploads/complete`, {
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
