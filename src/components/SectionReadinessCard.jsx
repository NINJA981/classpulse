import React, { useEffect, useState } from "react";
import { getMySections, getSectionReadiness } from "../onboardingApi.js";

export default function SectionReadinessCard() {
  const [sections, setSections] = useState([]);
  const [readinessData, setReadinessData] = useState({});
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const mySections = await getMySections();
        setSections(mySections);

        if (mySections.length > 0) {
          const firstId = mySections[0].id;
          setSelectedSectionId(firstId);

          // Load readiness for all sections
          const dataMap = {};
          await Promise.all(
            mySections.map(async (sec) => {
              const r = await getSectionReadiness(sec.id);
              dataMap[sec.id] = r;
            })
          );
          setReadinessData(dataMap);
        }
      } catch (err) {
        console.error("Failed to load section readiness:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="hypercard-static pad-5" style={{ minHeight: "160px" }}>
        <p className="zine-label">SECTION READINESS</p>
        <p className="text-muted" style={{ marginTop: "8px" }}>
          Loading aggregate diagnostic rollups...
        </p>
      </div>
    );
  }

  if (sections.length === 0) {
    return null;
  }

  const activeSection = sections.find((s) => s.id === selectedSectionId) || sections[0];
  const items = readinessData[activeSection?.id] || [];

  return (
    <div className="hypercard-static pad-6" style={{ background: "var(--surface)" }}>
      {/* HEADER & SECTION SELECTOR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <p className="zine-label">SECTION READINESS</p>
            <span
              className="ui-pill"
              style={{ fontSize: "11px", padding: "2px 8px", background: "var(--paper-2)" }}
            >
              Class-level rollup only · No PII
            </span>
          </div>
          <h3 style={{ fontSize: "20px", fontWeight: "700", marginTop: "4px" }}>
            Prerequisite Weakness Rollup
          </h3>
          <p className="text-muted" style={{ fontSize: "14px", marginTop: "2px" }}>
            Aggregated diagnostic checks reveal which foundational concepts need reinforcement before introducing advanced units.
          </p>
        </div>

        {/* SECTION TABS / SELECTOR */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSelectedSectionId(sec.id)}
              className={`ui-button ${
                sec.id === activeSection?.id ? "ui-button-primary" : "ui-button-secondary"
              }`}
              style={{
                minHeight: "36px",
                padding: "6px 14px",
                fontSize: "13px",
              }}
            >
              {sec.name}
            </button>
          ))}
        </div>
      </div>

      {/* AGGREGATE STATS CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {items.map((item, idx) => {
          const isHighWeakness = item.percentWeak >= 40;
          const isMediumWeakness = item.percentWeak >= 25 && item.percentWeak < 40;

          return (
            <div
              key={item.concept + idx}
              className="ui-card pad-4"
              style={{
                background: "var(--paper-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "8px",
                }}
              >
                <span className="zine-caption">FOUNDATIONAL PREREQUISITE</span>
                <span
                  className="ui-pill"
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    background: isHighWeakness ? "#fff0ed" : "var(--surface)",
                    borderColor: isHighWeakness ? "#990000" : "var(--border-medium)",
                    color: isHighWeakness ? "#990000" : "var(--ink)",
                  }}
                >
                  {isHighWeakness
                    ? "Priority Intervention"
                    : isMediumWeakness
                    ? "Moderate Gap"
                    : "Stable"}
                </span>
              </div>

              <strong style={{ fontSize: "16px", display: "block", marginBottom: "8px" }}>
                {item.concept}
              </strong>

              {/* STAT STATEMENT */}
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "var(--ink)",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontSize: "20px", fontWeight: "700", color: isHighWeakness ? "#990000" : "var(--ink)" }}>
                  {item.percentWeak}%
                </span>{" "}
                of this section is weak on {item.concept}
              </div>

              {/* VISUAL WEAKNESS BAR */}
              <div
                style={{
                  height: "8px",
                  background: "var(--track)",
                  borderRadius: "var(--r-pill)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${item.percentWeak}%`,
                    height: "100%",
                    background: isHighWeakness ? "#990000" : "var(--ink)",
                    transition: "width var(--t-normal) ease",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "8px",
                  fontSize: "12px",
                  color: "var(--ink-2)",
                }}
              >
                <span>Diagnostic sample: {item.totalAssessed || 50} students</span>
                <span>{100 - item.percentWeak}% proficient</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
