
import Subscription from "../../models/subscription.model.js";
import { PLAN_MAP } from "../../utils/planMap.js";
import { updateUserPlan } from "../../utils/updateUserPlan.js";
import { stripe } from "../stripe/setup.js";

export const assignPaidPlan = async (session) => {
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription,
  );
  const subscriptionId = session.subscription;
  const customerId = subscription.customer;
  const userId = session.metadata.userId;
  const planId = subscription.items.data[0].plan.id;
  const billingCycle = subscription.items.data[0].plan.interval;
  const status = subscription.status;
  const currentPeriodStart = new Date(
    subscription.items.data[0].current_period_start * 1000,
  );
  const currentPeriodEnd = new Date(
    subscription.items.data[0].current_period_end * 1000,
  );
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  await Subscription.findOneAndUpdate(
    {
      userId,
    },
    {
      userId,
      subscriptionId,
      customerId,
      planId,
      billingCycle,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    },
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  const priceId = subscription.items.data[0].price.id;
  const plan = PLAN_MAP[priceId];

  await updateUserPlan(userId, {
    totalStorage: plan.storage,
    uploadLimit: plan.uploadLimit,
    plan: plan.plan,
  });
};
