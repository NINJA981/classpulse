import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
  Sparkles
} from 'lucide-react';

export const AnalyticsView = () => {
  const { analytics } = useClassPulse();

  return (
    <div className="space-y-6">
      {/* Top Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-slate-200 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Overall Class Accuracy</span>
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">82.4%</p>
          <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-600" /> +6.8% vs last week
          </span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Student Engagement</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">91.2%</p>
          <span className="text-[11px] text-indigo-700 font-semibold">38/40 Active Participants</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Topics Taught Today</span>
            <Brain className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">5 Topics</p>
          <span className="text-[11px] text-purple-700 font-semibold">Fully Transcribed</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Avg Quiz Response Time</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">6.4s</p>
          <span className="text-[11px] text-slate-600 font-semibold">Real-time WebSocket score</span>
        </div>
      </div>

      {/* Chart 1: Per-Period Engagement & Accuracy Stream */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Per-Topic Accuracy & Engagement (40-Minute Class Period)
            </h3>
            <p className="text-xs text-slate-500">Tracking comprehension trends and quiz participation across lesson intervals</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-indigo-700">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Accuracy %
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Engagement %
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.periodAccuracy} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} domain={[40, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', fontSize: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}
              />
              <Area type="monotone" dataKey="accuracy" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAccuracy)" />
              <Area type="monotone" dataKey="engagement" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEng)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Topic Mastery + Live Student Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Topic Mastery Bars */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-6 border border-slate-200 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">Topic Mastery Breakdown</h3>

          <div className="space-y-3">
            {analytics.topicMastery.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{item.topic}</span>
                  <span className="text-indigo-700 font-mono">{item.mastery}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.mastery >= 80
                        ? 'bg-emerald-600'
                        : item.mastery >= 70
                        ? 'bg-indigo-600'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${item.mastery}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Student Nickname Leaderboard */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-6 border border-slate-200 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Live Quiz Leaderboard
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Nicknames only</span>
          </div>

          <div className="space-y-2.5">
            {analytics.studentRankings.map((student) => (
              <div
                key={student.rank}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-semibold"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[11px] ${
                      student.rank === 1
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : student.rank === 2
                        ? 'bg-slate-200 text-slate-800 border border-slate-300'
                        : student.rank === 3
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    #{student.rank}
                  </span>
                  <span className="text-slate-900">{student.avatar} {student.name}</span>
                </div>

                <span className="font-mono text-indigo-700 font-bold">{student.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
