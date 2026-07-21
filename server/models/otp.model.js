import { model, Schema } from "mongoose";
import crypto from 'crypto'

const otpSchema = new Schema({
  otp: {
    type: Number,
    default: () => crypto.randomInt(1000, 10000),
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    trim: true,
    unique: true
  },
   tries: {
    type: Number,
    default: 0,
  },
  expires: {
    type: Date,
    expires: 60,
    default: Date.now
  }
});

const OTP = model("OTP", otpSchema);

export default OTP;
