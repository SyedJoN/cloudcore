import mongoose, { Schema } from "mongoose";

const fileActivitySchema = new Schema(
  {
    file: {
      type: Schema.Types.ObjectId,
      ref: "File",
      required: true
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
      enum: ["view", "rename", "move"],
      required: true
    },

    occuredAt: {
      type: Date,
      default: Date.now
    }
  }
);

fileActivitySchema.index(
  { file: 1, user: 1, type: 1 },
  { unique: true }
);

const FileActivity = mongoose.model("FileActivity", fileActivitySchema);

export default FileActivity;