import mongoose from "mongoose";
import { Schema } from "mongoose";

const webhookSchema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },

    type: {
      type: String,
      required: true,
    },

    processed: {
      type: Boolean,
      default: false,
    },
    processedAt: Date,
    payload: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  },
);
webhookSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days
);
const Webhook = mongoose.model("Webhook", webhookSchema);
export default Webhook;
