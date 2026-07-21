import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import crypto from "node:crypto";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email",
      ],
      unique: true,
    },
    password: {
      type: String,
      required: function () {
        return this.provider === "local";
      },
      minlength: [4, "Password must be at least 4 characters"],
    },
    name: {
      type: String,
      default: null,
      minLength: 3,
    },
    avatar: {
      type: String,
      default: null,
    },
    parentDirId: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    role: {
      type: String,
      enum: ["admin", "manager", "user"],
      default: "user",
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'business'],
      default: 'free',
    },
    uploadLimit: {
      type: Number,
      default: 500 * 1000 ** 2
    },
    totalStorage: {
      type: Number,
      default: 2 * 1000 ** 3,
    },
    cooldown: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
  },
);

userSchema.pre("save", async function () {
  if (!this.password) return;
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
