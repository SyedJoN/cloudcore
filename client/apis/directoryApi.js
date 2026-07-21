import { axiosWithCreds } from "./axiosInstances";


export async function getDirectory(api) {
  const response = await axiosWithCreds.get(api);
  return response;
}
export async function getSharedItems() {

    const { data } = await axiosWithCreds.get(`/directory/shared`);
    return {
      ...data,
      users: data.users || []
    }

} 

