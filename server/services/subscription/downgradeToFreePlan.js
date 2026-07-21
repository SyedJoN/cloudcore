import Subscription from "../../models/subscription.model.js";
import { PLAN_MAP } from "../../utils/planMap.js";
import { updateUserPlan } from "../../utils/updateUserPlan.js";

export const downgradeToFreePlan = async (stripeSub) => {
  const dbSubscription = await Subscription.findOne({
    subscriptionId: stripeSub.id,
  });
  const userId = dbSubscription.userId;
  await dbSubscription.deleteOne();
  const plan = PLAN_MAP["STARTER"];

  await updateUserPlan(userId, {
    totalStorage: plan.storage,
    uploadLimit: plan.uploadLimit,
    plan: plan.plan,
  });
};
