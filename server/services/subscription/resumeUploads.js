import Subscription from "../../models/subscription.model.js";
import { PLAN_MAP } from "../../utils/planMap.js";
import { updateUserPlan } from "../../utils/updateUserPlan.js";

export const resumeUploads = async (stripeSub) => {
  const subscription = await Subscription.findOne({
    subscriptionId: stripeSub.id,
  });
  if (!subscription) {
    console.error(`Subscription not found for customer ${stripeSub.customer}`);
    return;
  }
  const userId = subscription.userId;
  const uploadLimit = PLAN_MAP[subscription.planId].uploadLimit;
  await updateUserPlan(userId, {
    uploadLimit,
  });
};
