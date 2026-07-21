import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  fetchItemPermissions,
  fetchUserWithFiles,
  getFileById,
  getFileMetaById,
} from "../controllers/file.controller.js";
import { validateSuperAdmin } from "../middlewares/validateRoleMiddleware.js";
import { checkAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ID Validation
router.param("parentDir", validateIdMiddleware);
router.param("id", validateIdMiddleware);


// GET 
router.get("/user-files", checkAuth, validateSuperAdmin, fetchUserWithFiles)
router.get("/:id/meta", getFileMetaById);
router.get("/:id", getFileById);

router.get("/:id/permissions", checkAuth, fetchItemPermissions);


export default router;
