import { createLimiter } from "./limiterFactory.js";

const MIN = 60;

export const LIMITERS = {
  // global per-IP flood guard
  ipGlobal: createLimiter({
    points: 1000,
    duration: 10 * MIN,
    keyPrefix: "ip:global",
  }),

  // auth
  auth: createLimiter({
    points: 50,
    duration: 10 * MIN,
    keyPrefix: "auth",
  }),

  authAccount: createLimiter({
    points: 10,
    duration: 15 * MIN,
    blockDuration: 15 * MIN,
    keyPrefix: "auth:account",
  }),

  // OTP
  otpSendEmail: createLimiter({
    points: 3,
    duration: 15 * MIN,
    blockDuration: 15 * MIN,
    keyPrefix: "otp:send:email",
  }),
  otpSendIp: createLimiter({
    points: 10,
    duration: 60 * MIN,
    blockDuration: 60 * MIN,
    keyPrefix: "otp:send:ip",
  }),
  otpVerifyEmail: createLimiter({
    points: 10,
    duration: 15 * MIN,
    blockDuration: 15 * MIN,
    keyPrefix: "otp:verify:email",
  }),
  otpVerifyIp: createLimiter({
    points: 30,
    duration: 10 * MIN,
    blockDuration: 10 * MIN,
    keyPrefix: "otp:verify:ip",
  }),

  // email-sending routes
  emailOps: createLimiter({
    points: 5,
    duration: 60 * MIN,
    blockDuration: 60 * MIN,
    keyPrefix: "email",
  }),

  // register
  register: createLimiter({
    points: 10,
    duration: 60 * MIN,
    blockDuration: 60 * MIN,
    keyPrefix: "register",
  }),

  // per-user
  itemRead: createLimiter({
    points: 300,
    duration: 10 * MIN,
    keyPrefix: "item:read",
  }),
  itemWrite: createLimiter({
    points: 30,
    duration: 10 * MIN,
    keyPrefix: "item:write",
  }),
  readDirOps: createLimiter({
    points: 300,
    duration: 10 * MIN,
    keyPrefix: "dir:read",
  }),
  writeDirOps: createLimiter({
    points: 30,
    duration: 10 * MIN,
    keyPrefix: "dir:write",
  }),
  readFileOps: createLimiter({
    points: 300,
    duration: 10 * MIN,
    keyPrefix: "file:read",
  }),
  writeFileOps: createLimiter({
    points: 30,
    duration: 10 * MIN,
    keyPrefix: "file:write",
  }),
};
