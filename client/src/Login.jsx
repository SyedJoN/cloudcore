import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import "./Auth.css";
import OTPInput from "./components/OTPInput";
import GoogleLoginBtn from "./components/GoogleLogin";
import GithubLoginBtn from "./components/GithubLogin";
import { loginSchema, OTPSchema } from "../validators/authSchema";
import { loginUser, sendOtp, verifyOtp } from "../apis/authApi";
import { createSubscription } from "../apis/subscriptionApi";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "m@gmail.com",
    password: "abcd",
  });

  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const [isCooldown, setisCooldown] = useState(false);
  const [errors, setErrors] = useState({});

  // serverError will hold the error message from the server
  const [serverError, setServerError] = useState("");
  const [otpError, setOtpError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Clear the server error as soon as the user starts typing in either field
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
  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = loginSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors = {};

      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        fieldErrors[field] = issue.message;
      });

      setErrors(fieldErrors);
      return;
    }
    setLoading(true);

    try {
      await loginUser(formData);

      setShowOtp(true);
      setServerError("");
      setOtpError("");
    } catch (err) {
      const cause = err.response?.data?.cause;

      if (cause === "cooldown") {
        const timeLeft = err.response.data.timeLeft;

        setServerError(err.message);
        setisCooldown(true);

        const ms = timeLeft * 1000;

        const expiresAt = Date.now() + ms;
        localStorage.setItem("cooldownExpiry", expiresAt);

        setTimeout(() => {
          setisCooldown(false);
          localStorage.removeItem("cooldownExpiry");
          setServerError("");
        }, ms);
        return;
      }
      setServerError(err.message || "Something went wrong. Please try again.");
      console.error("Error:", err.message);
    } finally {
      setLoading(false);
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
        caller: "login",
        email: formData.email,
        otp: formData.otp,
      });
      const priceId = location.state?.priceId;
      if (priceId) {
        const data = await createSubscription({ priceId });
        if (data.message) {
          toast({ message: data.message, type: "warning" });
          return;
        }
        window.location.href = data.url;
        return;
      }
      navigate("/");
    } catch (err) {
      const error = err.message;
      const cause = err.response?.data?.cause;
      if (cause === "otp_expiry") {
        setOtpError(error + ". Resend OTP to get new OTP");
        return;
      }
      if (cause === "otp_limit") {
        setOtpError(
          `${error || "Something went wrong during OTP"} redirecting to the login page`,
        );
        setisCooldown(true);
        setServerError("You are on cooldown wait 60s before retrying");
        setTimeout(() => {
          setShowOtp(false);
          setisCooldown(false);
        }, 2000);
      }
      setOtpError(error);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  // If there's an error, we'll add "input-error" class to both fields

  const handleOtpChange = async (otp, setOtp) => {
    if (otpError) {
      setOtpError("");
    }
    setFormData((prevFormData) => ({
      ...prevFormData,
      otp,
    }));
  };

  const handleResendOtp = async () => {
    setResendLoading(true);
    try {
      await sendOtp({
        email: formData.email,
      });
      setOtpError("");
    } catch (err) {
      console.log(err);
      if (err?.response?.status === 403) {
        setOtpError("forbidden");
      } else if (err.response?.data?.cause === "smtp_failed") {
        alert(err.message);
      } else {
        setOtpError(err.message || "Something went wrong");
      }
    } finally {
      setResendLoading(false);
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

        <h2 className="heading">{showOtp ? "" : "Welcome back"}</h2>
        {!showOtp && (
          <p className="auth-subtitle">Log in to access your files</p>
        )}

        {showOtp ? (
          <OTPInput
            onChange={handleOtpChange}
            otpError={otpError}
            setServerError={setServerError}
            handleOtpSubmit={handleOtpSubmit}
            handleResendOtp={handleResendOtp}
            resendLoading={resendLoading}
            loading={loading}
            isCooldown={isCooldown}
          />
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            {/* Email */}
            <div className="form-group">
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                className={`input ${errors.email ? "error-outline" : ""}`}
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>

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
              className="submit-button"
              disabled={loading || isCooldown}
            >
              {loading ? "Sending OTP..." : "Login"}
            </button>
            {serverError && (
              <span className="error-msg">{String(serverError)}</span>
            )}
          </form>
        )}

        {/* Link to the register page */}
        <p className="link-text">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
        <div className="or-text">
          <span>Or continue with</span>
        </div>
        <div className="oauth-buttons">
          <GoogleLoginBtn
            setServerError={setServerError}
            priceId={location.state?.priceId || null}
          />
          <GithubLoginBtn setServerError={setServerError} />
        </div>
      </div>
    </div>
  );
};
export default Login;
