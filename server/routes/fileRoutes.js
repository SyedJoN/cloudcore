import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  deleteFile,
  fetchItemPermissions,
  fetchUserWithFiles,
  getFileById,
  getFileMetaById,
  giveAccessById,
  restoreFile,
  revokeFileAccess,
  softDeleteFile,
  toggleFilePublic,
  updateFile,
  uploadFile,
} from "../controllers/file.controller.js";
import { validateSuperAdmin } from "../middlewares/validateRoleMiddleware.js";
import { checkAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ID Validation
router.param("parentDir", validateIdMiddleware);
router.param("id", validateIdMiddleware);

// Create
router.post("/{:parentDirId}", checkAuth, uploadFile);
router.post("/grant-access/:id", checkAuth, giveAccessById);


// GET + DELETE
router.get("/user-files", checkAuth, validateSuperAdmin, fetchUserWithFiles)
router.get("/:id/meta", getFileMetaById);
router.get("/:id", getFileById);
router.delete("/:id", checkAuth, deleteFile);
router.delete("/soft-delete/:id", checkAuth, softDeleteFile);

// Update
router.patch("/:id/restore", checkAuth, restoreFile);
router.patch("/:id/:newFilename", checkAuth, updateFile);
router.patch("/:itemId/public/:role", checkAuth, toggleFilePublic);

// Shareble file
router.post("/grant-access/:id", checkAuth, giveAccessById);
router.post("/revoke-access/:id", checkAuth, revokeFileAccess);
router.get("/:id/permissions", checkAuth, fetchItemPermissions);


export default router;
