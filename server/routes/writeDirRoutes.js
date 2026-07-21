import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  addDirectory,
  deleteDirectory,
  editDirectory,
  requestAccess,
  restoreDirectory,
  sendLink,
  softDeleteDirectory,
} from "../controllers/directory.controller.js";

const router = express.Router();

// ID Validation
router.param("id", validateIdMiddleware);

// Write
router.route("/{:id}").patch(editDirectory).delete(deleteDirectory);
router.post("/:id/request-access", requestAccess);
router.post("/:id/send-link", sendLink);
router.patch("/:id/restore", restoreDirectory);
router.post("/{:parentDirId}", addDirectory);
router.delete("/soft-delete/:id", softDeleteDirectory);

export default router;
