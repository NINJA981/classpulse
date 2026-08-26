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
  HardDrive
} from 'lucide-react';

export const AnalyticsView = () => {
  const { analytics } = useClassPulse();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* HyperCard Window Title Bar & Shoebox Stack Header */}
      <div className="hypercard-stack overflow-hidden">
        {/* Macintosh Window Title Bar */}
        <div className="bg-[#d5cfbf] border-b-2 border-black px-4 py-2 flex items-center justify-between font-mono text-xs font-bold select-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-black bg-white flex items-center justify-center font-bold text-[9px]">■</div>
            <span className="font-hypercard-header uppercase tracking-wider text-black">HYPERCARD STACK v2.0 • ANALYTICS SHOEBOX INDEX</span>
          </div>

          <div className="mac-title-bar h-3.5 w-32 border border-black hidden sm:block"></div>

          <div className="flex items-center gap-2 font-mono text-xs font-bold text-black">
            <span>PERFORMANCE INDEX</span>
          </div>
        </div>

        {/* HyperCard Shoebox Header Controls */}
        <div className="p-5 bg-[#f7f4ed] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="font-hypercard-pixel text-lg bg-black text-white px-2 py-0.5 rounded inline-block mb-1">
                🗂️ CLASS PERFORMANCE ANALYTICAL STACK
              </span>
              <h2 className="text-2xl font-black text-black font-hypercard-header uppercase tracking-tight flex items-center gap-2">
                Class Analytics Index
              </h2>
              <p className="text-xs font-mono font-bold text-slate-800">
                Organized Analytical Index: Real-time insights on student comprehension, quiz speed, and topic mastery across class periods.
              </p>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs font-bold bg-yellow-200 border-2 border-black px-3 py-1.5 rounded-lg shadow-[2px_2px_0px_0px_#000] shrink-0">
              <HardDrive className="w-4 h-4 text-black" />
              <span>LIVE TELEMETRY STREAM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* Card 1: Accuracy */}
        <div className="hypercard-card p-5 space-y-2 bg-white">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Class Accuracy</span>
            <div className="p-1 rounded bg-yellow-200 border border-black">
              <Target className="w-4 h-4 text-black" />
            </div>
          </div>
          <p className="text-3xl font-hypercard-header font-black text-black">82.4%</p>
          <span className="text-[10px] text-black font-bold bg-emerald-200 px-2 py-0.5 border border-black inline-flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-black" /> +6.8% vs last week
          </span>
        </div>

        {/* Card 2: Engagement */}
        <div className="hypercard-card-sky p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-black">
            <span>Student Engagement</span>
            <div className="p-1 rounded bg-white border border-black">
              <Users className="w-4 h-4 text-black" />
            </div>
          </div>
          <p className="text-3xl font-hypercard-header font-black text-black">91.2%</p>
          <span className="text-[10px] text-black font-bold bg-white px-2 py-0.5 border border-black inline-block">
            38 / 40 Active Students
          </span>
        </div>

        {/* Card 3: Topics Covered */}
        <div className="hypercard-card-mint p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-black">
            <span>Topics Covered</span>
            <div className="p-1 rounded bg-white border border-black">
              <Brain className="w-4 h-4 text-black" />
            </div>
          </div>
          <p className="text-3xl font-hypercard-header font-black text-black">5 Topics</p>
          <span className="text-[10px] text-black font-bold bg-white px-2 py-0.5 border border-black inline-block">
            Fully Transcribed Today
          </span>
        </div>

        {/* Card 4: Response Speed */}
        <div className="hypercard-card p-5 space-y-2 bg-[#fff1f2]">
          <div className="flex items-center justify-between text-xs font-bold text-black">
            <span>Avg Quiz Speed</span>
            <div className="p-1 rounded bg-white border border-black">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
          </div>
          <p className="text-3xl font-hypercard-header font-black text-black">6.4 sec</p>
          <span className="text-[10px] text-black font-bold bg-white px-2 py-0.5 border border-black inline-block">
            Real-time Response Time
          </span>
        </div>
      </div>

      {/* Chart 1: Per-Period Engagement & Accuracy Stream */}
      <div className="hypercard-card p-6 space-y-4 bg-white font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
          <div>
            <h3 className="text-base font-hypercard-header text-black flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-black" />
              Per-Topic Accuracy & Engagement Stream
            </h3>
            <p className="text-xs text-slate-800">
              Tracking comprehension trends and quiz participation across 40-minute lesson intervals.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono font-bold">
            <span className="flex items-center gap-1.5 bg-yellow-200 text-black px-2 py-1 border border-black">
              <span className="w-2.5 h-2.5 rounded-full bg-black" /> Accuracy %
            </span>
            <span className="flex items-center gap-1.5 bg-sky-200 text-black px-2 py-1 border border-black">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600" /> Engagement %
            </span>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.periodAccuracy} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fde047" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="#fffbeb" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#bae6fd" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="#f0f9ff" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#000000" strokeOpacity={0.15} />
              <XAxis dataKey="period" stroke="#000000" fontSize={11} fontWeight={700} />
              <YAxis stroke="#000000" fontSize={11} fontWeight={700} domain={[40, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '2px solid #000000',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#000000',
                  boxShadow: '3px 3px 0px 0px #000000'
                }}
              />
              <Area type="monotone" dataKey="accuracy" stroke="#000000" strokeWidth={3} fillOpacity={1} fill="url(#colorAccuracy)" />
              <Area type="monotone" dataKey="engagement" stroke="#0284c7" strokeWidth={3} fillOpacity={1} fill="url(#colorEng)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Topic Mastery + Live Student Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
        {/* Topic Mastery Bars */}
        <div className="lg:col-span-7 hypercard-card p-6 space-y-4 bg-white">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <h3 className="text-base font-hypercard-header text-black">Topic Mastery Breakdown</h3>
            <span className="text-xs font-bold bg-yellow-200 px-2 py-0.5 border border-black">
              5 Key Modules
            </span>
          </div>

          <div className="space-y-4">
            {analytics.topicMastery.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-black">
                  <span>{item.topic}</span>
                  <span className="font-mono bg-yellow-200 px-2 py-0.5 border border-black text-black">{item.mastery}%</span>
                </div>
                <div className="h-3.5 bg-[#f7f4ed] border-2 border-black rounded p-0.5 shadow-[1px_1px_0px_0px_#000]">
                  <div
                    className={`h-full rounded border border-black transition-all duration-500 ${
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
        <div className="lg:col-span-5 hypercard-card-yellow p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <h3 className="text-base font-hypercard-header text-black flex items-center gap-2">
              <Trophy className="w-4 h-4 text-black" />
              Live Quiz Leaderboard
            </h3>
            <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded uppercase">
              Nicknames Only
            </span>
          </div>

          <div className="space-y-2.5">
            {analytics.studentRankings.map((student) => (
              <div
                key={student.rank}
                className="p-3 rounded-lg bg-white border-2 border-black flex items-center justify-between text-xs font-bold shadow-[2px_2px_0px_0px_#000]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded border-2 border-black flex items-center justify-center font-hypercard-header text-xs ${
                      student.rank === 1
                        ? 'bg-yellow-300 text-black shadow-[1px_1px_0px_0px_#000]'
                        : student.rank === 2
                        ? 'bg-sky-200 text-black'
                        : student.rank === 3
                        ? 'bg-rose-200 text-black'
                        : 'bg-[#f7f4ed] text-slate-700'
                    }`}
                  >
                    #{student.rank}
                  </span>
                  <span className="text-black font-bold">{student.avatar} {student.name}</span>
                </div>

                <span className="font-mono text-black font-bold bg-emerald-200 px-2 py-0.5 border border-black">
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
