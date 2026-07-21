import Subscription from "../../models/subscription.model.js";
import { updateUserPlan } from "../../utils/updateUserPlan.js";

export const pauseUploads = async (stripeSub) => {
  const subscription = await Subscription.findOne({
    subscriptionId: stripeSub.id,
  });
  if (!subscription) {
    console.error(`Subscription not found for customer ${stripeSub.customer}`);
    return;
  }

  const userId = subscription.userId;

  await updateUserPlan(userId, {
    uploadLimit: 0,
  });
};
