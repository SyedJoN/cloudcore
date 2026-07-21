import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .email("Please enter a valid email")
    .nonempty("Please enter your email"),
  password: z
    .string()
    .min(4, "Password should contain atleast 4 characters")
    .max(30, "Password should not exceed 30 characters"),
});

export const registerSchema = loginSchema.extend({
  name: z
    .string("Name should be of type string")
    .min(3, "Name should contain atleast 3 characters")
    .max(100, "Name should not exceed 100 characters"),
});

export const OTPSchema = z.object({
  email: z.email("Please enter a valid email"),
  otp: z
    .string("Please enter a valid 4 digit OTP string")
    .regex(/^\d{4}/, "Please enter a valid 4 digit OTP")
});
