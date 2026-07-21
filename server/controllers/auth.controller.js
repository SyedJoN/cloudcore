import User from "../models/user.model.js";
import Directory from "../models/directory.model.js";
import mongoose, { Types } from "mongoose";
import { sendOtpMail } from "../services/sendOtpService.js";
import OTP from "../models/otp.model.js";
import {
  fetchTokenForDrive,
  fetchUserUsingIdToken,
} from "../services/googleAuthService.js";
import { fetchGithubUser } from "../services/githubAuthService.js";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fgaClient } from "../services/openFGAService.js";
import redisClient from "../config/redis.js";
import {
  loginSchema,
  OTPSchema,
  registerSchema,
} from "../validators/authSchema.js";
import z from "zod";
import { sanitizeText } from "../utils/sanitizeText.js";
import Subscription from "../models/subscription.model.js";

let MAX_TRIES = 2;

export const registerUser = async (req, res, next) => {
  const { success, data, error } = registerSchema.safeParse(req.body);

  if (!success) {
    console.log(z.flattenError(error).fieldErrors);
    return res.status(400).json({
      error:
        error.issues.map((i) => i.message) ||
        "Invalid input, please enter valid details",
    });
  }
  const { name, email, password } = data;

  const session = await mongoose.startSession();

  try {
    if (
      ![email, name, password].every((v) => typeof v === "string" && v.trim())
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const safeName = sanitizeText(name);
    const safeEmail = sanitizeText(email);
    const existingUser = await User.findOne({ email: safeEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    const otp = await OTP.findOne({ email: safeEmail });
    if (!otp) {
      return res.status(404).json({
        message: "OTP is expired or not found",
      });
    }
    const verified = await redisClient.get(`verified:${safeEmail}`);

    if (!verified) {
      return res.status(403).json({ message: "OTP not verified" });
    }

    await session.withTransaction(async () => {
      const userId = new Types.ObjectId();
      const dirId = new Types.ObjectId();

      await Directory.create(
        [
          {
            _id: dirId,
            name: `root-${safeEmail}`,
            parentDirId: null,
            userId,
          },
        ],
        { session },
      );

      await User.create(
        [
          {
            _id: userId,
            name: safeName,
            email: safeEmail,
            password,
            provider: "local",
            parentDirId: dirId,
          },
        ],
        { session },
      );

      await fgaClient.write({
        writes: [
          {
            user: `user:${userId}`,
            relation: "owner",
            object: `folder:${dirId}`,
          },
        ],
      });
    });

    await redisClient.del(`verified:${safeEmail}`);
    await otp.deleteOne();
    return res.status(201).json({ message: "User Registered" });
  } catch (error) {
    console.log("FULL ERROR:", error);

    console.log("error.errors", error.errors);
    // Mongoose validation error
    if (error?.name === "ValidationError" && error?.errors) {
      const msg = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");

      return res.status(400).json({ message: msg });
    }

    // MongoDB schema validation
    if (error?.code === 121) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    // Duplicate key
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Duplicate entry" });
    }

    // fallback
    return res.status(500).json({
      message: error?.message || "Internal Server Error",
    });
  } finally {
    session.endSession();
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { success, data, error } = loginSchema.safeParse(req.body);

    if (!success) {
      console.log(z.flattenError(error).fieldErrors);

      return res.status(400).json({
        error:
          error.issues.map((i) => i.message) ||
          "Invalid input, please enter valid details",
      });
    }
    const { email, password } = data;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }
    if (user.isDeleted)
      return res.status(403).json({
        message: "Account deleted. To recover, contact owner.",
        code: "ACCOUNT_DELETED",
      });
    if (user.cooldown && user.cooldown > new Date()) {
      const remaining = Math.ceil(
        (user.cooldown.getTime() - Date.now()) / 1000,
      );

      return res.status(429).json({
        message: `Wait ${remaining} seconds before retrying`,
        cause: "cooldown",
        timeLeft: remaining,
      });
    }
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(409).json({ message: "Invalid credentials" });
    }
    const mail = await sendOtpMail(email);
    if (mail.error) {
      return res.status(409).json({ message: mail.error });
    }
    return res
      .status(200)
      .json({ success: true, message: "Login process iniated, verify" });
  } catch (error) {
    next(error);
  }
};
export const logoutUser = async (req, res, next) => {
  try {
    const sessionId = req.signedCookies.sid;
    if (!sessionId) {
      return res.status(401).json({ message: "User not logged in!" });
    }

    const redisKey = `session:${sessionId}`;
    await redisClient.del(redisKey);
    // clearing cookie
    res.clearCookie("sid", {
      httpOnly: true,
      signed: true,
    });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};
export const logoutAll = async (req, res, next) => {
  try {
    const sessionId = req.signedCookies.sid;
    const user = req.user;
    if (!sessionId) {
      return res.status(401).json({ message: "User not logged in!" });
    }

    const userSessions = await redisClient.ft.search(
      "userIdIdx",
      `@userId:{${user._id}}`,
      {
        RETURN: [],
      },
    );
    for (const doc of userSessions.documents) {
      await redisClient.del(doc.id);
    }

    // clearing cookie
    res.clearCookie("sid", {
      httpOnly: true,
      signed: true,
    });
    return res
      .status(200)
      .json({ message: "Logged out from all devices successfully" });
  } catch (error) {
    next(error);
  }
};

export const sendOtp = async (req, res, next) => {
  try {
    const { email, caller } = req.body;
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ message: "email should not be empty" });
    }
    if (caller === "register") {
      const ttl = await redisClient.ttl(`cooldown:${email}`);

      if (ttl > 0) {
        return res.status(429).json({
          message: `Wait ${ttl} seconds before retrying`,
          cause: "cooldown",
          timeLeft: ttl,
        });
      }
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(409)
          .json({ cause: "duplicate_email", message: "Email already exists!" });
      }
    }
    // const otp = Math.floor(1000 + Math.random() * 9000);
    await sendOtpMail(email);
    return res.status(201).json({ message: "OTP sent successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ cause: "smtp_failed", message: "Failed to send OTP" });
  }
};
export const verifyOtp = async (req, res, next) => {
  const { success, data, error } = OTPSchema.safeParse(req.body);

  if (!success) {
    console.log(z.flattenError(error).fieldErrors);

    return res
      .status(400)
      .json({ message: "Invalid input, please enter valid details" });
  }
  const { email, otp, caller } = data;

  try {
    const otpDoc = await OTP.findOne({ email });

    if (!otpDoc) {
      return res.status(401).json({
        cause: "otp_expiry",
        message: "Invalid or expired OTP.",
      });
    }

    if (otpDoc.expires.getTime() < Date.now()) {
      await otpDoc.deleteOne();

      return res.status(401).json({
        cause: "otp_expiry",
        message: "OTP expired",
      });
    }

    // -------------------------
    // WRONG OTP CASE
    // -------------------------
    if (otpDoc.otp !== Number(otp)) {
      const nextTries = otpDoc.tries + 1;

      await OTP.updateOne({ _id: otpDoc._id }, { $inc: { tries: 1 } });

      const triesLeft = MAX_TRIES - nextTries;

      // OTP LIMIT REACHED
      if (nextTries >= MAX_TRIES) {
        if (caller === "login") {
          await User.updateOne(
            { email },
            {
              $set: {
                cooldown: new Date(Date.now() + 60 * 1000),
              },
            },
          );
        } else {
          await redisClient.set(`cooldown:${email}`, "1", {
            EX: 60,
          });
        }

        await otpDoc.deleteOne();

        return res.status(429).json({
          cause: "otp_limit",
          message: "OTP max limit reached",
          timeLeft: 60,
        });
      }

      return res.status(409).json({
        cause: "otp_verification",
        message: `Invalid OTP. You have ${
          triesLeft === 1 ? "1 final" : triesLeft
        } tries left to enter valid OTP`,
      });
    }

    // -------------------------
    // SUCCESS CASE
    // -------------------------
    if (caller === "login") {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const userSessions = await redisClient.ft.search(
        "userIdIdx",
        `@userId:{${user._id}}`,
        { RETURN: [] },
      );

      if (userSessions.total >= 2) {
        await redisClient.del(userSessions.documents[0].id);
      }

      const sessionId = crypto.randomUUID();
      const redisKey = `session:${sessionId}`;
      await redisClient.hSet(redisKey, {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        picture: user.avatar || "",
        role: user.role,
        plan: user.plan,
        uploadLimit: user.uploadLimit,
        totalStorage: user.totalStorage,
        parentDirId: user.parentDirId ? user.parentDirId.toString() : "",
      });

      const sessionExpirySeconds = 60 * 60 * 24 * 7;

      await redisClient.expire(redisKey, sessionExpirySeconds);

      res.cookie("sid", sessionId, {
        httpOnly: true,
        signed: true,
        maxAge: sessionExpirySeconds * 1000,
      });

      await otpDoc.deleteOne();
    }

    if (caller === "register") {
      const savedOtp = await redisClient.get(`otp:${email}`);

      if (savedOtp !== otp) {
        return res.status(400).json({
          cause: "otp_invalid",
          message: "Invalid OTP",
        });
      }

      await redisClient.set(`verified:${email.trim().toLowerCase()}`, "1", {
        EX: 600,
      });
    }

    return res.status(200).json({
      message: "OTP Verified!",
    });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (req, res, next) => {
  console.log("Google auth route hit");
  const session = await mongoose.startSession();

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token not provided" });
    }

    const { name, email, picture } = await fetchUserUsingIdToken(token);

    let user;

    await session.withTransaction(async () => {
      user = await User.findOne({ email }).session(session);

      if (user && user.isDeleted) {
        throw {
          status: 403,
          message: "Account deleted. To recover, contact owner.",
          code: "ACCOUNT_DELETED",
        };
      }

      // CREATE USER IF NOT EXISTS
      if (!user) {
        const userId = new Types.ObjectId();
        const dirId = new Types.ObjectId();

        await Directory.create(
          [
            {
              _id: dirId,
              name: `root-${email}`,
              parentDirId: null,
              userId,
            },
          ],
          { session },
        );

        const createdUser = await User.create(
          [
            {
              _id: userId,
              name,
              email,
              avatar: picture || null,
              provider: "google",
              parentDirId: dirId,
            },
          ],
          { session },
        );

        user = createdUser[0];

        if (!user.avatar) {
          user.avatar = picture;
          await user.save();
        }

        fgaClient
          .write({
            writes: [
              {
                user: `user:${userId.toString()}`,
                relation: "owner",
                object: `folder:${dirId.toString()}`,
              },
            ],
          })
          .catch((err) => {
            console.error("FGA async error:", err);
          });
      }
    });

    // REDIS SESSION HANDLING

    const userSessions = await redisClient.ft.search(
      "userIdIdx",
      `@userId:{${user._id.toString()}}`,
      { RETURN: [] },
    );

    if (userSessions.total >= 2) {
      await redisClient.del(userSessions.documents[0].id);
    }

    const sessionId = crypto.randomUUID();
    const redisKey = `session:${sessionId}`;

    await redisClient.hSet(redisKey, {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      picture: user.avatar || "",
      role: user.role,
      plan: user.plan,
      uploadLimit: user.uploadLimit,
      totalStorage: user.totalStorage,
      parentDirId: user.parentDirId ? user.parentDirId.toString() : "",
    });

    const sessionExpiryTime = 1000 * 60 * 60 * 24 * 7; // 7 days

    await redisClient.expire(redisKey, sessionExpiryTime / 1000);

    // COOKIE

    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      maxAge: sessionExpiryTime,
      sameSite: "lax",
      secure: false,
    });

    return res.status(200).json({
      success: true,
      message: "Authenticated successfully with Google",
    });
  } catch (error) {
    console.error(error);

    if (error?.status) {
      return res.status(error.status).json({
        message: error.message,
        code: error.code,
      });
    }

    if (error.code === 121) {
      return res.status(400).json({
        message: "Invalid Input",
        details: error,
      });
    }

    if (error.code === 11000 && error.keyValue?.email) {
      return res.status(409).json({
        message: "This email already exists",
      });
    }

    next(error);
  } finally {
    session.endSession();
  }
};

export const githubAuth = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("No code provided");

    const { name, email, avatar_url: picture } = await fetchGithubUser(code);
    let user = await User.findOne({ email });

    if (!user) {
      await session.withTransaction(async () => {
        const userId = new Types.ObjectId();
        const dirId = new Types.ObjectId();

        await Directory.create(
          [
            {
              _id: dirId,
              name: `root-${email}`,
              parentDirId: null,
              userId,
            },
          ],
          { session },
        );

        const createdUser = await User.create(
          [
            {
              _id: userId,
              name,
              email,
              avatar: picture || null,
              provider: "github",
              parentDirId: dirId,
            },
          ],
          { session },
        );

        user = createdUser[0];
        fgaClient
          .write({
            writes: [
              {
                user: `user:${userId.toString()}`,
                relation: "owner",
                object: `folder:${dirId.toString()}`,
              },
            ],
          })
          .catch((err) => {
            console.error("FGA async error:", err);
          });
      });
    }
    if (!user.avatar) {
      user.avatar = picture;
      await user.save();
    }
    const userSessions = await redisClient.ft.search(
      "userIdIdx",
      `@userId:{${user.id}}`,
      {
        RETURN: [],
      },
    );

    if (userSessions.total >= 2) {
      await redisClient.del(userSessions.documents[0].id);
    }

    const sessionId = crypto.randomUUID();
    const redisKey = `session:${sessionId}`;

    await redisClient.hSet(redisKey, {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      picture: user.picture || "",
      role: user.role,
      plan: user.plan,
      uploadLimit: user.uploadLimit,
      totalStorage: user.totalStorage,
      parentDirId: user.parentDirId ? user.parentDirId.toString() : "",
    });

    const sessionExpiryTime = 60 * 1000 * 60 * 24 * 7;

    redisClient.expire(redisKey, sessionExpiryTime / 1000);

    // setting cookie
    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      maxAge: sessionExpiryTime,
    });

    return res.redirect("http://localhost:5173");
  } catch (error) {
    if (error.code === 121) {
      return res.status(400).json({ message: "Invalid Input", details: error });
    }

    if (error.code === 11000 && error.keyValue?.email) {
      return res.status(409).json({
        message: "This email already exists",
      });
    }

    next(error);
  } finally {
    session.endSession();
  }
};

export const googleDrive = async (req, res) => {
  const code = req.query.code;
  const { accessToken } = await fetchTokenForDrive(code);
  if (!accessToken) {
    return res.status(400).json({ message: "Missing or invalid access token" });
  }
  res.cookie("drive_access_token", accessToken, {
    httpOnly: true,
    signed: true,
    secure: false, // true in production (HTTPS)
    sameSite: "lax",
    maxAge: 60 * 60 * 1000, // 1 hour
  });
  res.redirect("http://localhost:5173");
};

export const checkDriveAuth = async (req, res) => {
  const { drive_access_token } = req.signedCookies;
  if (!drive_access_token) {
    return res.status(400).json({ message: "Token missing" });
  }
  return res.status(200).json({ isAuthenticated: true });
};

export const fetchGoogleDriveFiles = async (req, res) => {
  try {
    const { drive_access_token } = req.signedCookies;
    if (!drive_access_token)
      return res.status(400).json({ message: "Missing token" });

    const driveRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,webViewLink,webContentLink,mimeType,thumbnailLink,hasThumbnail,createdTime,modifiedTime,viewedByMeTime,size,owners)",
      { headers: { Authorization: `Bearer ${drive_access_token}` } },
    );
    const data = await driveRes.json();
    if (!driveRes.ok) {
      console.log("Google Drive API error:", data);
      return res.status(driveRes.status).json({ message: data });
    }
    const driveFiles = data.files || [];

    const FOLDER_MIME = "application/vnd.google-apps.folder";

    const directories = driveFiles.filter(
      (file) => file.mimeType === FOLDER_MIME,
    );

    const files = driveFiles.filter((file) => file.mimeType !== FOLDER_MIME);

    res.status(200).json({ files, directories });
  } catch (error) {
    next(error);
  }
};

// controllers/googleDriveController.js
export const viewGoogleDriveFile = async (req, res, next) => {
  try {
    const { drive_access_token } = req.signedCookies;
    if (!drive_access_token)
      return res.status(401).json({ message: "Unauthorized" });

    const { fileId } = req.query;
    if (!fileId) return res.status(400).json({ message: "Missing fileId" });

    // Get metadata to detect Google Docs vs normal file
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`,
      { headers: { Authorization: `Bearer ${drive_access_token}` } },
    );

    const metadata = await metaRes.json();
    const mimeType = metadata.mimeType;

    let url;
    if (mimeType.startsWith("application/vnd.google-apps.")) {
      // Docs/Sheets/Slides → export to PDF
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
    } else {
      // PDFs, images, videos
      url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const driveRes = await fetch(url, {
      headers: { Authorization: `Bearer ${drive_access_token}` },
    });

    res.writeHead(200, {
      "Content-Type": mimeType.startsWith("application/vnd.google-apps.")
        ? "application/pdf"
        : mimeType,
      "Content-Disposition": "inline; filename=file.pdf",
    });
    await pipeline(driveRes.body, res);
  } catch (err) {
    next(err);
  }
};
export const downloadGoogleDriveFiles = async (req, res) => {
  try {
    const { drive_access_token } = req.signedCookies;

    if (!drive_access_token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { fileId } = req.query;

    if (!fileId) {
      return res.status(400).json({ message: "Missing fileId" });
    }

    // Get metadata
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
      {
        headers: {
          Authorization: `Bearer ${drive_access_token}`,
        },
      },
    );

    if (!metaRes.ok) {
      return res.status(metaRes.status).send(await metaRes.text());
    }

    const meta = await metaRes.json();

    let downloadUrl;
    let fileName = meta.name;
    let contentType = meta.mimeType;

    const isGoogleDoc = meta.mimeType.startsWith(
      "application/vnd.google-apps.",
    );

    // Handle Google docs export
    if (isGoogleDoc) {
      let exportMime;

      switch (meta.mimeType) {
        case "application/vnd.google-apps.document":
          exportMime = "application/pdf";
          fileName += ".pdf";
          break;

        case "application/vnd.google-apps.spreadsheet":
          exportMime =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          fileName += ".xlsx";
          break;

        case "application/vnd.google-apps.presentation":
          exportMime = "application/pdf";
          fileName += ".pdf";
          break;

        default:
          return res
            .status(400)
            .json({ message: "Unsupported Google file type" });
      }

      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${exportMime}`;
      contentType = exportMime;
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    // Fetch actual file stream
    const fileRes = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${drive_access_token}`,
      },
    });

    if (!fileRes.ok || !fileRes.body) {
      return res.status(fileRes.status).send(await fileRes.text());
    }

    // Important headers
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    res.setHeader("Content-Type", contentType);

    if (!isGoogleDoc && meta.size) {
      res.setHeader("Content-Length", meta.size);
    }

    // Stream directly
    Readable.fromWeb(fileRes.body).pipe(res);
  } catch (err) {
    console.error(err);

    if (!res.headersSent) {
      res.status(500).json({ message: "Download failed" });
    }
  }
};
