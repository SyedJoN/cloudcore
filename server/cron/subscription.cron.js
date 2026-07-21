import cron from "node-cron";
import { stripe } from "../services/stripe/setup.js";
import Subscription from "../models/subscription.model.js";
import { syncActiveSubscription } from "../services/subscription/syncActiveSubscription.js";
import { pauseUploads } from "../services/subscription/pauseUploads.js";
import { downgradeToFreePlan } from "../services/subscription/downgradeToFreePlan.js";
import { resumeUploads } from "../services/subscription/resumeUploads.js";

export const startSubscriptionCron = () => {
  cron.schedule(
    "0 */6 * * *", // Every 6 hours
    async () => {
      console.log("Running subscription reconciliation...");

      const subscriptions = await Subscription.find();

      for (const sub of subscriptions) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(
            sub.subscriptionId,
          );

          switch (stripeSub.status) {
            case "past_due":
            case "incomplete":
              await pauseUploads(stripeSub);
              await syncActiveSubscription(stripeSub);
              break;

            case "active":
              await resumeUploads(stripeSub)
              await syncActiveSubscription(stripeSub);
              break;

            case "canceled":
              await downgradeToFreePlan(stripeSub);
              await syncActiveSubscription(stripeSub);
              break;
          }
        } catch (err) {
          console.error(`Failed to sync ${sub.subscriptionId}:`, err.message);
        }
      }
    },
    {
      timezone: "Asia/Karachi",
    },
  );
};
