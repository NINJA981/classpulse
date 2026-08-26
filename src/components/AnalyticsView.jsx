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
  Sparkles
} from 'lucide-react';

export const AnalyticsView = () => {
  const { analytics } = useClassPulse();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Top Zine Header Banner */}
      <div className="zine-card-yellow p-6 space-y-2 zine-tape-top">
        <div className="inline-flex items-center gap-2 bg-slate-900 text-yellow-300 px-2.5 py-0.5 rounded font-mono text-[11px] font-bold uppercase tracking-wider">
          <BarChart3 className="w-3.5 h-3.5 text-yellow-300" />
          <span>CLASSROOM PERFORMANCE ANALYTICS</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 font-zine-title tracking-tight flex items-center gap-2">
          Class Performance & Comprehension Analytics
        </h2>
        <p className="text-xs font-handwriting text-slate-700 font-bold max-w-2xl">
          Real-time insights on student comprehension, quiz response times, and topic mastery across class periods.
        </p>
      </div>

      {/* Top Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Accuracy */}
        <div className="zine-card p-5 space-y-2 bg-white">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 font-mono">
            <span>Class Accuracy</span>
            <div className="p-1.5 rounded-lg bg-emerald-200 border border-slate-900">
              <Target className="w-4 h-4 text-slate-900" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 font-zine-title">82.4%</p>
          <span className="text-[11px] text-emerald-900 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-slate-900 inline-flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-700" /> +6.8% vs last week
          </span>
        </div>

        {/* Card 2: Engagement */}
        <div className="zine-card-sky p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-900 font-mono">
            <span>Student Engagement</span>
            <div className="p-1.5 rounded-lg bg-white border border-slate-900">
              <Users className="w-4 h-4 text-slate-900" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 font-zine-title">91.2%</p>
          <span className="text-[11px] text-slate-900 font-bold bg-white px-2 py-0.5 rounded border border-slate-900 inline-block font-mono">
            38 / 40 Active Students
          </span>
        </div>

        {/* Card 3: Topics Taught */}
        <div className="zine-card-mint p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-900 font-mono">
            <span>Topics Covered</span>
            <div className="p-1.5 rounded-lg bg-white border border-slate-900">
              <Brain className="w-4 h-4 text-slate-900" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 font-zine-title">5 Topics</p>
          <span className="text-[11px] text-slate-900 font-bold bg-white px-2 py-0.5 rounded border border-slate-900 inline-block font-handwriting">
            Fully Transcribed Today
          </span>
        </div>

        {/* Card 4: Response Speed */}
        <div className="zine-card-pink p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-900 font-mono">
            <span>Avg Quiz Speed</span>
            <div className="p-1.5 rounded-lg bg-white border border-slate-900">
              <Sparkles className="w-4 h-4 text-slate-900" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 font-zine-title">6.4 sec</p>
          <span className="text-[11px] text-slate-900 font-bold bg-white px-2 py-0.5 rounded border border-slate-900 inline-block font-mono">
            Real-time Quiz Response
          </span>
        </div>
      </div>

      {/* Chart 1: Per-Period Engagement & Accuracy Stream */}
      <div className="zine-card p-6 space-y-4 bg-white zine-tape-corner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-900 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 font-zine-title flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-900" />
              Per-Topic Accuracy & Engagement Stream
            </h3>
            <p className="text-xs font-handwriting text-slate-600 font-bold">
              Tracking comprehension trends and quiz participation across lesson intervals.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono font-bold">
            <span className="flex items-center gap-1.5 bg-yellow-200 text-slate-900 px-2.5 py-1 rounded border border-slate-900">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900" /> Accuracy %
            </span>
            <span className="flex items-center gap-1.5 bg-sky-200 text-slate-900 px-2.5 py-1 rounded border border-slate-900">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600" /> Engagement %
            </span>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.periodAccuracy} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fde047" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#fef9c3" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#bae6fd" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#e0f2fe" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="period" stroke="#0f172a" fontSize={11} fontWeight={700} />
              <YAxis stroke="#0f172a" fontSize={11} fontWeight={700} domain={[40, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#faf7f2',
                  border: '2px solid #0f172a',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#0f172a',
                  boxShadow: '3px 3px 0px 0px #0f172a'
                }}
              />
              <Area type="monotone" dataKey="accuracy" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorAccuracy)" />
              <Area type="monotone" dataKey="engagement" stroke="#0284c7" strokeWidth={3} fillOpacity={1} fill="url(#colorEng)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Topic Mastery + Live Student Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Topic Mastery Bars */}
        <div className="lg:col-span-7 zine-card p-6 space-y-4 bg-white">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
            <h3 className="text-base font-extrabold text-slate-900 font-zine-title">Topic Mastery Breakdown</h3>
            <span className="text-xs font-mono font-bold bg-yellow-200 px-2 py-0.5 rounded border border-slate-900">
              5 Key Modules
            </span>
          </div>

          <div className="space-y-4">
            {analytics.topicMastery.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-900">
                  <span className="font-extrabold text-slate-900">{item.topic}</span>
                  <span className="font-mono bg-yellow-200 px-2 py-0.5 rounded border border-slate-900 text-slate-900">{item.mastery}%</span>
                </div>
                <div className="h-3.5 bg-slate-100 rounded-lg overflow-hidden border-2 border-slate-900 p-0.5">
                  <div
                    className={`h-full rounded transition-all duration-500 border border-slate-900 ${
                      item.mastery >= 80
                        ? 'bg-emerald-300'
                        : item.mastery >= 70
                        ? 'bg-sky-300'
                        : 'bg-yellow-300'
                    }`}
                    style={{ width: `${item.mastery}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Student Nickname Leaderboard */}
        <div className="lg:col-span-5 zine-card-yellow p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
            <h3 className="text-base font-extrabold text-slate-900 font-zine-title flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-700" />
              Live Quiz Leaderboard
            </h3>
            <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
              Nicknames Only
            </span>
          </div>

          <div className="space-y-2.5">
            {analytics.studentRankings.map((student) => (
              <div
                key={student.rank}
                className="p-3 rounded-xl bg-white border-2 border-slate-900 flex items-center justify-between text-xs font-bold shadow-zine-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-extrabold text-xs border-2 border-slate-900 ${
                      student.rank === 1
                        ? 'bg-yellow-300 text-slate-900 shadow-zine-sm'
                        : student.rank === 2
                        ? 'bg-sky-200 text-slate-900'
                        : student.rank === 3
                        ? 'bg-pink-200 text-slate-900'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    #{student.rank}
                  </span>
                  <span className="text-slate-900 font-extrabold">{student.avatar} {student.name}</span>
                </div>

                <span className="font-mono text-slate-900 font-extrabold bg-emerald-200 px-2 py-0.5 rounded border border-slate-900">
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
