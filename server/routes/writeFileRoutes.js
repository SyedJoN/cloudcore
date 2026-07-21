import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  deleteFile,
  generateSignedUploadUrl,
  giveAccessById,
  restoreFile,
  revokeFileAccess,
  softDeleteFile,
  toggleFilePublic,
  updateFile,
  completeUpload,
} from "../controllers/file.controller.js";

import { checkAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ID Validation
router.param("parentDir", validateIdMiddleware);
router.param("id", validateIdMiddleware);


// DELETE
router.delete("/:id", checkAuth, deleteFile);
router.delete("/soft-delete/:id", checkAuth, softDeleteFile);

// Update
router.patch("/:id/restore", checkAuth, restoreFile);
router.patch("/:id", checkAuth, updateFile);
router.patch("/:itemId/public/:role", checkAuth, toggleFilePublic);

// Shareble file
router.post("/grant-access/:id", checkAuth, giveAccessById);
router.post("/revoke-access/:id", checkAuth, revokeFileAccess);


// Upload
router.post("/uploads/initiate", checkAuth, generateSignedUploadUrl);
router.post("/uploads/complete", checkAuth, completeUpload);


export default router;
