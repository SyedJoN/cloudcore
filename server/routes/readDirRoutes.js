import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  downloadFolder,
  getDirectory,
  getDownloadProgress,
  getTrashItems,
} from "../controllers/directory.controller.js";
import { optionalAuth } from "../middlewares/optionalAuthMiddleware.js";

const router = express.Router();

// ID Validation
router.param("id", validateIdMiddleware);

// Read
router.get("/{:id}", optionalAuth, getDirectory);
router.get("/{:id}/download", downloadFolder);
router.get(
  "/download-progress/:jobId",
  getDownloadProgress,
);


export default router;
