import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    subscriptionId: {
      type: String,
      required: true
    },
    planId: {
      type: String,
      required: true,
    },
    customerId: {
      type: String,
      required: true
    },
    billingCycle: {
      type: String,
      enum: ["month", "year"],
    },
    status: {
      type: String,
      enum: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
      required: true,
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;
