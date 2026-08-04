import mongoose, { Schema } from "mongoose";

const directorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      default: 0,
      min: 0,
    },
    parentDirId: {
      type: mongoose.Types.ObjectId,
      default: null,
    },
    path: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Directory",
        },
      ],
      default: [],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
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
    publicRole: {
      type: String,
      enum: ["viewer", "editor"],
      required: function () {
        return this.isPublic;
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
  },
  {
    timestamps: true,
    strict: "throw",
  },
);
const Directory = mongoose.model("Directory", directorySchema);
export default Directory;
