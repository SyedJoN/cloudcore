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
router.patch(["/soft-delete", "/soft-delete/:id"], softDeleteDirectory);
router.post("/:id/request-access", requestAccess);
router.patch(["/restore", "/:id/restore"], restoreDirectory);

//upload
router.post("/uploads/initiate", initiateFolderUpload);

router.post("/uploads/complete", completeFolderUpload);

router.route("/{:id}").patch(editDirectory).delete(deleteDirectory);
router.post("/{:parentDirId}", addDirectory);

export default router;
