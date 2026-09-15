import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  loginTeacher,
  isAccountClaimed,
  getClaimDetails,
} from "./onboardingApi.js";

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [emailOrToken, setEmailOrToken] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const claimed = isAccountClaimed();
  const claimDetails = getClaimDetails();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    try {
      setLoading(true);
      const res = await loginTeacher({
        emailOrToken: emailOrToken.trim() || "priya.sharma@apex.edu",
        password,
      });

      if (res.success) {
        if (typeof onLoginSuccess === "function") {
          onLoginSuccess();
        }
        navigate("/", { replace: true });
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmailOrToken("priya.sharma@apex.edu");
    setPassword(claimDetails.password || "Password123!");
    setErrorMsg("");
  };

  return (
    <div
      className="tactile-paper"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: "460px", width: "100%" }}>
        
        {/* BRAND HEADER */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <p className="zine-label">TEACHER WORKSPACE AUTHENTICATION</p>
          <h1 className="zine-heading" style={{ fontSize: "28px", marginTop: "6px" }}>
            Teacher Guide / ClassPulse
          </h1>
          <p className="text-muted" style={{ marginTop: "6px", fontSize: "14px" }}>
            Faculty portal for Apex Institute of Technology
          </p>
        </div>

        {/* LOGIN CARD */}
        <div
          className="hypercard-static pad-7"
          style={{
            background: "var(--surface)",
            border: "2px solid var(--border-strong)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "4px" }}>
            Faculty Log In
          </h2>
          <p className="text-fine" style={{ marginBottom: "20px" }}>
            Access lesson plans, quizzes, and class diagnostic readiness.
          </p>

          {!claimed && (
            <div
              className="ui-card pad-4"
              style={{
                marginBottom: "20px",
                background: "#fffbf0",
                border: "1px solid #e0c870",
                fontSize: "13px",
              }}
            >
              <strong>First time visiting?</strong>
              <p style={{ marginTop: "4px", color: "var(--ink-2)" }}>
                Your faculty account has not been claimed yet. Complete the quick account claim ritual to configure your profile and sections.
              </p>
              <Link
                to="/claim"
                className="text-link"
                style={{ display: "inline-block", marginTop: "8px", fontWeight: "700", textDecoration: "underline" }}
              >
                Claim your account here →
              </Link>
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                padding: "10px 14px",
                marginBottom: "18px",
                border: "1.5px solid var(--border-strong)",
                borderRadius: "var(--r-md)",
                background: "#fff0ed",
                color: "#990000",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              {errorMsg}
              {errorMsg.includes("claim") && (
                <div style={{ marginTop: "8px" }}>
                  <Link to="/claim" className="ui-button ui-button-secondary" style={{ fontSize: "12px", minHeight: "32px", padding: "4px 10px" }}>
                    Go to Account Claim →
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-field" style={{ marginBottom: "16px" }}>
              <label htmlFor="login-identity" className="form-label">
                Faculty Email or Institutional ID
              </label>
              <input
                id="login-identity"
                type="text"
                className="ui-input"
                value={emailOrToken}
                onChange={(e) => setEmailOrToken(e.target.value)}
                placeholder="e.g. priya.sharma@apex.edu"
                required
              />
            </div>

            <div className="form-field" style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="login-password" className="form-label">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-link"
                  style={{ fontSize: "12px", border: "none", background: "none", cursor: "pointer" }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="ui-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="ui-button ui-button-primary ui-button-block"
              style={{ minHeight: "44px", fontSize: "15px", fontWeight: "700" }}
            >
              {loading ? "Authenticating..." : "Log In to Workspace →"}
            </button>
          </form>

          {/* QUICK DEMO HELPER */}
          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="text-link"
              style={{
                fontSize: "12px",
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--ink-2)",
              }}
            >
              ⚡ Autofill Demo Credentials ({claimDetails.name || "Prof. Priya Sharma"})
            </button>
          </div>
        </div>

        {/* BOTTOM HELPER */}
        <div style={{ textAlign: "center", marginTop: "24px", fontSize: "13px" }}>
          <span className="text-muted">Have an invite token? </span>
          <Link to="/claim" className="text-link" style={{ fontWeight: "600", textDecoration: "underline" }}>
            Claim Faculty Account
          </Link>
        </div>
      </div>
    </div>
  );
}
