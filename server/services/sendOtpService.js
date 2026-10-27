import nodemailer from "nodemailer";
import crypto from "crypto";
import { RateLimiterRes } from "rate-limiter-flexible";
import redisClient from "../config/redis.js";
import { LIMITERS } from "../config/limiters.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const OTP_TTL = 300; 
const OTP_MINUTES = OTP_TTL / 60;

// purpose = "login" | "register": a code for one purpose can't be used for the other
export const hashOtp = (email, otp, purpose) =>
  crypto
    .createHmac("sha256", process.env.OTP_SECRET)
    .update(`${purpose}:${email}:${otp}`)
    .digest("hex");

export const sendOtpMail = async (rawEmail, purpose) => {
  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return { error: "Valid email is required" };
  }
  const email = rawEmail.trim().toLowerCase();

  const cooldownTtl = await redisClient.ttl(`otp-cooldown:${email}`);
if (cooldownTtl > 0) {
  return {
    error: `Wait ${cooldownTtl} seconds before retrying`,
    rateLimited: true,
    retryAfter: cooldownTtl,
  };
}

  try {
    await LIMITERS.otpSendEmail.consume(email);
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      console.log("OTP send blocked", { email, msBeforeNext: err.msBeforeNext, consumed: err.consumedPoints });
      return {
        error: "Too many OTP requests. Try again later.",
        rateLimited: true,
        retryAfter: Math.ceil(err.msBeforeNext / 1000),
      };
    }
    console.error("OTP limiter error:", err); // store failure: fail open
  }

  const otp = crypto.randomInt(100000, 1000000);
  const key = `otp:${email}`;

  await redisClient
    .multi()
    .del(key) // deletes old otp if any
    .hSet(key, { hash: hashOtp(email, otp, purpose), tries: 0 })
    .expire(key, OTP_TTL)
    .exec();

  try {
    await transporter.sendMail({
      from: "CloudCore <cloudcore@gmail.com>",
      to: email,
      subject: "Your verification code",
      html: `<div style="font-family: sans-serif;"><h2>Your OTP is: ${otp}</h2><p>This OTP is valid for ${OTP_MINUTES} minutes.</p></div>`,
    });
  } catch (err) {
    await redisClient.del(key);
    throw err;
  }

  return { success: true };
};
