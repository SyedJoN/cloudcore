import { axiosWithCreds } from "./axiosInstances";


export async function getRootDirectory() {
  const response = await axiosWithCreds.get(`/directory/`);
  return response;
}
export async function getDirectory(dirId) {
  console.log('dirId', dirId)
  const response = await axiosWithCreds.get(`/directory/${dirId || ""}`);
  return response;
}
export async function getTrash(dirId) {
  const response = await axiosWithCreds.get(`/trash/${dirId || ""}`)
  return response;
}

export async function getGoogleDrive() {
  const response = await axiosWithCreds.get('/auth/google-drive/files');
  return response;
}
export async function getSharedItems() {
    const response = await axiosWithCreds.get(`/shared`);
    return response;
    // return {
    //   ...data,
    //   users: data.users || []
    // }

} 

