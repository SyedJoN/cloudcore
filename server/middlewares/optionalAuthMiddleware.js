import redisClient from "../config/redis.js";

// optionalAuth.js
export const optionalAuth = async (req, res, next) => {
  try {
    const sessionId = req.signedCookies?.sid;
    if (!sessionId) return next();
    const session = await redisClient.hGetAll(`session:${sessionId}`);

    if (!session || Object.keys(session).length === 0) return next();
    req.user = {
      _id: session.userId,
      parentDirId: session.parentDirId || null,
      name: session.name,
      email: session.email,
      picture: session.picture,
      role: session.role,
      uploadLimit: session.uploadLimit,
      plan: session.plan,
      totalStorage: session.totalStorage,
    };
    next();
  } catch {
    next();
  }
};
