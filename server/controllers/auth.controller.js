import User from "../models/user.model.js";
import Directory from "../models/directory.model.js";
import mongoose, { Types } from "mongoose";
import { hashOtp, sendOtpMail } from "../services/sendOtpService.js";
import OTP from "../models/otp.model.js";
import {
  fetchTokenForDrive,
  fetchUserUsingIdToken,
} from "../services/googleAuthService.js";
import { fetchGithubUser } from "../services/githubAuthService.js";
import { fgaClient } from "../services/openFGAService.js";
import redisClient from "../config/redis.js";
import {
  loginSchema,
  OTPSchema,
  registerSchema,
} from "../validators/authSchema.js";
import z from "zod";
import { sanitizeText } from "../utils/sanitizeText.js";
import { getDriveClient } from "../services/googleDriveClient.js";
import { LIMITERS } from "../config/limiters.js";

let isProduction = process.env.NODE_ENV === "production";

export const registerUser = async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message) });
  }
  const { name, email, password } = parsed.data; 

  const safeName = sanitizeText(name);
  const verifiedKey = `verified:${email}`;
  const session = await mongoose.startSession();

  try {

    if (!(await redisClient.get(verifiedKey))) {
      return res.status(403).json({ message: "OTP not verified" });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ message: "Email already exists" });
    }

    await session.withTransaction(async () => {
      const userId = new Types.ObjectId();
      const dirId = new Types.ObjectId();

      await Directory.create(
        [{ _id: dirId, name: `root-${email}`, parentDirId: null, userId }],
        { session },
      );

      await User.create(
        [
          {
            _id: userId,
            name: safeName,
            email,
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

    await redisClient.del(verifiedKey);

    return res.status(201).json({ message: "User Registered" });
  } catch (error) {
    if (error?.name === "ValidationError" && error?.errors) {
      const msg = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");
      return res.status(400).json({ message: msg });
    }
    if (error?.code === 121) {
      return res.status(400).json({ message: "Invalid input data" });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    next(error);
  } finally {
    session.endSession();
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues.map((i) => i.message) });
    }
    const { email, password } = parsed.data;

    // email + IP: a stranger can't lock the real user out
    const key = `${email.toLowerCase()}_${req.ip}`;

    const state = await LIMITERS.authAccount.get(key).catch(() => null);
    if (state && state.remainingPoints <= 0) {
      res.set("Retry-After", Math.ceil(state.msBeforeNext / 1000));
      return res
        .status(429)
        .json({ message: "Too many attempts. Try again later." });
    }

    const user = await User.findOne({ email });
    const isPasswordValid = user ? await user.comparePassword(password) : false;

    if (!isPasswordValid) {
      await LIMITERS.authAccount.consume(key).catch(() => {}); // count failures only
      return res.status(401).json({ message: "Invalid credentials" });
    }

    await LIMITERS.authAccount.delete(key).catch(() => {});

    if (user.isDeleted) {
      return res.status(403).json({
        message: "Account deleted. To recover, contact owner.",
        code: "ACCOUNT_DELETED",
      });
    }
    await redisClient.set(`login-pending:${email}`, "1", { EX: 600 });
    const mail = await sendOtpMail(email, "login");
    if (mail.rateLimited) {
      res.set("Retry-After", mail.retryAfter);
      return res.status(429).json({
        cause: "cooldown",
        message: mail.error,
        timeLeft: mail.retryAfter,
      });
    }
    if (mail.error) return res.status(400).json({ message: mail.error });

    return res
      .status(200)
      .json({ success: true, message: "Login process initiated, verify" });
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
    res.clearCookie("drive_access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
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
    res.clearCookie("drive_access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    return res
      .status(200)
      .json({ message: "Logged out from all devices successfully" });
  } catch (error) {
    next(error);
  }
};

const sendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  caller: z.enum(["register", "login"]),
});

export const sendOtp = async (req, res) => {
  try {
    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid email" });
    }
    const { email, caller } = parsed.data;

    if (caller === "register") {
      if (await User.findOne({ email })) {
        return res
          .status(409)
          .json({ cause: "duplicate_email", message: "Email already exists!" });
      }
    } else {
      // login resend: only allowed right after a correct password
      if (!(await redisClient.get(`login-pending:${email}`))) {
        return res.status(403).json({ message: "Please log in again" });
      }
    }

    const mail = await sendOtpMail(email, caller);
    if (mail.rateLimited) {
      res.set("Retry-After", mail.retryAfter);
      return res.status(429).json({
        cause: "cooldown",
        message: mail.error,
        timeLeft: mail.retryAfter,
      });
    }
    if (mail.error) return res.status(400).json({ message: mail.error });

    return res.status(201).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("sendOtp failed:", error);
    return res
      .status(500)
      .json({ cause: "smtp_failed", message: "Failed to send OTP" });
  }
};

const MAX_TRIES = 5;
const SESSION_TTL = 60 * 60 * 24 * 7;

// Atomic: count the try, compare, delete on success or when tries run out
const VERIFY_LUA = `
local h = redis.call('HGET', KEYS[1], 'hash')
if not h then return 'expired' end
local tries = redis.call('HINCRBY', KEYS[1], 'tries', 1)
if h == ARGV[1] then redis.call('DEL', KEYS[1]) return 'ok' end
if tries >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]) return 'locked' end
return tostring(tries)
`;

const createSession = async (res, user) => {
  const sessions = await redisClient.ft.search(
    "userIdIdx",
    `@userId:{${user._id}}`,
    { RETURN: [] },
  );
  if (sessions.total >= 2) await redisClient.del(sessions.documents[0].id);

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
  await redisClient.expire(redisKey, SESSION_TTL);

  res.cookie("sid", sessionId, {
    httpOnly: true,
    signed: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: SESSION_TTL * 1000,
  });
};

export const verifyOtp = async (req, res, next) => {
  const parsed = OTPSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid input, please enter valid details" });
  }
  const { email, otp, caller } = parsed.data;

  try {
    const state = await LIMITERS.otpVerifyEmail.get(email).catch(() => null);
    if (state && state.remainingPoints <= 0) {
      const wait = Math.ceil(state.msBeforeNext / 1000);
      res.set("Retry-After", wait);
      return res.status(429).json({
        cause: "otp_limit",
        message: "Too many attempts",
        timeLeft: wait,
      });
    }

    const result = await redisClient.eval(VERIFY_LUA, {
      keys: [`otp:${email}`],
      arguments: [hashOtp(email, otp, caller), String(MAX_TRIES)],
    });

    if (result !== "ok") {
      await LIMITERS.otpVerifyEmail.consume(email).catch(() => {});

      if (result === "expired") {
        return res
          .status(401)
          .json({ cause: "otp_expiry", message: "Invalid or expired OTP" });
      }
      if (result === "locked") {
        const key = `otp-cooldown:${email}`;

        await redisClient.set(key, "1", { EX: 60 });

        const secondsLeft = await redisClient.ttl(key);

        return res.status(429).json({
          cause: "otp_limit",
          message: "OTP max limit reached. Request a new code.",
          timeLeft: secondsLeft,
        });
      }
      const triesLeft = MAX_TRIES - Number(result);
      return res.status(400).json({
        cause: "otp_verification",
        message: `Invalid OTP. ${triesLeft === 1 ? "1 final" : triesLeft} tries left`,
      });
    }

    await LIMITERS.otpVerifyEmail.delete(email).catch(() => {});

    if (caller === "register") {
      await redisClient.set(`verified:${email}`, "1", { EX: 600 });
      return res.status(200).json({ message: "OTP Verified!" });
    }

    // caller === "login"
    const user = await User.findOne({ email });
    if (!user || user.isDeleted) {
      return res
        .status(401)
        .json({ cause: "authentication_failed", message: "Unable to authenticate" });
    }

    await createSession(res, user);
    return res.status(200).json({ message: "OTP Verified!" });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token not provided" });
    }

    const { name, email, picture } = await fetchUserUsingIdToken(token);

    let user;
    let fgaTuple = null;
    await session.withTransaction(async () => {
      user = await User.findOne({ email }).session(session);
      if (user && user.isDeleted) {
        return res.status(403).json({
          message: "Account deleted. To recover, contact owner.",
          code: "ACCOUNT_DELETED",
        });
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
        fgaTuple = {
          user: `user:${userId.toString()}`,
          relation: "owner",
          object: `folder:${dirId}`,
        };
        if (fgaTuple) {
          await fgaClient.write({
            writes: [fgaTuple],
          });
        }
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
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
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
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",

      maxAge: sessionExpiryTime,
    });

    return res.redirect(process.env.CLIENT_URL);
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
  const { code, dirId } = req.query;

  const { accessToken } = await fetchTokenForDrive(code);

  if (!accessToken) {
    return res.status(400).json({
      message: "Missing or invalid access token",
    });
  }
  res.cookie("drive_access_token", accessToken, {
    httpOnly: true,
    signed: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 60 * 60 * 1000,
  });
  if (dirId) {
    res.redirect(`${process.env.CLIENT_URL}/directory/${dirId}`);
  } else {
    res.redirect(`${process.env.CLIENT_URL}/google-drive`);
  }
};

export const checkDriveAuth = async (req, res) => {
  const { drive_access_token } = req.signedCookies;

  if (!drive_access_token) {
    return res.status(400).json({
      message: "Token missing",
    });
  }

  res.status(200).json({
    isAuthenticated: true,
  });
};

export const fetchGoogleDriveFiles = async (req, res, next) => {
  try {
    const { drive_access_token } = req.signedCookies;

    if (!drive_access_token) {
      return res.status(401).json({
        message: "Missing token",
      });
    }

    const drive = getDriveClient(drive_access_token);

    const FOLDER_MIME = "application/vnd.google-apps.folder";

    const allFiles = [];
    let pageToken = null;

    // Fetch all files/folders
    do {
      const response = await drive.files.list({
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields:
          "nextPageToken,files(id,name,webViewLink,parents,webContentLink,mimeType,thumbnailLink,hasThumbnail,createdTime,modifiedTime,viewedByMeTime,size,owners,lastModifyingUser,capabilities(canReadDrive,canEdit,canDelete,canShare,canCopy,canDownload,canRename,canAddChildren,canMoveItemWithinDrive,canDisableInheritedPermissions),permissions(id,type,role,photoLink,emailAddress,displayName,allowFileDiscovery,pendingOwner))",
        orderBy: "createdTime desc",
      });

      allFiles.push(...(response.data.files || []));
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    const directories = allFiles.filter(
      (file) => file.mimeType === FOLDER_MIME,
    );

    /**
     * parentId -> children
     */
    const childrenMap = new Map();

    for (const item of allFiles) {
      for (const parentId of item.parents || []) {
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }

        childrenMap.get(parentId).push(item);
      }
    }

    /**
     * Get all descendant IDs recursively.
     *
     * Includes:
     * - direct children
     * - grandchildren
     * - deeper descendants
     */
    const getChildrenIds = (folderId) => {
      const childrenIds = [];
      const visited = new Set();

      const walk = (parentId) => {
        const children = childrenMap.get(parentId) || [];

        for (const child of children) {
          if (visited.has(child.id)) {
            continue;
          }

          visited.add(child.id);

          childrenIds.push(child.id);

          // Continue only for folders
          if (child.mimeType === FOLDER_MIME) {
            walk(child.id);
          }
        }
      };

      walk(folderId);

      return childrenIds;
    };

    const files = allFiles
      .filter((file) => file.mimeType !== FOLDER_MIME)
      .map((file) => ({
        ...file,
      }));

    const folders = directories.map((folder) => ({
      ...folder,
      childrenIds: getChildrenIds(folder.id),
    }));

    return res.json({
      files,
      directories: folders,
    });
  } catch (error) {
    next(error);
  }
};

export const viewGoogleDriveFile = async (req, res, next) => {
  try {
    const { drive_access_token } = req.signedCookies;

    if (!drive_access_token) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { fileId } = req.query;

    if (!fileId) {
      return res.status(400).json({
        message: "Missing fileId",
      });
    }

    const drive = getDriveClient(drive_access_token);

    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType",
    });

    const mimeType = meta.data.mimeType;

    let response;

    if (mimeType.startsWith("application/vnd.google-apps.")) {
      response = await drive.files.export(
        {
          fileId,
          mimeType: "application/pdf",
        },
        {
          responseType: "stream",
        },
      );
    } else {
      response = await drive.files.get(
        {
          fileId,
          alt: "media",
        },
        {
          responseType: "stream",
        },
      );
    }

    res.setHeader(
      "Content-Type",
      mimeType.startsWith("application/vnd.google-apps.")
        ? "application/pdf"
        : mimeType,
    );

    res.setHeader("Content-Disposition", "inline");

    response.data.pipe(res);
  } catch (err) {
    next(err);
  }
};

export const downloadGoogleDriveFiles = async (req, res, next) => {
  try {
    const { drive_access_token } = req.signedCookies;

    if (!drive_access_token) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { fileId } = req.query;

    if (!fileId) {
      return res.status(400).json({
        message: "Missing fileId",
      });
    }

    const drive = getDriveClient(drive_access_token);

    const meta = await drive.files.get({
      fileId,
      fields: "name,mimeType,size",
    });

    let response;
    let fileName = meta.data.name;
    let contentType = meta.data.mimeType;

    const isGoogleFile = meta.data.mimeType.startsWith(
      "application/vnd.google-apps.",
    );

    if (isGoogleFile) {
      let exportMime;

      switch (meta.data.mimeType) {
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
          return res.status(400).json({
            message: "Unsupported Google file type",
          });
      }

      response = await drive.files.export(
        {
          fileId,
          mimeType: exportMime,
        },
        {
          responseType: "stream",
        },
      );

      contentType = exportMime;
    } else {
      response = await drive.files.get(
        {
          fileId,
          alt: "media",
        },
        {
          responseType: "stream",
        },
      );
    }

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    res.setHeader("Content-Type", contentType);

    if (!isGoogleFile && meta.data.size) {
      res.setHeader("Content-Length", meta.data.size);
    }

    response.data.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const createGoogleDriveUploadSession = async (req, res) => {
  try {
    const accessToken = req.signedCookies.drive_access_token;

    if (!accessToken) {
      return res.status(401).json({
        message: "Google Drive is not connected",
      });
    }

    const { name, size, contentType, parentDirId } = req.body;

    const metadata = {
      name,
    };

    // If you want the file inside a specific
    // Google Drive folder, parentDirId must be
    // the GOOGLE folder ID, not your local Mongo ID.
    if (parentDirId) {
      metadata.parents = [parentDirId];
    }

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType || "application/octet-stream",
          "X-Upload-Content-Length": String(size),
        },
        body: JSON.stringify(metadata),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Google Drive session error:", errorText);

      return res.status(response.status).json({
        message: "Failed to create Google Drive upload session",
        error: errorText,
      });
    }

    const uploadUrl = response.headers.get("location");

    if (!uploadUrl) {
      return res.status(500).json({
        message: "Google Drive did not return an upload URL",
      });
    }

    return res.status(200).json({
      uploadUrl,
    });
  } catch (error) {
    console.error("createGoogleDriveUploadSession:", error);

    return res.status(500).json({
      message: error.message || "Failed to create Google Drive upload session",
    });
  }
};
