import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getConceptProposals,
  validateConceptDecisions,
  getCourseStatus,
} from "./onboardingApi.js";

export default function ConceptValidation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("courseId") || "cs-201";

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState({}); // { [edgeId]: 'yes' | 'no' | 'skip' }
  const [isCompleted, setIsCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summaryResult, setSummaryResult] = useState(null);

  // Load proposals in original order (lowest-confidence-first)
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [courseData, proposalsData] = await Promise.all([
          getCourseStatus(courseId),
          getConceptProposals(courseId),
        ]);
        setCourse(courseData);
        setProposals(proposalsData);
      } catch (err) {
        console.error("Failed to load concept proposals:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [courseId]);

  const currentProposal = proposals[currentIndex];
  const totalQuestions = proposals.length;
  const answeredCount = Object.keys(decisions).length;

  const handleDecision = useCallback(
    (decisionType) => {
      if (!currentProposal) return;

      const updated = {
        ...decisions,
        [currentProposal.edgeId]: decisionType,
      };
      setDecisions(updated);

      if (currentIndex + 1 < totalQuestions) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Last question reached
        completeValidation(updated);
      }
    },
    [currentProposal, currentIndex, totalQuestions, decisions]
  );

  const completeValidation = async (finalDecisionsMap) => {
    setIsCompleted(true);
    setSubmitting(true);

    try {
      const decisionList = proposals.map((p) => ({
        edgeId: p.edgeId,
        decision: finalDecisionsMap[p.edgeId] || "skip",
      }));

      const result = await validateConceptDecisions(courseId, decisionList);
      setSummaryResult(result);
    } catch (err) {
      console.error("Failed to submit concept validations:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleReviewSkipped = () => {
    // Find the first skipped index
    const firstSkippedIndex = proposals.findIndex(
      (p) => decisions[p.edgeId] === "skip" || !decisions[p.edgeId]
    );
    if (firstSkippedIndex !== -1) {
      setCurrentIndex(firstSkippedIndex);
      setIsCompleted(false);
    }
  };

  // Keyboard shortcut support for quick, ritualized review
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isCompleted || loading || !currentProposal) return;

      // Ignore if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      if (key === "y" || key === "1") {
        handleDecision("yes");
      } else if (key === "n" || key === "2") {
        handleDecision("no");
      } else if (key === "s" || key === "3" || key === " ") {
        e.preventDefault();
        handleDecision("skip");
      } else if (key === "arrowleft" || key === "backspace") {
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDecision, isCompleted, loading, currentProposal]);

  if (loading) {
    return (
      <div
        className="tactile-paper"
        style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ textAlign: "center" }}>
          <p className="zine-label">CONCEPT GRAPH RITUAL</p>
          <h2 style={{ marginTop: "8px" }}>Loading prerequisite proposals...</h2>
        </div>
      </div>
    );
  }

  // COMPLETION SCREEN
  if (isCompleted && summaryResult) {
    const { confirmed, rejected, skipped, total, decidedRate, isThresholdMet } = summaryResult;

    return (
      <div
        className="tactile-paper"
        style={{
          minHeight: "100vh",
          padding: "48px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="ui-modal"
          style={{
            maxWidth: "680px",
            border: "2px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
            padding: "36px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <p className="zine-label">10-MINUTE RITUAL COMPLETE</p>
            <h1 style={{ fontSize: "28px", marginTop: "8px", fontWeight: "700" }}>
              Concept Graph Review Summary
            </h1>
            <p className="text-muted" style={{ marginTop: "6px" }}>
              {course?.code}: {course?.title}
            </p>
          </div>

          {/* STATUS BANNER */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "var(--r-md)",
              border: "1.5px solid var(--border-strong)",
              background: isThresholdMet ? "var(--surface)" : "var(--paper-2)",
              marginBottom: "28px",
              textAlign: "center",
            }}
          >
            <span
              className="ui-pill"
              style={{
                background: isThresholdMet ? "var(--ink-strong)" : "var(--surface)",
                color: isThresholdMet ? "var(--on-ink)" : "var(--ink)",
                fontWeight: "700",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              {isThresholdMet ? "VALIDATED THRESHOLD REACHED (≥80%)" : "THRESHOLD NOT MET (<80%)"}
            </span>
            <h3 style={{ fontSize: "20px", marginTop: "6px" }}>
              {isThresholdMet
                ? "Course Concept Graph Certified"
                : "Additional Review Recommended"}
            </h3>
            <p className="card-body" style={{ fontSize: "14px", marginTop: "6px", color: "var(--ink-2)" }}>
              {isThresholdMet
                ? `${decidedRate}% of proposals decided. The syllabus dependency structure is now verified and active for student diagnostic readiness rollups.`
                : `${decidedRate}% of proposals decided (${decidedCountLabel(
                    confirmed,
                    rejected
                  )} out of ${total}). 80% decided rate is required to automatically calibrate diagnostic assessments.`}
            </p>
          </div>

          {/* METRIC TILES */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "12px",
              marginBottom: "28px",
            }}
          >
            <div
              className="hypercard-static"
              style={{ padding: "16px 12px", textAlign: "center" }}
            >
              <p className="zine-label">CONFIRMED</p>
              <p style={{ fontSize: "28px", fontWeight: "700", marginTop: "4px" }}>
                {confirmed}
              </p>
              <span className="text-fine">Yes</span>
            </div>

            <div
              className="hypercard-static"
              style={{ padding: "16px 12px", textAlign: "center" }}
            >
              <p className="zine-label">REJECTED</p>
              <p style={{ fontSize: "28px", fontWeight: "700", marginTop: "4px" }}>
                {rejected}
              </p>
              <span className="text-fine">No</span>
            </div>

            <div
              className="hypercard-static"
              style={{ padding: "16px 12px", textAlign: "center" }}
            >
              <p className="zine-label">SKIPPED</p>
              <p style={{ fontSize: "28px", fontWeight: "700", marginTop: "4px" }}>
                {skipped}
              </p>
              <span className="text-fine">Deferred</span>
            </div>

            <div
              className="hypercard-static"
              style={{ padding: "16px 12px", textAlign: "center" }}
            >
              <p className="zine-label">DECIDED</p>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  marginTop: "4px",
                  color: isThresholdMet ? "var(--ink)" : "#990000",
                }}
              >
                {decidedRate}%
              </p>
              <span className="text-fine">Goal: 80%</span>
            </div>
          </div>

          {/* ACTIONS */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border)",
            }}
          >
            {skipped > 0 && (
              <button
                type="button"
                onClick={handleReviewSkipped}
                className="ui-button ui-button-secondary"
              >
                ↺ Review Skipped Pairs ({skipped})
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate("/")}
              className="ui-button ui-button-primary"
              style={{ marginLeft: "auto" }}
            >
              Return to Dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PROGRESS COMPUTATION
  const progressPercent =
    totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;
  const currentDecision = currentProposal ? decisions[currentProposal.edgeId] : null;

  return (
    <div
      className="tactile-paper"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "24px 32px",
      }}
    >
      {/* TOP BAR */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "16px",
          borderBottom: "1.5px solid var(--border-strong)",
          maxWidth: "880px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link to="/" className="text-link" style={{ fontSize: "14px", fontWeight: "600" }}>
            ← Exit Ritual
          </Link>
          <span style={{ color: "var(--border-medium)" }}>|</span>
          <div>
            <p className="zine-label">10-MINUTE RITUAL · GRAPH VALIDATION</p>
            <strong style={{ fontSize: "15px" }}>
              {course?.code}: {course?.title}
            </strong>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="ui-pill ui-pill-dark">
            {currentIndex + 1} of {totalQuestions} reviewed
          </span>
        </div>
      </header>

      {/* CENTER ONE-QUESTION CARD */}
      <main
        style={{
          maxWidth: "760px",
          width: "100%",
          margin: "32px auto",
          flex: "1 0 auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* PROGRESS TRACK */}
        <div style={{ marginBottom: "20px" }}>
          <div
            className="progress-track"
            style={{
              height: "6px",
              background: "var(--track)",
              borderRadius: "var(--r-pill)",
              overflow: "hidden",
            }}
          >
            <div
              className="progress-fill"
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "var(--ink)",
                transition: "width var(--t-normal) ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "6px",
              fontSize: "12px",
              color: "var(--ink-2)",
            }}
          >
            <span>Lowest confidence proposals first</span>
            <span>{progressPercent}% completed</span>
          </div>
        </div>

        {/* QUESTION CARD */}
        {currentProposal && (
          <div
            className="hypercard-static"
            style={{
              padding: "40px",
              border: "2px solid var(--border-strong)",
              boxShadow: "var(--shadow-md)",
              position: "relative",
            }}
          >
            {/* CONFIDENCE & SORTING BADGE */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <span className="zine-label">PREREQUISITE PAIR #{currentIndex + 1}</span>

              <span
                className="ui-pill"
                style={{
                  border: "1px solid var(--border-strong)",
                  fontSize: "12px",
                  background: currentProposal.confidence < 0.5 ? "#fff4f2" : "#f5f5f0",
                  color: currentProposal.confidence < 0.5 ? "#990000" : "var(--ink)",
                }}
              >
                Model Confidence: {Math.round(currentProposal.confidence * 100)}%
                {currentProposal.confidence < 0.5 && " (Uncertain — Review Needed)"}
              </span>
            </div>

            {/* CORE QUESTION STATEMENT */}
            <div style={{ textAlign: "center", padding: "16px 0 28px" }}>
              <p
                className="zine-caption"
                style={{ textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}
              >
                Dependency Proposal
              </p>

              <h2
                style={{
                  fontSize: "30px",
                  lineHeight: "1.3",
                  fontWeight: "700",
                  letterSpacing: "-0.02em",
                }}
              >
                Does <span style={{ textDecoration: "underline", textUnderlineOffset: "6px" }}>{currentProposal.toConcept}</span> require{" "}
                <span style={{ textDecoration: "underline", textUnderlineOffset: "6px" }}>{currentProposal.fromConcept}</span>?
              </h2>

              <p
                className="card-body"
                style={{
                  maxWidth: "560px",
                  margin: "18px auto 0",
                  color: "var(--ink-2)",
                  fontSize: "15px",
                }}
              >
                Should students have mastered <strong>{currentProposal.fromConcept}</strong> before
                being introduced to <strong>{currentProposal.toConcept}</strong>?
              </p>
            </div>

            {/* TACTILE DECISION BUTTONS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "16px",
                marginTop: "16px",
              }}
            >
              {/* YES BUTTON */}
              <button
                type="button"
                onClick={() => handleDecision("yes")}
                className={`ui-button ${
                  currentDecision === "yes" ? "ui-button-primary" : "ui-button-tactile"
                }`}
                style={{
                  minHeight: "56px",
                  fontSize: "16px",
                  fontWeight: "700",
                  background: currentDecision === "yes" ? "var(--ink)" : "var(--surface)",
                  color: currentDecision === "yes" ? "var(--on-ink)" : "var(--ink)",
                }}
              >
                ✓ Yes (Requires)
              </button>

              {/* NO BUTTON */}
              <button
                type="button"
                onClick={() => handleDecision("no")}
                className={`ui-button ${
                  currentDecision === "no" ? "ui-button-primary" : "ui-button-tactile"
                }`}
                style={{
                  minHeight: "56px",
                  fontSize: "16px",
                  fontWeight: "700",
                  background: currentDecision === "no" ? "var(--ink)" : "var(--surface)",
                  color: currentDecision === "no" ? "var(--on-ink)" : "var(--ink)",
                }}
              >
                ✕ No (Independent)
              </button>

              {/* SKIP BUTTON */}
              <button
                type="button"
                onClick={() => handleDecision("skip")}
                className={`ui-button ${
                  currentDecision === "skip" ? "ui-button-primary" : "ui-button-secondary"
                }`}
                style={{
                  minHeight: "56px",
                  fontSize: "16px",
                  fontWeight: "500",
                }}
              >
                Skip / Unsure
              </button>
            </div>

            {/* KEYBOARD SHORTCUTS LEGEND */}
            <div
              style={{
                marginTop: "24px",
                paddingTop: "16px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "12px",
                color: "var(--ink-3)",
              }}
            >
              <div>
                <span>Shortcuts: </span>
                <kbd style={kbdStyle}>Y</kbd> Yes &nbsp;
                <kbd style={kbdStyle}>N</kbd> No &nbsp;
                <kbd style={kbdStyle}>S</kbd> Skip
              </div>

              <div>
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="text-link"
                    style={{ fontSize: "12px", border: "none", background: "none", cursor: "pointer" }}
                  >
                    ← Previous Question
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER STATS */}
      <footer
        style={{
          maxWidth: "880px",
          width: "100%",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "16px",
          borderTop: "1px solid var(--border)",
          fontSize: "13px",
          color: "var(--ink-2)",
        }}
      >
        <span>
          Answered: {answeredCount} of {totalQuestions} pairs
        </span>
        <button
          type="button"
          onClick={() => completeValidation(decisions)}
          className="text-link"
          style={{
            fontSize: "13px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Finish Ritual Early →
        </button>
      </footer>
    </div>
  );
}

function decidedCountLabel(confirmed, rejected) {
  return `${confirmed + rejected} decided`;
}

const kbdStyle = {
  display: "inline-block",
  padding: "2px 6px",
  fontFamily: "monospace",
  fontSize: "11px",
  backgroundColor: "var(--paper-2)",
  border: "1px solid var(--border-medium)",
  borderRadius: "4px",
  boxShadow: "0 1px 0 rgba(0,0,0,0.2)",
};
