'use client';

import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

// Monochrome chart recipe: ink / mid-grey bars, hairline horizontal rules, 9px uppercase ticks.
const CHART = { ink: '#111', series2: '#555', muted: '#888', grid: '#e8e8e3', axis: '#d7d7d2', surface: '#fff' };

const TICK_STYLE = { fill: CHART.muted, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 };

const TOOLTIP_STYLE = {
  background: CHART.surface,
  border: `1px solid ${CHART.ink}`,
  borderRadius: 0,
  fontSize: 11,
  fontWeight: 700,
  color: CHART.ink,
  boxShadow: 'none'
};

export const AnalyticsView = () => {
  const { analytics } = useClassPulse();

  return (
    <>
      {/* Executive Telemetry Header Banner */}
      <section className="cp-page-header select-none">
        <div>
          <span className="cp-eyebrow">Performance Telemetry Engine • Real-Time Analytics</span>
          <h1 className="cp-display">
            Classroom Analytics & Insights
          </h1>
          <p className="cp-lead">
            Real-time comprehension trends, AI topic mastery, response speed metrics, and engagement telemetry across 40-minute lesson intervals.
          </p>
        </div>

        <div className="cp-page-actions">
          <div className="cp-status">
            <span className="cp-dot is-live" />
            <span>Telemetry Active</span>
          </div>
        </div>
      </section>

      {/* Executive Metrics Overview Grid */}
      <section className="cp-grid-stats select-none">
        {/* Card 1: Accuracy */}
        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">✓</span>
            <span className="cp-stat-arrow" aria-hidden="true">↗</span>
          </div>
          <span className="cp-stat-label">Class Accuracy</span>
          <span className="cp-stat-value">82.4%</span>
          <span className="cp-stat-detail">
            ↗ +6.8% vs last week
          </span>
        </div>

        {/* Card 2: Engagement */}
        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">□</span>
          </div>
          <span className="cp-stat-label">Student Engagement</span>
          <span className="cp-stat-value">91.2%</span>
          <span className="cp-stat-detail">
            38 / 40 Active Students
          </span>
        </div>

        {/* Card 3: Topics Covered */}
        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">▤</span>
          </div>
          <span className="cp-stat-label">Topics Covered</span>
          <span className="cp-stat-value is-sm">5 Modules</span>
          <span className="cp-stat-detail">
            Transcribed Today
          </span>
        </div>

        {/* Card 4: Response Speed */}
        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">▣</span>
          </div>
          <span className="cp-stat-label">Avg Response Speed</span>
          <span className="cp-stat-value is-sm">6.4 sec</span>
          <span className="cp-stat-detail">
            Fast Response Rate
          </span>
        </div>
      </section>

      {/* Chart: Per-Period Engagement & Accuracy Stream */}
      <section className="cp-panel select-none">
        <div className="cp-panel-header">
          <div>
            <span className="cp-eyebrow is-tight">Telemetry stream</span>
            <h3>
              Per-Topic Accuracy & Engagement Stream
            </h3>
            <p className="cp-caption mt-1">
              Comprehension trends and quiz participation telemetry across 40-minute lesson intervals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="cp-badge is-ink inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-white" /> Accuracy %
            </span>
            <span className="cp-badge inline-flex items-center gap-1.5">
              <span className="w-2 h-2" style={{ background: CHART.series2 }} /> Engagement %
            </span>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.periodAccuracy} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="0" />
              <XAxis dataKey="period" stroke={CHART.axis} tick={TICK_STYLE} tickLine={false} axisLine={{ stroke: CHART.axis }} />
              <YAxis stroke={CHART.axis} tick={TICK_STYLE} domain={[40, 100]} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: CHART.ink, strokeWidth: 1 }} />
              <Line type="linear" dataKey="accuracy" stroke={CHART.ink} strokeWidth={2} dot={{ r: 3, fill: CHART.ink, strokeWidth: 0 }} activeDot={{ r: 4, fill: CHART.ink, strokeWidth: 0 }} isAnimationActive={false} />
              <Line type="linear" dataKey="engagement" stroke={CHART.series2} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: CHART.series2, strokeWidth: 0 }} activeDot={{ r: 4, fill: CHART.series2, strokeWidth: 0 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Grid: Topic Mastery + Live Student Leaderboard */}
      <section className="cp-columns select-none">
        {/* Topic Mastery Bars */}
        <div className="cp-panel">
          <div className="cp-panel-header">
            <div>
              <span className="cp-eyebrow is-tight">Mastery</span>
              <h3>
                Topic Mastery Breakdown
              </h3>
              <p className="cp-caption mt-1">Student comprehension percentages by module.</p>
            </div>
            <span className="cp-badge">
              5 Key Modules
            </span>
          </div>

          <div className="space-y-5">
            {analytics.topicMastery.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center text-body font-bold text-ink mb-2">
                  <span>{item.topic}</span>
                  <span className={`cp-badge ${item.mastery >= 80 ? 'is-ink' : item.mastery >= 70 ? '' : 'is-muted'}`}>
                    {item.mastery}%
                  </span>
                </div>
                <div className="cp-progress is-thick">
                  <span
                    style={{ width: `${item.mastery}%`, opacity: item.mastery >= 80 ? 1 : item.mastery >= 70 ? 0.7 : 0.4 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Student Leaderboard */}
        <div className="cp-panel">
          <div className="cp-panel-header">
            <div>
              <span className="cp-eyebrow is-tight">Leaderboard</span>
              <h3>
                Quiz Score Rankings
              </h3>
              <p className="cp-caption mt-1">Anonymized student score leaderboard.</p>
            </div>
            <span className="cp-badge is-ink">
              Top Performers
            </span>
          </div>

          <div className="cp-list cp-list-bordered">
            {analytics.studentRankings.map((student) => (
              <div
                key={student.rank}
                className={`cp-row ${student.rank === 1 ? 'is-selected' : ''}`}
                style={{ minHeight: 56 }}
              >
                <span
                  className={`cp-chip-letter shrink-0 w-8 h-8 ${
                    student.rank <= 3 ? 'bg-ink text-white border-line-strong' : ''
                  }`}
                >
                  #{student.rank}
                </span>
                <div className="cp-row-content">
                  <span className="cp-row-title">{student.avatar} {student.name}</span>
                </div>
                <div className="cp-row-actions">
                  <span className="cp-badge">
                    {student.score} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
