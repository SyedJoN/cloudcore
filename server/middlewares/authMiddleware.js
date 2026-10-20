import { ObjectId } from "mongodb";
import crypto from "node:crypto";
import User from "../models/user.model.js";
import redisClient from "../config/redis.js";

export async function checkAuth(req, res, next) {
  const sessionId = req.signedCookies.sid;

  if (!sessionId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const session = await redisClient.hGetAll(`session:${sessionId}`);

  if (!session || Object.keys(session).length === 0) {
    res.clearCookie("sid");
    return res.status(401).json({ error: "Session expired or not found" });
  }

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
}
