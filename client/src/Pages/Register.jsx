import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../Styles/Auth.css";
import OTPInput from "../components/OTPInput";
import { useEffect } from "react";
import GoogleLoginBtn from "../components/ThirdPartyButtons/GoogleLogin";
import GithubLoginBtn from "../components/ThirdPartyButtons/GithubLogin";
import { axiosWithCreds, axiosWithoutCreds } from "../../apis/axiosInstances";
import { OTPSchema, registerSchema } from "../../Validators/authSchema";
import { registerUser, sendOtp, verifyOtp } from "../../apis/authApi";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "Syed Jon",
    email: "m@gmail.com",
    password: "abcd",
  });
  const [showOtp, setShowOtp] = useState(false);

  // serverError will hold the error message from the server
  const [serverError, setServerError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [errors, setErrors] = useState({});
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [loading, setLoading] = useState("");
  const [isCooldown, setIsCooldown] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();

  // Handler for input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setErrors((prev) => {
      return {
        ...prev,
        [name]: "",
      };
    });
    if (serverError) {
      setServerError("");
    }

    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: value,
    }));
  };

  // Handler for form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSuccess(false); // reset success if any
    const result = registerSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors = {};

      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        fieldErrors[field] = issue.message;
      });

      setErrors(fieldErrors);
      return;
    }
    setIsRegisterLoading(true);

    try {
      await registerUser(formData);

      setIsSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (err) {
      console.log(err);
      if (err.response?.status === 404) {
        setServerError(err.message);
        setOtpVerified(false);
      }
      setServerError(err.response?.data?.error);
    } finally {
      setIsRegisterLoading(false);
    }
  };
  const handleOtpChange = async (otp) => {
    if (serverError) {
      setServerError("");
    }
    setFormData((prevFormData) => ({
      ...prevFormData,
      otp,
    }));
    setIsSuccess(false);
  };
  const handleSendOtp = async (resend = false) => {
    setResendLoading(true);
    setServerError("");
    setOtpError("");

    // if (!formData.email?.trim()) {
    //   alert("Please enter a valid email before requesting OTP");
    //   return;
    // }
    const result = registerSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors = {};

      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        fieldErrors[field] = issue.message;
      });

      setErrors(fieldErrors);
      return;
    }
    if (!resend) {
      setLoading(true);
    }
    try {
      await sendOtp({
        caller: "register",
        email: formData.email,
      });
      setShowOtp((prev) => (prev === false ? true : prev));
    } catch (err) {
      const cause = err.response?.data?.cause;

      if (cause === "smtp_failed" || cause === "duplicate_email") {
        setServerError(err.message);
      } else if (cause === "cooldown") {
        const error = err.message;
        const timeLeft = err.response.data.timeLeft;

        setServerError(error);
        setIsCooldown(true);

        const ms = timeLeft * 1000;

        const expiresAt = Date.now() + ms;
        localStorage.setItem("cooldownExpiry", expiresAt);

        setTimeout(() => {
          setIsCooldown(false);
          setServerError("");
          localStorage.removeItem("cooldownExpiry");
        }, ms);
      } else {
        setServerError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            err.message,
        );
      }
    } finally {
      setLoading(false);
      setResendLoading(false);
    }
  };
  const handleOtpSubmit = async (e) => {
    const result = OTPSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors = {};

      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        fieldErrors[field] = issue.message;
      });

      setErrors(fieldErrors);
      return;
    }
    setOtpError("");
    setLoading(true);
    try {
      await verifyOtp({
        caller: "register",
        email: formData.email,
        otp: formData.otp,
      });

      setOtpVerified(true);
      setShowOtp(false);
    } catch (err) {
      const error = err.message;
      const cause = err.response?.data?.cause;
      if (cause === "otp_expiry") {
        setOtpError(error + ". Resend OTP to get new OTP");
        return;
      }
      if (cause === "otp_limit") {
        setOtpError(
          `${error || "Something went wrong during OTP"} redirecting back to the register page`,
        );
        setIsCooldown(true);

        setTimeout(() => {
          setServerError("You are on cooldown wait 60s before retrying");
          setShowOtp(false);
          setIsCooldown(false);
        }, 2000);
      }
      setOtpError(error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <span className="auth-logo-badge">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
          </span>
          <span className="auth-logo-text">CloudCore</span>
        </Link>

        <h2 className="heading">Create your account</h2>
        <p className="auth-subtitle">Get 2GB of secure storage, free</p>

        <form className="form" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-group">
            <label htmlFor="name" className="label">
              Name
            </label>
            <input
              className={`input ${errors.name ? "error-outline" : ""}`}
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              required
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          {/* Email */}
          {showOtp ? (
            <OTPInput
              onChange={handleOtpChange}
              otpError={otpError}
              handleOtpSubmit={handleOtpSubmit}
              serverError={serverError}
              handleResendOtp={handleSendOtp}
              resendLoading={resendLoading}
              loading={loading}
              setServerError={setServerError}
              isCooldown={isCooldown}
            />
          ) : (
            <div className="form-group">
              <label htmlFor="email" className="label">
                Email
              </label>
              <div className="email-otp-row">
                <input
                  className={`input ${errors.email ? "error-outline" : ""}`}
                  type="email"
                  id="email"
                  name="email"
                  disabled={otpVerified}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  required
                />

                <button
                  type="button"
                  disabled={loading || otpVerified || isCooldown}
                  onClick={async () => await handleSendOtp()}
                  className={`otp-btn ${otpVerified ? "otp-btn-verified" : ""}`}
                >
                  <span
                    style={{
                      color: otpVerified ? "#34d399" : "#f1f1f1",
                      fontSize: "12px",
                    }}
                  >
                    {otpVerified
                      ? "verified ✔️"
                      : loading
                        ? "Sending OTP..."
                        : "Send OTP"}
                  </span>
                </button>
              </div>
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>
          )}
          {/* Absolutely-positioned error message below email field */}

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              className={`input ${errors.password ? "error-outline" : ""}`}
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
            {errors.password && (
              <p className="field-error">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!otpVerified || isRegisterLoading}
            className={`submit-button ${isSuccess ? "success" : ""}`}
          >
            {isSuccess
              ? "Registration Successful"
              : isRegisterLoading
                ? "Registering..."
                : "Register"}
          </button>
          {serverError && <div className="error-msg">{serverError}</div>}
        </form>

        {/* Link to the login page */}
        <p className="link-text">
          Already have an account? <Link to="/login">Login</Link>
        </p>
        <div className="or-text">
          <span>Or continue with</span>
        </div>
        <div className="oauth-buttons">
          <GoogleLoginBtn setServerError={setServerError} />
          <GithubLoginBtn setServerError={setServerError} />
        </div>
      </div>
    </div>
  );
};

export default Register;
