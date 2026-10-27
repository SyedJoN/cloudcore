import express from "express";
import { checkAuth } from "../middlewares/authMiddleware.js";
import {
  checkDriveAuth,
  downloadGoogleDriveFiles,
  fetchGoogleDriveFiles,
  githubAuth,
  googleAuth,
  googleDrive,
  loginUser,
  logoutAll,
  logoutUser,
  registerUser,
  sendOtp,
  verifyOtp,
  viewGoogleDriveFile,
} from "../controllers/auth.controller.js";
import { rateLimitMiddleware } from "../middlewares/rateLimitMiddleware.js";
import { LIMITERS } from "../config/limiters.js";

const router = express.Router();

// Create
router.post(
  "/register",
  rateLimitMiddleware(LIMITERS.register, (req) => req.ip),
  registerUser,
);

// Login
router.post("/login", loginUser);

// Logout
router.post("/logout", logoutUser);
router.post("/logout-all", checkAuth, logoutAll);
router.post(
  "/send-otp",
  rateLimitMiddleware(LIMITERS.otpSendIp, (req) => req.ip),
  sendOtp,
);
router.post(
  "/verify-otp",
  rateLimitMiddleware(LIMITERS.otpVerifyIp, (req) => req.ip),
  verifyOtp,
);
router.post("/google/callback", googleAuth);
router.get("/google-drive/callback", googleDrive);
router.get("/google-drive/check", checkDriveAuth);
router.get("/github/callback", githubAuth);
router.get("/google-drive/files", fetchGoogleDriveFiles);
router.get("/google-drive/view", viewGoogleDriveFile);
router.get("/google-drive/download", downloadGoogleDriveFiles);
export default router;
