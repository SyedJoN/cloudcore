import express from "express";
import { checkAuth } from "../middlewares/authMiddleware.js";
import { checkDriveAuth, downloadGoogleDriveFiles, fetchGoogleDriveFiles, githubAuth, googleAuth, googleDrive, loginUser, logoutAll, logoutUser, registerUser, sendOtp, verifyOtp, viewGoogleDriveFile } from "../controllers/auth.controller.js";

const router = express.Router();

// Create
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Logout
router.post("/logout", logoutUser);
router.post("/logout-all", checkAuth, logoutAll);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/google/callback", googleAuth);
router.get("/google-drive/callback", googleDrive);
router.get("/google-drive/check", checkDriveAuth);
router.get("/github/callback", githubAuth);
router.get("/google-drive/files", fetchGoogleDriveFiles);
router.get("/google-drive/view", viewGoogleDriveFile);
router.get("/google-drive/download", downloadGoogleDriveFiles);
export default router;
