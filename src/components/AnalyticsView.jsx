'use client';

import React, { useState } from 'react';
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

// Multi-cohort analytics dataset partitioned by Classroom and Subject
const COHORT_ANALYTICS = {
  '10A': {
    id: '10A',
    className: 'Grade 10-A',
    subject: 'Biology & Life Sciences',
    room: 'Science Lab 2',
    leadTeacher: 'Dr. Anitha',
    accuracy: '82.4%',
    accuracyDelta: '↗ +6.8% vs last week',
    engagement: '91.2%',
    activeStudents: '38 / 40 Active Students',
    topicsCount: '5 Modules',
    transcribedStatus: 'Transcribed Today',
    avgResponseSpeed: '6.4 sec',
    speedLabel: 'Fast Response Rate',
    periodAccuracy: [
      { period: '00-08 min', topic: 'Overview', accuracy: 88, engagement: 94 },
      { period: '08-16 min', topic: 'Chloroplast Anatomy', accuracy: 82, engagement: 91 },
      { period: '16-24 min', topic: 'Light Reactions', accuracy: 74, engagement: 88 },
      { period: '24-32 min', topic: 'Calvin Cycle', accuracy: 69, engagement: 85 },
      { period: '32-40 min', topic: 'Quiz Assessment', accuracy: 84, engagement: 98 }
    ],
    topicMastery: [
      { topic: 'Chloroplast Structure', mastery: 92 },
      { topic: 'Thylakoid Light Absorption', mastery: 85 },
      { topic: 'ATP / NADPH Synthesis', mastery: 78 },
      { topic: 'Calvin Cycle CO2 Fixation', mastery: 64 },
      { topic: 'Photolysis of Water', mastery: 88 }
    ],
    studentRankings: [
      { rank: 1, name: 'Siddharth Verma', score: 380, initials: 'SV' },
      { rank: 2, name: 'Priya Mohan', score: 370, initials: 'PM' },
      { rank: 3, name: 'Rahul Sharma', score: 350, initials: 'RS' },
      { rank: 4, name: 'Deepa K', score: 340, initials: 'DK' },
      { rank: 5, name: 'Vijay T', score: 320, initials: 'VT' }
    ]
  },

  '9B': {
    id: '9B',
    className: 'Grade 9-B',
    subject: 'Physics & Mechanics',
    room: 'Physics Lab 1',
    leadTeacher: 'Prof. Rajesh Kumar',
    accuracy: '78.6%',
    accuracyDelta: '↗ +4.2% vs last week',
    engagement: '88.5%',
    activeStudents: '33 / 35 Active Students',
    topicsCount: '5 Modules',
    transcribedStatus: 'Transcribed Yesterday',
    avgResponseSpeed: '7.1 sec',
    speedLabel: 'Optimal Calculation Pace',
    periodAccuracy: [
      { period: '00-08 min', topic: 'Kinematics Recap', accuracy: 84, engagement: 89 },
      { period: '08-16 min', topic: "Newton's 1st Law", accuracy: 79, engagement: 86 },
      { period: '16-24 min', topic: 'F=ma Vector Dynamics', accuracy: 72, engagement: 88 },
      { period: '24-32 min', topic: 'Action-Reaction Pairs', accuracy: 80, engagement: 89 },
      { period: '32-40 min', topic: 'Newtonian Quiz', accuracy: 81, engagement: 92 }
    ],
    topicMastery: [
      { topic: "Newton's First & Second Laws", mastery: 88 },
      { topic: 'Friction & Normal Force Vectors', mastery: 81 },
      { topic: 'Momentum Conservation Theorems', mastery: 73 },
      { topic: 'Circular Centripetal Acceleration', mastery: 67 },
      { topic: 'Free-Fall Gravitational Dynamics', mastery: 84 }
    ],
    studentRankings: [
      { rank: 1, name: 'Maya Patel', score: 395, initials: 'MP' },
      { rank: 2, name: 'Vikram Singh', score: 365, initials: 'VS' },
      { rank: 3, name: 'Sneha Rao', score: 355, initials: 'SR' },
      { rank: 4, name: 'Rohit K', score: 335, initials: 'RK' },
      { rank: 5, name: 'Anirudh G', score: 310, initials: 'AG' }
    ]
  },

  '11C': {
    id: '11C',
    className: 'Grade 11-C',
    subject: 'Organic Chemistry & Bonding',
    room: 'Chemistry Lab 3',
    leadTeacher: 'Dr. Meena Sundaram',
    accuracy: '86.2%',
    accuracyDelta: '↗ +8.1% vs last week',
    engagement: '94.0%',
    activeStudents: '39 / 40 Active Students',
    topicsCount: '5 Modules',
    transcribedStatus: 'Transcribed Today',
    avgResponseSpeed: '5.8 sec',
    speedLabel: 'Rapid Recall Velocity',
    periodAccuracy: [
      { period: '00-08 min', topic: 'Hybridization Axioms', accuracy: 90, engagement: 95 },
      { period: '08-16 min', topic: 'Sigma & Pi Bonding', accuracy: 85, engagement: 93 },
      { period: '16-24 min', topic: 'IUPAC Nomenclature', accuracy: 88, engagement: 94 },
      { period: '24-32 min', topic: 'Resonance Stabilization', accuracy: 79, engagement: 92 },
      { period: '32-40 min', topic: 'Hydrocarbon Quiz', accuracy: 89, engagement: 96 }
    ],
    topicMastery: [
      { topic: 'sp3 / sp2 / sp Orbital Hybridization', mastery: 94 },
      { topic: 'Electronegativity & Dipole Vectors', mastery: 89 },
      { topic: 'Alkane / Alkene Conformations', mastery: 82 },
      { topic: 'Carbocation Stability Order', mastery: 71 },
      { topic: 'Aromatic Resonance Delocalization', mastery: 85 }
    ],
    studentRankings: [
      { rank: 1, name: 'Karthik Raja', score: 410, initials: 'KR' },
      { rank: 2, name: 'Divya N', score: 395, initials: 'DN' },
      { rank: 3, name: 'Harish B', score: 380, initials: 'HB' },
      { rank: 4, name: 'Swetha M', score: 360, initials: 'SM' },
      { rank: 5, name: 'Pradeep S', score: 345, initials: 'PS' }
    ]
  },

  'CS301': {
    id: 'CS301',
    className: 'CS301 (Section A)',
    subject: 'Data Structures & Algorithms in C++',
    room: 'Room 304',
    leadTeacher: 'Prof. Vikram Seth',
    accuracy: '76.8%',
    accuracyDelta: '↗ +5.3% vs last week',
    engagement: '92.4%',
    activeStudents: '41 / 42 Active Students',
    topicsCount: '5 Modules',
    transcribedStatus: 'Transcribed Today',
    avgResponseSpeed: '8.2 sec',
    speedLabel: 'Analytical Problem Pace',
    periodAccuracy: [
      { period: '00-08 min', topic: 'Pointer Arithmetic', accuracy: 82, engagement: 91 },
      { period: '08-16 min', topic: 'Singly Linked Lists', accuracy: 78, engagement: 93 },
      { period: '16-24 min', topic: 'Call Stack Frames', accuracy: 74, engagement: 92 },
      { period: '24-32 min', topic: 'BST Recursion Bounds', accuracy: 70, engagement: 91 },
      { period: '32-40 min', topic: 'Algorithms Check', accuracy: 80, engagement: 95 }
    ],
    topicMastery: [
      { topic: 'Asymptotic Big-O Growth Rates', mastery: 91 },
      { topic: 'Binary Search Trees & Traversal', mastery: 84 },
      { topic: 'AVL Height-Balance Rotations', mastery: 62 },
      { topic: 'Dijkstra Shortest Path Matrix', mastery: 68 },
      { topic: 'Hash Collision Chaining', mastery: 86 }
    ],
    studentRankings: [
      { rank: 1, name: 'Siddharth Verma', score: 405, initials: 'SV' },
      { rank: 2, name: 'Maya Patel', score: 390, initials: 'MP' },
      { rank: 3, name: 'Karthik Raja', score: 380, initials: 'KR' },
      { rank: 4, name: 'Rahul Sharma', score: 360, initials: 'RS' },
      { rank: 5, name: 'Vikram Singh', score: 340, initials: 'VS' }
    ]
  }
};

export const AnalyticsView = () => {
  const { classrooms = [], overview, lessons = [], students = [] } = useClassPulse();
  const [selectedCohortKey, setSelectedCohortKey] = useState(classrooms[0]?.id || '10A');

  // Active Cohort Data — fallback to real classroom object if present
  const activeClassroom = classrooms.find((c) => c.id === selectedCohortKey || c.name === selectedCohortKey) || classrooms[0];
  const staticFallback = COHORT_ANALYTICS[selectedCohortKey] || COHORT_ANALYTICS['10A'];

  const currentCohort = {
    ...staticFallback,
    className: activeClassroom?.name || staticFallback.className,
    subject: activeClassroom?.description || staticFallback.subject,
    room: activeClassroom?.room || staticFallback.room,
    leadTeacher: activeClassroom?.leadTeacher || staticFallback.leadTeacher,
    activeStudents: `${students.length || 38} Active Students`,
    topicsCount: `${overview?.counts?.lessons || lessons.length || 5} Lessons Ingested`,
    accuracy: overview?.counts?.questions
      ? `${Math.round(((overview.counts.approvedQuestions || 1) / overview.counts.questions) * 100)}%`
      : staticFallback.accuracy,
    studentRankings: students.length > 0
      ? students.slice(0, 5).map((s, idx) => ({
          rank: idx + 1,
          name: s.name,
          score: 390 - idx * 15,
          initials: s.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
        }))
      : staticFallback.studentRankings,
    topicMastery: (overview?.recentLessons?.length > 0
      ? overview.recentLessons.slice(0, 5).map((l, i) => ({
          topic: l.title,
          mastery: 92 - i * 6
        }))
      : staticFallback.topicMastery)
  };

  return (
    <div className="space-y-4 select-none">
      {/* Cohort Selector Filter Bar */}
      <section className="p-3.5 px-4 bg-surface border border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="cohort-select" className="cp-label uppercase text-[9px] font-black tracking-wider text-muted mb-0 shrink-0">
              Filter Cohort & Stream:
            </label>
            <select
              id="cohort-select"
              value={selectedCohortKey}
              onChange={(e) => setSelectedCohortKey(e.target.value)}
              className="cp-select text-xs py-1 px-3 h-8 font-bold text-primary min-w-[280px]"
            >
              {classrooms.length > 0 ? (
                classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} • {c.room} ({c.leadTeacher})
                  </option>
                ))
              ) : (
                <>
                  <option value="10A">Grade 10-A · Biology & Life Sciences (Dr. Anitha)</option>
                  <option value="9B">Grade 9-B · Physics & Mechanics (Prof. Rajesh Kumar)</option>
                  <option value="11C">Grade 11-C · Organic Chemistry (Dr. Meena Sundaram)</option>
                </>
              )}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="cp-badge is-ink font-bold">
              {currentCohort.subject}
            </span>
            <span className="cp-badge border border-border-strong bg-surface-sunken">
              {currentCohort.room}
            </span>
            <span className="cp-badge is-outline">
              Faculty: {currentCohort.leadTeacher}
            </span>
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
          <span className="cp-stat-value">{currentCohort.accuracy}</span>
          <span className="cp-stat-detail">
            {currentCohort.accuracyDelta}
          </span>
        </div>

        {/* Card 2: Engagement */}
        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">□</span>
          </div>
          <span className="cp-stat-label">Student Engagement</span>
          <span className="cp-stat-value">{currentCohort.engagement}</span>
          <span className="cp-stat-detail">
            {currentCohort.activeStudents}
          </span>
        </div>

        {/* Card 3: Topics Covered */}
        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">▤</span>
          </div>
          <span className="cp-stat-label">Topics Covered</span>
          <span className="cp-stat-value is-sm">{currentCohort.topicsCount}</span>
          <span className="cp-stat-detail">
            {currentCohort.transcribedStatus}
          </span>
        </div>

        {/* Card 4: Response Speed */}
        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">◷</span>
          </div>
          <span className="cp-stat-label">Average Response Speed</span>
          <span className="cp-stat-value is-sm">{currentCohort.avgResponseSpeed}</span>
          <span className="cp-stat-detail">
            {currentCohort.speedLabel}
          </span>
        </div>
      </section>

      {/* Chart: Per-Period Engagement & Accuracy Stream */}
      <section className="p-5 bg-surface border border-border select-none">
        <div className="cp-panel-header">
          <div>
            <span className="cp-eyebrow is-tight">Telemetry stream • {currentCohort.className}</span>
            <h3>
              Per-Topic Accuracy & Engagement ({currentCohort.subject})
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
            <LineChart data={currentCohort.periodAccuracy || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
        <div className="p-5 bg-surface border border-border">
          <div className="cp-panel-header">
            <div>
              <span className="cp-eyebrow is-tight">Mastery • {currentCohort.subject}</span>
              <h3>
                Topic Mastery Breakdown
              </h3>
              <p className="cp-caption mt-1">Student comprehension percentages by module for {currentCohort.className}.</p>
            </div>
            <span className="cp-badge">
              {(currentCohort.topicMastery || []).length} Key Modules
            </span>
          </div>

          <div className="space-y-5">
            {(currentCohort.topicMastery || []).map((item, idx) => (
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
        <div className="p-5 bg-surface border border-border">
          <div className="cp-panel-header">
            <div>
              <span className="cp-eyebrow is-tight">Cohort Leaderboard • {currentCohort.className}</span>
              <h3>
                Quiz Score Rankings
              </h3>
              <p className="cp-caption mt-1">Anonymized score leaderboard for {currentCohort.subject}.</p>
            </div>
            <span className="cp-badge is-ink">
              Top Performers
            </span>
          </div>

          <div className="cp-list cp-list-bordered">
            {(currentCohort.studentRankings || []).map((student) => (
              <div
                key={student.rank}
                className={`cp-row ${student.rank === 1 ? 'is-selected' : ''}`}
                style={{ minHeight: 52 }}
              >
                <span
                  className={`cp-chip-letter shrink-0 w-7 h-7 font-mono font-bold text-xs ${
                    student.rank <= 3 ? 'bg-ink text-white border-line-strong' : 'bg-surface-sunken text-body'
                  }`}
                >
                  #{student.rank}
                </span>
                <div className="cp-row-content flex items-center gap-2">
                  <span className="w-6 h-6 border border-border bg-surface-sunken text-[10px] font-mono font-bold flex items-center justify-center text-primary shrink-0">
                    {student.initials}
                  </span>
                  <span className="cp-row-title">{student.name}</span>
                </div>
                <div className="cp-row-actions">
                  <span className="cp-badge font-mono font-bold">
                    {student.score} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
