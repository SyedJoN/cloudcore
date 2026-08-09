import mongoose, { Schema } from "mongoose";

const ownershipTransferSchema = new Schema(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "itemType",
    },

    itemType: {
      type: String,
      enum: ["File", "Directory"],
      required: true,
    },

    fromUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    toUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
  },
);
const Ownership = mongoose.model("Ownership", ownershipTransferSchema);
export default Ownership;
