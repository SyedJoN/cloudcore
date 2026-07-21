import { useNavigate } from "react-router-dom";
import { axiosWithCreds, axiosWithoutCreds } from "./axiosInstances";

export async function registerUser(formData) {
  const response = await axiosWithoutCreds.post("/auth/register", formData);
  return response;
}
export async function loginUser(formData) {
  const response = await axiosWithCreds.post("/auth/login", formData);
  return response;
}
export async function logoutUser() {
  const response = await axiosWithCreds.post("/auth/logout");
  return response;
}
export async function logoutAll() {
  const response = await axiosWithCreds.post("/auth/logout-all");
  return response;
}
export async function sendOtp(email) {
  const response = await axiosWithoutCreds.post("/auth/send-otp", email);
  return response;
}
export async function verifyOtp(data) {
  const response = await axiosWithCreds.post("/auth/verify-otp", data);
  return response;
}
export async function fetchUserDetails(token) {
  const response = await axiosWithCreds.post("/auth/google/callback", {
    token,
  });
  return response;
}
export async function googleDriveCheck() {
  const response = axiosWithCreds.get(`/auth/google-drive/check`);
  return response;
}
