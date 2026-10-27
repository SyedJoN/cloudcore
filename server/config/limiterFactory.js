import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import Redis from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL, {
  enableOfflineQueue: false, // fail fast instead of queueing commands
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
  retryStrategy: (times) => Math.min(times * 200, 3000),
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err.message);
});

export const createLimiter = ({ points, duration, blockDuration = 0, keyPrefix }) => {
  return new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix,
    points,
    duration,
    blockDuration,

    // Once a key is over the limit, block it locally without calling Redis
    inMemoryBlockOnConsumed: points + 1,
    inMemoryBlockDuration: blockDuration || duration,

    // If Redis is down or slow, fall back to per-instance memory limiting
    insuranceLimiter: new RateLimiterMemory({ points, duration, blockDuration, keyPrefix }),
  });
};