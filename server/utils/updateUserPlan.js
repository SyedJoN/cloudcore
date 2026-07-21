import redisClient from "../config/redis.js";
import User from "../models/user.model.js";

export const updateUserPlan = async (userId, data) => {
  await User.findByIdAndUpdate(userId, data);

  const userSessions = await redisClient.ft.search(
    "userIdIdx",
    `@userId:{${userId}}`,
    { RETURN: [] }
  );

  for (const doc of userSessions.documents) {
    await redisClient.hSet(doc.id, data);
  }
};