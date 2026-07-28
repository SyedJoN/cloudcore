// utils/googleDriveClient.js
import { google } from "googleapis";

export const getDriveClient = (accessToken) => {
  const auth = new google.auth.OAuth2();

  auth.setCredentials({
    access_token: accessToken,
  });

  return google.drive({
    version: "v3",
    auth,
  });
};