import { useEffect } from "react";
import { useState, useRef } from "react";

function OTPInput({
  length = 4,
  onChange,
  otpError,
  handleOtpSubmit,
  handleResendOtp,
  loading,
  resendLoading,
  isCooldown,
}) {
  const [otp, setOtp] = useState(Array(length).fill(""));
  const [otpSeconds, setOtpSeconds] = useState(60);
  const inputsRef = useRef([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOtpSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (otpError) {
      setOtp((prev) => prev.map(() => ""));
    }
  }, [otpError]);

  const handleChange = (e, index) => {
    const value = e.target.value.replace(/\D/, ""); // allow only numbers
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    onChange && onChange(newOtp.join(""), setOtp);

    // Move focus to next input
    if (value && index < length - 1) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  return (
    <>
      <div style={{ textAlign: "center", marginTop: "18px" }} className="container">
        <h2 className="heading">Verify OTP</h2>
        <p className="otp-label">
          Enter 4-digit OTP sent to your email-address
        </p>
      </div>
      <div
        className="form-group otp-group"
        style={{
          display: "flex",
          flexDirection: "row",
          marginBlock: "16px",
          justifyContent: "center",
          gap: "18px",
        }}
      >
        {otp.map((digit, i) => (
          <input
            key={i}
            type="text"
            maxLength={1}
            value={digit}
            disabled={isCooldown}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            ref={(el) => (inputsRef.current[i] = el)}
            className="otp-input"
            style={{
              width: "40px",
              height: "40px",
              textAlign: "center",
              fontSize: "18px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        ))}
      </div>
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        {otpError && <span className="error-msg">{otpError}</span>}
      </div>
      <button
        type="button"
        className="submit-button"
        onClick={async () => await handleOtpSubmit()}
        disabled={
          loading || otpError.includes("max") || otp.join("").trim().length < 4
        }
      >
        {loading ? "Verifying..." : "Verify"}
      </button>
      {/* Link to the login page */}

      <p className="link-text">
        <button
          type="button"
          className="resend-btn"
          onClick={async () => {
            await handleResendOtp(true);
            setOtpSeconds(60);
          }}
          disabled={otpSeconds > 0 || resendLoading}
        >
          {resendLoading ? "Resending..." : "Resend"}
        </button>
        {otpSeconds !== 0 && <span>OTP in {otpSeconds} seconds</span>}
      </p>
    </>
  );
}

export default OTPInput;
