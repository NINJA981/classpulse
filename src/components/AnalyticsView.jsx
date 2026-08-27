'use client';

import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  BarChart3,
  Trophy,
  Target,
  Users,
  TrendingUp,
  Brain,
  Sparkles,
  Layers,
  Activity,
  Zap,
  CheckCircle2
} from 'lucide-react';

export const AnalyticsView = () => {
  const { analytics } = useClassPulse();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans select-none text-slate-900 animate-portal-enter">
      {/* Executive Telemetry Header Banner */}
      <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                Performance Telemetry Engine
              </span>
              <span className="text-xs font-medium text-slate-500">• Real-Time Analytics</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Classroom Analytics & Insights
            </h1>
            <p className="text-xs font-normal text-slate-500 max-w-2xl">
              Real-time comprehension trends, AI topic mastery, response speed metrics, and engagement telemetry across 40-minute lesson intervals.
            </p>
          </div>

          <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl shrink-0">
            <Activity className="w-4 h-4 text-sky-600 animate-pulse" />
            <span>Telemetry Active</span>
          </div>
        </div>

        {/* Executive Metrics Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Accuracy */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Class Accuracy</span>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-300">
                <Target className="w-4 h-4 text-sky-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">82.4%</div>
            <span className="text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-sky-600" /> +6.8% vs last week
            </span>
          </div>

          {/* Card 2: Engagement */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Student Engagement</span>
              <div className="p-1.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                <Users className="w-4 h-4 text-sky-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">91.2%</div>
            <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 inline-block">
              38 / 40 Active Students
            </span>
          </div>

          {/* Card 3: Topics Covered */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Topics Covered</span>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-300">
                <Brain className="w-4 h-4 text-slate-800" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">5 Modules</div>
            <span className="text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-block">
              Transcribed Today
            </span>
          </div>

          {/* Card 4: Response Speed */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Avg Response Speed</span>
              <div className="p-1.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                <Zap className="w-4 h-4 text-sky-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">6.4 sec</div>
            <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 inline-block">
              Fast Response Rate
            </span>
          </div>
        </div>
      </div>

      {/* Chart: Per-Period Engagement & Accuracy Stream */}
      <div className="bg-white border border-slate-300 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-600" />
              Per-Topic Accuracy & Engagement Stream
            </h3>
            <p className="text-xs text-slate-500">
              Comprehension trends and quiz participation telemetry across 40-minute lesson intervals.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1 rounded-md font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-800" /> Accuracy %
            </span>
            <span className="flex items-center gap-1.5 bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1 rounded-md font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600" /> Engagement %
            </span>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.periodAccuracy} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e293b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1e293b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" stroke="#64748b" fontSize={11} fontWeight={500} />
              <YAxis stroke="#64748b" fontSize={11} fontWeight={500} domain={[40, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#0f172a',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area type="monotone" dataKey="accuracy" stroke="#1e293b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAccuracy)" />
              <Area type="monotone" dataKey="engagement" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEng)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Topic Mastery + Live Student Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Topic Mastery Bars */}
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Brain className="w-4 h-4 text-slate-800" />
                Topic Mastery Breakdown
              </h3>
              <p className="text-xs text-slate-500">Student comprehension percentages by module.</p>
            </div>
            <span className="text-xs font-semibold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-300">
              5 Key Modules
            </span>
          </div>

          <div className="space-y-4">
            {analytics.topicMastery.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-900">
                  <span>{item.topic}</span>
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    {item.mastery}%
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.mastery >= 80
                        ? 'bg-slate-800'
                        : item.mastery >= 70
                        ? 'bg-sky-600'
                        : 'bg-slate-400'
                    }`}
                    style={{ width: `${item.mastery}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Student Leaderboard */}
        <div className="lg:col-span-5 bg-white border border-slate-300 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-sky-600" />
                Quiz Score Rankings
              </h3>
              <p className="text-xs text-slate-500">Anonymized student score leaderboard.</p>
            </div>
            <span className="text-[11px] font-semibold bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200 uppercase">
              Top Performers
            </span>
          </div>

          <div className="space-y-2.5">
            {analytics.studentRankings.map((student) => (
              <div
                key={student.rank}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs font-medium"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      student.rank === 1
                        ? 'bg-slate-900 text-yellow-300 border border-slate-800 font-bold'
                        : student.rank === 2
                        ? 'bg-slate-200 text-slate-800 border border-slate-300 font-bold'
                        : student.rank === 3
                        ? 'bg-sky-100 text-sky-800 border border-sky-300 font-bold'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    #{student.rank}
                  </span>
                  <span className="text-slate-900 font-semibold">{student.avatar} {student.name}</span>
                </div>

                <span className="font-mono text-slate-800 font-bold bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-300">
                  {student.score} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
