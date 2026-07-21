import nodemailer from "nodemailer";
import OTP from "../models/otp.model.js";
import crypto from "crypto";
import redisClient from "../config/redis.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOtpMail = async function (email) {
  if (!email) return { error: "Email is required but missing" };
  if (typeof email !== "string") {
    return { error: "Email must be of type string" };
  }
  try {
    // const otp = Math.floor(1000 + Math.random() * 9000);
    const otp = crypto.randomInt(1000, 10000);
    await redisClient.set(
  `otp:${email}`,
  otp,
  { EX: 300 } // 5 min expiry
);
    await OTP.findOneAndUpdate(
      { email },
      { $set: { otp, expires: new Date(Date.now() + 60 * 1000), tries: 0 } },
      { upsert: true, returnDocument: "after" },
    );
    const info = await transporter.sendMail({
      from: "StorageApp <storageApp@gmail.com>",
      to: email,
      subject: "Greetings!",
      html: `<div style="font-family: sans-serif;"><h2>Your OTP is: ${otp}</h2><p>This OTP is valid for 10 minutes.</p></div>`,
    });
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    throw error;
  }
};
