import mongoose, { Schema } from "mongoose";
const fileSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      default: 0,
      min: 0,
    },
    parentDirId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    path: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Directory",
        },
      ],
      default: [],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    currentPlan: {
      type: String,
      enum: ["free", "pro", "business"],
      default: "free",
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    publicRole: {
      type: String,
      enum: ["reader", "writer"],
      required: function () {
        return this.isPublic === true;
      },
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isUploading: {
      type: Boolean,
      required: true,
    },
    viewedByMeTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    modifiedTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  },
);
const File = mongoose.model("File", fileSchema);
export default File;