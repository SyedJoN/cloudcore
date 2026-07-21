import express from "express";
import {
  deleteUser,
  searchUsers,
  fetchUsers,
  recoverUser,
  revokeUser,
  softDelete,
  updateUser,
} from "../controllers/user.controller.js";
import { checkAuth } from "../middlewares/authMiddleware.js";
import { getCurrentUser } from "../controllers/user.controller.js";
import {
  validateAdmin,
  validateManager,
} from "../middlewares/validateRoleMiddleware.js";

const router = express.Router();

// Get current user
router.get("/current-user", getCurrentUser);

// Get current user
router.patch("/", validateAdmin, updateUser);
router.get("/", validateManager, fetchUsers);
router.patch("/search/:userId", searchUsers);
router.post("/:userId/revoke", validateManager, revokeUser);
router.delete("/:userId/delete", validateAdmin, deleteUser);
router.patch("/:userId/recover", validateManager, recoverUser);
router.delete("/:userId/soft-delete", validateManager, softDelete);

export default router;
