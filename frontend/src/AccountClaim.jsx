import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  getMySections,
  flagSection,
  claimAccount,
  isAccountClaimed,
  getClaimDetails,
} from "./onboardingApi.js";

const LANGUAGES = [
  { code: "English", label: "English" },
  { code: "Hindi", label: "Hindi (हिंदी)" },
  { code: "Kannada", label: "Kannada (ಕನ್ನಡ)" },
  { code: "Tamil", label: "Tamil (தமிழ்)" },
  { code: "Telugu", label: "Telugu (తెలుగు)" },
  { code: "Marathi", label: "Marathi (मराठी)" },
  { code: "Bengali", label: "Bengali (বাংলা)" },
  { code: "Gujarati", label: "Gujarati (ગુજરાતી)" },
];

export default function AccountClaim({ onClaimComplete }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "inv_prof_sharma_982";

  // Staged Flow: 1 = Profile & Credentials, 2 = Review Teaching Assignments
  const [stage, setStage] = useState(1);

  // Form State
  const [name, setName] = useState("Prof. Priya Sharma");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState("English");
  const [timings, setTimings] = useState({});

  // Sections & Flag Modal State
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [flagModalSec, setFlagModalSec] = useState(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSuccessMsg, setFlagSuccessMsg] = useState("");

  const alreadyClaimed = isAccountClaimed();

  // Load sections on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await getMySections();
        setSections(data);

        // Populate initial timings
        const initialTimings = {};
        data.forEach((s) => {
          initialTimings[s.id] = s.defaultTiming || "";
        });
        setTimings(initialTimings);

        const details = getClaimDetails();
        if (details.name) setName(details.name);
        if (details.languagePreference) setLanguage(details.languagePreference);
      } catch (err) {
        console.error("Failed to load sections:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleTimingChange = (sectionId, value) => {
    setTimings((prev) => ({ ...prev, [sectionId]: value }));
  };

  const handleOpenFlagModal = (sec) => {
    setFlagModalSec(sec);
    setFlagReason("");
    setFlagSuccessMsg("");
  };

  const handleCloseFlagModal = () => {
    setFlagModalSec(null);
    setFlagReason("");
    setFlagSuccessMsg("");
  };

  const handleSubmitFlag = async (e) => {
    e.preventDefault();
    if (!flagModalSec || !flagReason.trim()) return;

    try {
      setFlagSubmitting(true);
      const res = await flagSection(flagModalSec.id, { reason: flagReason });
      if (res.success) {
        setSections((prev) =>
          prev.map((s) =>
            s.id === flagModalSec.id
              ? { ...s, flagged: true, flagReason: flagReason.trim() }
              : s
          )
        );
        setFlagSuccessMsg("Section flagged. Your administrator has been notified.");
        setTimeout(() => {
          handleCloseFlagModal();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || "Failed to flag section.");
    } finally {
      setFlagSubmitting(false);
    }
  };

  // Move from Stage 1 -> Stage 2 after validation
  const handleConfirmStageOne = (e) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Please confirm your full name.");
      return;
    }

    if (!password) {
      setFormError("Please enter a secure password.");
      return;
    }

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match. Please re-enter your password.");
      return;
    }

    // Success -> proceed to next stage
    setStage(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Final Claim Submission from Stage 2
  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    setFormError("");

    try {
      setSubmitting(true);
      const result = await claimAccount({
        token: tokenFromUrl,
        password,
        name: name.trim(),
        language,
        timings,
      });

      if (result.success) {
        if (typeof onClaimComplete === "function") {
          onClaimComplete();
        }
        navigate("/", { replace: true });
      }
    } catch (err) {
      setFormError(err.message || "Failed to claim account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tactile-paper" style={{ minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        
        {/* TOP BAR / BRAND */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "24px",
            borderBottom: "1.5px solid var(--border-strong)",
            marginBottom: "32px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <p className="zine-label">FIRST-RUN FACULTY ONBOARDING</p>
            <h1 className="zine-heading" style={{ fontSize: "28px", marginTop: "4px" }}>
              Teacher Guide / ClassPulse
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="ui-pill ui-pill-dark">
              Invite Token: {tokenFromUrl.slice(0, 16)}...
            </span>
            <Link to="/login" className="text-link" style={{ fontSize: "14px", fontWeight: "600" }}>
              Already claimed? Log In →
            </Link>
          </div>
        </div>

        {alreadyClaimed && (
          <div
            className="ui-card pad-4"
            style={{
              marginBottom: "24px",
              background: "var(--paper-2)",
              border: "1.5px solid var(--border-strong)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <strong>Account Already Claimed</strong>
              <p className="text-muted" style={{ fontSize: "14px", marginTop: "2px" }}>
                You have already completed the first-run claim ritual. You can proceed directly to the workspace or log in.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Link to="/login" className="ui-button ui-button-secondary">
                Log In
              </Link>
              <Link to="/" className="ui-button ui-button-primary">
                Dashboard →
              </Link>
            </div>
          </div>
        )}

        {/* INVITE HERO BANNER */}
        <section
          className="hypercard-static pad-7"
          style={{ marginBottom: "32px", background: "var(--surface)" }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 400px" }}>
              <p className="zine-label">INSTITUTIONAL INVITATION</p>
              <h2 style={{ fontSize: "24px", fontWeight: "700", marginTop: "6px" }}>
                Claim Your Faculty Workspace
              </h2>
              <p className="card-body" style={{ marginTop: "8px", color: "var(--ink-2)" }}>
                You have been invited to manage curricula, conduct diagnostic readiness checks, and validate AI concept graphs.
              </p>
            </div>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "12px 18px",
                background: "var(--paper-2)",
              }}
            >
              <span className="zine-caption" style={{ display: "block" }}>
                ASSIGNED INSTITUTION (READ-ONLY)
              </span>
              <strong style={{ fontSize: "16px", display: "block", marginTop: "2px" }}>
                Apex Institute of Technology
              </strong>
              <span className="text-fine" style={{ color: "var(--ink-2)" }}>
                Department of Computer Science & Engineering
              </span>
            </div>
          </div>
        </section>

        {/* STAGE 1: PROFILE & CREDENTIALS */}
        {stage === 1 && (
          <form onSubmit={handleConfirmStageOne}>
            <div className="panel" style={{ marginBottom: "32px" }}>
              <div className="panel-header">
                <div>
                  <p className="zine-label">FACULTY PROFILE</p>
                  <h2 style={{ fontSize: "20px" }}>Profile & Security Credentials</h2>
                  <p className="text-muted" style={{ fontSize: "14px", marginTop: "4px" }}>
                    Configure your credentials and preferred vernacular before reviewing assigned teaching sections.
                  </p>
                </div>
              </div>

              {formError && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "20px",
                    border: "1.5px solid var(--border-strong)",
                    borderRadius: "var(--r-md)",
                    background: "#fff2f0",
                    color: "#990000",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  {formError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                {/* CONFIRM NAME */}
                <div className="form-field">
                  <label htmlFor="teacher-name" className="form-label">
                    Confirm Full Name <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    id="teacher-name"
                    type="text"
                    className="ui-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Prof. Priya Sharma"
                    required
                  />
                  <span className="zine-caption" style={{ marginTop: "4px" }}>
                    This name will appear on student reports and lesson plans.
                  </span>
                </div>

                {/* LANGUAGE PREFERENCE */}
                <div className="form-field">
                  <label htmlFor="language-pref" className="form-label">
                    Language Preference <span style={{ color: "red" }}>*</span>
                  </label>
                  <select
                    id="language-pref"
                    className="ui-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <span className="zine-caption" style={{ marginTop: "4px" }}>
                    Primary interface language and generated diagnostic vernacular.
                  </span>
                </div>

                {/* PASSWORD */}
                <div className="form-field">
                  <label htmlFor="teacher-password" className="form-label">
                    Set Password <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    id="teacher-password"
                    type={showPassword ? "text" : "password"}
                    className="ui-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    autoComplete="new-password"
                  />
                </div>

                {/* CONFIRM PASSWORD */}
                <div className="form-field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label htmlFor="teacher-confirm-password" className="form-label">
                      Confirm Password <span style={{ color: "red" }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-link"
                      style={{ fontSize: "12px", border: "none", background: "none", cursor: "pointer" }}
                    >
                      {showPassword ? "Hide" : "Show"} password
                    </button>
                  </div>
                  <input
                    id="teacher-confirm-password"
                    type={showPassword ? "text" : "password"}
                    className="ui-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {/* CONFIRM & PROCEED BUTTON */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
                padding: "24px 0",
              }}
            >
              <span className="text-muted" style={{ fontSize: "14px" }}>
                Next: Review and confirm your assigned teaching sections.
              </span>
              <button
                type="submit"
                className="ui-button ui-button-primary"
                style={{ minWidth: "240px", fontSize: "15px" }}
              >
                Confirm Credentials & Continue →
              </button>
            </div>
          </form>
        )}

        {/* STAGE 2: REVIEW TEACHING ASSIGNMENTS & CLAIM */}
        {stage === 2 && (
          <form onSubmit={handleSubmitClaim}>
            {/* PROFILE CONFIRMATION SUMMARY BAR */}
            <div
              className="ui-card pad-4"
              style={{
                marginBottom: "24px",
                background: "var(--paper-2)",
                border: "1.5px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span className="ui-pill ui-pill-dark" style={{ fontSize: "12px" }}>
                  Profile Confirmed ✓
                </span>
                <strong style={{ fontSize: "15px" }}>{name}</strong>
                <span className="text-fine">· {language}</span>
              </div>
              <button
                type="button"
                onClick={() => setStage(1)}
                className="text-link"
                style={{ fontSize: "13px", border: "none", background: "none", cursor: "pointer" }}
              >
                Edit Profile ✎
              </button>
            </div>

            <div className="panel" style={{ marginBottom: "32px" }}>
              <div className="panel-header">
                <div>
                  <p className="zine-label">TEACHING ASSIGNMENTS</p>
                  <h2 style={{ fontSize: "20px" }}>Review Your Teaching Assignments</h2>
                  <p className="text-muted" style={{ fontSize: "14px", marginTop: "4px" }}>
                    Assignments are allocated by institutional administrators. If an assignment is incorrect, use the "This looks wrong" option to notify administration.
                  </p>
                </div>
              </div>

              {formError && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "20px",
                    border: "1.5px solid var(--border-strong)",
                    borderRadius: "var(--r-md)",
                    background: "#fff2f0",
                    color: "#990000",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  {formError}
                </div>
              )}

              {loading ? (
                <div style={{ padding: "32px", textAlign: "center" }}>
                  <span className="text-muted">Loading assigned sections...</span>
                </div>
              ) : sections.length === 0 ? (
                <div className="empty-block" style={{ padding: "32px" }}>
                  <p className="text-muted">No sections assigned yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {sections.map((sec) => (
                    <div
                      key={sec.id}
                      className="ui-card pad-5"
                      style={{
                        border: sec.flagged ? "1.5px dashed #990000" : "1.5px solid var(--border)",
                        background: sec.flagged ? "#fffcfb" : "var(--surface)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "17px" }}>{sec.name}</strong>
                            <span className="ui-pill">{sec.courseTitle}</span>
                            {sec.flagged && (
                              <span
                                className="ui-pill"
                                style={{
                                  background: "#fff0ed",
                                  borderColor: "#990000",
                                  color: "#990000",
                                  fontWeight: "600",
                                }}
                              >
                                Flagged for Admin Review
                              </span>
                            )}
                          </div>
                          <p className="text-fine" style={{ marginTop: "4px" }}>
                            Institution: {sec.institutionName} · Course ID: {sec.courseId}
                          </p>
                          {sec.flagged && sec.flagReason && (
                            <p
                              style={{
                                fontSize: "13px",
                                color: "#7a1a1a",
                                marginTop: "6px",
                                background: "#faebe8",
                                padding: "6px 10px",
                                borderRadius: "var(--r-sm)",
                              }}
                            >
                              <strong>Flag Note:</strong> {sec.flagReason}
                            </p>
                          )}
                        </div>

                        {/* THIS LOOKS WRONG TRIGGER */}
                        <div>
                          {sec.flagged ? (
                            <span className="text-fine" style={{ color: "var(--ink-2)" }}>
                              Flag submitted ✓
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenFlagModal(sec)}
                              className="text-link"
                              style={{
                                fontSize: "13px",
                                textDecoration: "underline",
                                cursor: "pointer",
                                border: "none",
                                background: "none",
                                padding: "4px 0",
                              }}
                            >
                              This looks wrong
                            </button>
                          )}
                        </div>
                      </div>

                      {/* OPTIONAL DEFAULT CLASS TIMING */}
                      <div
                        style={{
                          marginTop: "16px",
                          paddingTop: "14px",
                          borderTop: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <label
                          htmlFor={`timing-${sec.id}`}
                          style={{ fontSize: "13px", fontWeight: "600", minWidth: "160px" }}
                        >
                          Default Class Timing:
                        </label>
                        <input
                          id={`timing-${sec.id}`}
                          type="text"
                          className="ui-input"
                          style={{ flex: "1 1 240px", minHeight: "38px", fontSize: "14px" }}
                          value={timings[sec.id] || ""}
                          onChange={(e) => handleTimingChange(sec.id, e.target.value)}
                          placeholder="e.g. Mon, Wed · 09:00 AM – 10:30 AM (Optional)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STAGE 2 ACTION ROW */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
                padding: "24px 0",
              }}
            >
              <button
                type="button"
                onClick={() => setStage(1)}
                className="ui-button ui-button-secondary"
                style={{ minWidth: "160px" }}
              >
                ← Back to Profile
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="ui-button ui-button-primary"
                style={{ minWidth: "240px", fontSize: "15px" }}
              >
                {submitting ? "Claiming Account..." : "Claim Account & Enter Workspace →"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* MODAL: "THIS LOOKS WRONG" FLAGGING */}
      {flagModalSec && (
        <div className="ui-modal-overlay" role="dialog" aria-modal="true">
          <div className="ui-modal">
            <div className="ui-modal-header">
              <div>
                <p className="zine-label">FLAG ASSIGNMENT</p>
                <h3 style={{ marginTop: "4px" }}>Report Section Discrepancy</h3>
                <p>
                  Institutional policy does not permit direct edits to assigned teaching rosters. Your report will be routed to your department administrator for resolution.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseFlagModal}
                className="ui-button ui-button-icon"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitFlag}>
              <div className="ui-modal-body">
                <div
                  style={{
                    background: "var(--paper-2)",
                    padding: "12px 16px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span className="zine-caption" style={{ display: "block" }}>
                    SECTION DETAILS
                  </span>
                  <strong style={{ display: "block", marginTop: "2px" }}>
                    {flagModalSec.name}
                  </strong>
                  <span className="text-fine" style={{ color: "var(--ink-2)" }}>
                    {flagModalSec.courseTitle}
                  </span>
                </div>

                {flagSuccessMsg ? (
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "#eaf6ec",
                      color: "#166534",
                      borderRadius: "var(--r-md)",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    {flagSuccessMsg}
                  </div>
                ) : (
                  <div className="form-field">
                    <label htmlFor="flag-reason-input" className="form-label">
                      Reason for Flag <span style={{ color: "red" }}>*</span>
                    </label>
                    <textarea
                      id="flag-reason-input"
                      className="ui-textarea"
                      rows={4}
                      value={flagReason}
                      onChange={(e) => setFlagReason(e.target.value)}
                      placeholder="e.g. I am not scheduled to teach this section on Fridays, or this section belongs to another instructor."
                      required
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="ui-modal-footer">
                <button
                  type="button"
                  onClick={handleCloseFlagModal}
                  disabled={flagSubmitting}
                  className="ui-button ui-button-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={flagSubmitting || !flagReason.trim() || Boolean(flagSuccessMsg)}
                  className="ui-button ui-button-primary"
                >
                  {flagSubmitting ? "Submitting Flag..." : "Submit Flag to Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
