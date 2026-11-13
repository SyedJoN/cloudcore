import mongoose, { Schema } from "mongoose";

const fileActivitySchema = new Schema({
  file: {
    type: Schema.Types.ObjectId,
    // was ref: "File". refPath lets folder ids work too.
    // itemModel defaults to "File", so old docs behave exactly as before.
    refPath: "itemModel",
    required: true,
  },

  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // original enum, unchanged
  type: {
    type: String,
    enum: ["view", "rename", "move"],
    required: true,
  },

  occuredAt: {
    type: Date,
    default: Date.now,
  },

  // ---- NEW fields ----

  // "file" or "folder" (folders are tracked in the `file` field too)
  itemType: {
    type: String,
    enum: ["file", "folder"],
    default: "file",
  },

  // used by refPath above
  itemModel: {
    type: String,
    enum: ["File", "Directory"],
    default: "File",
  },

  // total opens
  viewCount: {
    type: Number,
    default: 0,
  },

  // last 20 view timestamps, used for the "frequent" score
  recentViews: {
    type: [Date],
    default: [],
  },
});

// original index, unchanged
fileActivitySchema.index({ file: 1, user: 1, type: 1 }, { unique: true });

// NEW: fast suggestions query
fileActivitySchema.index({ user: 1, type: 1, occuredAt: -1 });

const FileActivity = mongoose.model("FileActivity", fileActivitySchema);

export default FileActivity;