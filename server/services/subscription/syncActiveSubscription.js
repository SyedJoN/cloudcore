import Subscription from "../../models/subscription.model.js";
import { PLAN_MAP } from "../../utils/planMap.js";
import { updateUserPlan } from "../../utils/updateUserPlan.js";

export const syncActiveSubscription = async (stripeSub) => {
  const updatedSubscription = await Subscription.findOneAndUpdate(
    { subscriptionId: stripeSub.id },
    {
      billingCycle: stripeSub.items.data[0].plan.interval,
      status: stripeSub.status,
      currentPeriodStart: new Date(
        stripeSub.items.data[0].current_period_start * 1000,
      ),
      currentPeriodEnd: new Date(
        stripeSub.items.data[0].current_period_end * 1000,
      ),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    },
    { returnDocument: "after" },
  );
  if (!updatedSubscription) {
    console.error(`Subscription not found for customer ${stripeSub.customer}`);
    return;
  }
  const userId = updatedSubscription.userId;
  const priceId = stripeSub.items.data[0].price.id;

  const plan = PLAN_MAP[priceId];
  if (!plan) {
    console.error(`Unknown price ID: ${priceId}`);
    return;
  }
  await updateUserPlan(userId, {
    totalStorage: plan.storage,
    uploadLimit: plan.uploadLimit,
    plan: plan.plan,
  });
};
