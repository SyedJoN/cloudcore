import { createLimiter } from "./limiterFactory.js";

export const LIMITERS = {
  auth: createLimiter({
    points: 50,
    duration: 600, // 10 min
    keyPrefix: "auth",
  }),
  writeDirOps: createLimiter({
    points: 30,
    duration: 600,
    keyPrefix: "dir:write",
  }),

  readDirOps: createLimiter({
    points: 300,
    duration: 600,
    keyPrefix: "dir:read",
  }),
  writeFileOps: createLimiter({
    points: 30,
    duration: 600,
    keyPrefix: "file:write",
  }),

  readFileOps: createLimiter({
    points: 300,
    duration: 600,
    keyPrefix: "file:read",
  }),

};