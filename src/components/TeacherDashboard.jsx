import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  UserCheck,
  School,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Users,
  BrainCircuit,
  Radio
} from 'lucide-react';

export const TeacherDashboard = () => {
  const { currentUser, classrooms, timetables, setActiveTab, launchQuiz } = useClassPulse();

  const myClassroom = classrooms.find(c => c.leadTeacher === currentUser.name) || classrooms[0];
  const myTimetable = timetables[myClassroom.name] || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Teacher Zine Welcome Banner */}
      <div className="zine-card-sky p-6 space-y-3 zine-tape-top">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold uppercase tracking-wider mb-1">
              <UserCheck className="w-3.5 h-3.5 text-sky-300" />
              <span>TEACHER WORKBENCH</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 font-zine-title">
              Welcome back, {currentUser.name}!
            </h2>
            <p className="text-xs font-handwriting text-slate-700 font-bold">
              {currentUser.department || 'Science & Biology'} • Assigned Lead: {myClassroom.name} ({myClassroom.room})
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={launchQuiz}
              className="px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-slate-900 font-extrabold rounded-xl border-2 border-slate-900 shadow-zine-interactive text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-slate-900" />
              <span>Broadcast Live Quiz</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Assigned Classroom */}
        <div className="zine-card p-5 space-y-2 bg-white">
          <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
            PRIMARY CLASSROOM
          </span>
          <h3 className="text-lg font-extrabold text-slate-900 font-zine-title">{myClassroom.name}</h3>
          <p className="text-xs font-bold text-slate-600">{myClassroom.room} • {myClassroom.studentCount} Enrolled Students</p>
          <div className="pt-2">
            <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border border-slate-900 bg-emerald-200 text-slate-900">
              CLASSROOM ACTIVE
            </span>
          </div>
        </div>

        {/* Card 2: Today's Subject */}
        <div className="zine-card-yellow p-5 space-y-2">
          <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
            CURRENT SUBJECT
          </span>
          <h3 className="text-lg font-extrabold text-slate-900 font-zine-title">Biology & Photosynthesis</h3>
          <p className="text-xs font-bold text-slate-700">Light reactions & ATP synthesis overview</p>
          <button
            onClick={() => setActiveTab('quiz')}
            className="text-xs font-extrabold text-slate-900 flex items-center gap-1 pt-1 underline cursor-pointer"
          >
            <span>Prepare Quiz Questions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Timetable Quick Check */}
        <div className="zine-card-pink p-5 space-y-2">
          <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
            TODAY'S SCHEDULE
          </span>
          <h3 className="text-lg font-extrabold text-slate-900 font-zine-title">3 Sessions Scheduled</h3>
          <p className="text-xs font-bold text-slate-700">Next session: 11:15 AM (Science Lab 2)</p>
          <button
            onClick={() => setActiveTab('management')}
            className="text-xs font-extrabold text-slate-900 flex items-center gap-1 pt-1 underline cursor-pointer"
          >
            <span>View Full Weekly Timetable</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekly Timetable Preview */}
      <div className="zine-card p-6 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 font-zine-title border-b-2 border-slate-900 pb-2 flex items-center justify-between">
          <span>Weekly Timetable for {myClassroom.name}</span>
          <span className="text-xs font-mono font-bold bg-yellow-200 px-2 py-0.5 rounded border border-slate-900">
            INSTRUCTOR: {currentUser.name}
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {['Monday', 'Tuesday', 'Wednesday'].map((day) => {
            const slots = myTimetable[day] || [];
            return (
              <div key={day} className="p-4 bg-slate-50 border-2 border-slate-900 rounded-xl space-y-2">
                <div className="font-extrabold text-slate-900 text-xs font-mono border-b-2 border-slate-900 pb-1 flex justify-between">
                  <span>📅 {day}</span>
                  <span className="text-slate-500">{slots.length} Slots</span>
                </div>
                {slots.length === 0 ? (
                  <p className="text-[11px] font-handwriting text-slate-500 py-2">No sessions scheduled.</p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {slots.map((s, i) => (
                      <div key={i} className="p-2 bg-white border border-slate-900 rounded-lg text-xs">
                        <div className="font-bold text-slate-900">{s.subject}</div>
                        <div className="text-[10px] font-mono text-slate-600">{s.time} • {s.room}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
