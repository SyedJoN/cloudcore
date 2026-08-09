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
    isPublic: {
      type: Boolean,
      default: false,
    },
    transfer: {
      fromUser: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      toUser: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "cancelled"],
        default: "pending",
      },
      expiresAt: {
        type: Date,
      },
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
      enum: ["reader", "writer"],
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
