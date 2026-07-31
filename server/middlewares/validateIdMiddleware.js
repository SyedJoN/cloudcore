import { ObjectId } from "mongodb";

export default function (req, res, next, id) {
  const isMongoId = ObjectId.isValid(id);
  const isGoogleDriveId = /^[A-Za-z0-9_-]{10,}$/.test(id);

  if (!isMongoId && !isGoogleDriveId) {
    return res.status(400).json({
      error: `Invalid ID: ${id}`,
    });
  }

  next();
}