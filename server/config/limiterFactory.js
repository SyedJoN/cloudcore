import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL);

export const createLimiter = ({ points, duration, keyPrefix }) => {
  return new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix,
    points,
    duration,
  });
};