export const rateLimitMiddleware = (limiter, getKey) => {
  return async (req, res, next) => {
    const key = getKey ? getKey(req) : req.user?._id?.toString() || req.ip;

    try {
      await limiter.consume(key);
      return next();
    } catch (err) {
      // Real rate-limit rejection
      if (err instanceof RateLimiterRes) {
        res.set("Retry-After", Math.ceil(err.msBeforeNext / 1000));
        return res.status(429).json({ error: "Too many requests" });
      }

      // Store failure (Redis/Mongo down or slow): log it and fail open
      console.error("Rate limiter error:", err);
      return next();
    }
  };
};