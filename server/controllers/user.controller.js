import Directory from "../models/directory.model.js";
import File from "../models/file.model.js";
import Session from "../models/session.model.js";
import User from "../models/user.model.js";
import { fileURLToPath } from "url";
import { rm } from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { fgaClient } from "../services/openFGAService.js";
import redisClient from "../config/redis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getCurrentUser = async (req, res, next) => {
  try {
    const rootDir = await Directory.findOne({
      userId: req.user._id,
      parentDirId: null,
    });
    return res.status(200).json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      role: req.user.role,
      plan: req.user.plan,
      uploadLimit: req.user.uploadLimit,
      totalStorage: req.user.totalStorage,
      totalUsage: rootDir.size,
    });
  } catch (error) {
    next(error);
  }
};

export const fetchUsers = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const currentUser = await User.findById(userId);

    const allUsers = await User.find({
      role: {
        $nin:
          currentUser.role === "manager"
            ? ["superuser", "admin", "manager"]
            : currentUser.role === "admin"
              ? ["admin", "superuser"]
              : ["superuser"],
      },
    })
      .select("name email role isDeleted")
      .lean();
    if (!allUsers.length) {
      return res.status(404).json({ users: [], message: "Users not found" });
    }
    const sessions = await redisClient.ft.search("userIdIdx", "*", {
      RETURN: ["id", "userId"],
    });

    const filteredUsers = allUsers.filter(
      (user) => !user._id.equals(currentUser._id),
    );
    const sessionUserIds = new Set(
      sessions.documents.map((s) => s.value?.userId),
    );

    const users = filteredUsers.map((user) => {
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isLoggedIn: sessionUserIds.has(user._id.toString()),
        isDeleted: user.isDeleted,
      };
    });

    return res.status(200).json({ users });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export const revokeUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requesterRole = req.user?.role;

    const userToBeRevoked = await User.findById(userId).select("role").lean();

    if (!userToBeRevoked) {
      return res.status(404).json({ message: "User not found" });
    }

    const rolePriority = {
      admin: 3,
      manager: 2,
      user: 1,
    };

    if (rolePriority[requesterRole] <= rolePriority[userToBeRevoked.role]) {
      return res.status(403).json({
        message: "You are not authorized to revoke this user",
      });
    }

    const sessions = await redisClient.ft.search(
      "userIdIdx",
      `@userId:{${userId}}`,
      {
        RETURN: ["id", "userId"],
      },
    );
    // Revoking all the sessions
    for (const doc of sessions.documents) {
      await redisClient.del(doc.id);
    }

    return res.status(200).json({
      success: true,
      message: "User logged out successfully",
      sessionsRevoked: sessions.total,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id, name, email, role } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          name,
          email,
          role,
        },
      },
      { returnDocument: "after" },
    ).select("name email role isDeleted");
    if (!user) {
      return res.status(404).json({ message: "Error while updating user" });
    }
    const sessions = await redisClient.ft.search("userIdIdx", "*", {
      RETURN: ["id", "userId"],
    });

    const sessionUserIds = new Set(
      sessions.documents.map((s) => s.value?.userId),
    );

    return res.status(201).json({
      success: true,
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isDeleted: user.isDeleted,
        isLoggedIn: sessionUserIds.has(user._id.toString()),
      },
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
export const softDelete = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      { returnDocument: "after" },
    );

    const sessions = await redisClient.ft.search("userIdIdx", "*", {
      RETURN: ["id", "userId"],
    });
    const sessionUserIds = new Set(
      sessions.documents.map((s) => s.value?.userId),
    );

    return res.status(200).json({
      success: true,
      message: "User recovered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isDeleted: user.isDeleted,
        isLoggedIn: sessionUserIds.has(user._id.toString()),
      },
    });
  } catch (error) {
    console.error("Delete user failed:", error);
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { userId } = req.params;

    const userFiles = await File.find({ userId }).select("extension");
    await session.withTransaction(async () => {
      await Promise.all([
        User.deleteOne({ _id: userId }, { session }),
        Directory.deleteMany({ userId }, { session }),
        File.deleteMany({ userId }, { session }),
      ]);
    });
    const sessions = await redisClient.ft.search(
      "userIdIdx",
      `@userId:{${userId}}`,
      {
        RETURN: ["id", "userId"],
      },
    );
    for (const doc of sessions.documents) {
      await redisClient.del(doc.id);
    }

    if (userFiles.length > 0) {
      const fileDeletions = userFiles.map(async (file) => {
        const filePath = path.join(
          __dirname,
          "..",
          "storage",
          `${file._id}${file.extension.startsWith(".") ? file.extension : "." + file.extension}`,
        );
        try {
          await rm(filePath);
        } catch (err) {
          if (err.code !== "ENOENT") throw err;
        }
      });
      await Promise.all(fileDeletions);
    }

    return res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user failed:", error);
    next(error);
  } finally {
    await session.endSession();
  }
};
export const recoverUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isDeleted: false,
      },
      { returnDocument: "after" },
    );

    const sessions = await redisClient.ft.search("userIdIdx", "*", {
      RETURN: ["id", "userId"],
    });

    const sessionUserIds = new Set(
      sessions.documents.map((s) => s.value?.userId),
    );

    return res.status(200).json({
      success: true,
      message: "User recovered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isDeleted: user.isDeleted,
        isLoggedIn: sessionUserIds.has(user._id.toString()),
      },
    });
  } catch (error) {
    console.error("Delete user failed:", error);
    next(error);
  }
};

export const searchUsers = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const allUsers = await User.find({ _id: { $ne: userId } })
      .select("name email avatar")
      .lean();
    if (!allUsers.length) {
      return res.status(404).json({ users: [], message: "Users not found" });
    }
    return res.status(200).json({ users: allUsers });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
