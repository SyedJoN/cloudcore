import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  addDirectory,
  completeFolderUpload,
  deleteDirectory,
  editDirectory,
  initiateFolderUpload,
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
router.patch("/:id/restore", restoreDirectory);
router.post("/{:parentDirId}", addDirectory);
router.delete("/soft-delete/:id", softDeleteDirectory);

//upload
router.post(
  "/uploads/initiate",
  initiateFolderUpload,
);

router.post(
  "/uploads/complete",
  completeFolderUpload,
);

export default router;
