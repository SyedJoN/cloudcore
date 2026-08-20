import mongoose, { Schema } from "mongoose";

const sharedWithSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sharedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    _id: false,
  },
);

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
      ref: "Directory",
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

    publicRole: {
      type: String,
      enum: ["reader", "writer"],
      required: function () {
        return this.isPublic === true;
      },
    },

    sharedWith: {
      type: [sharedWithSchema],
      default: [],
    },

    modifiedTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastModifyingUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    trashedTime: {
      type: Date,
      index: true,
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
