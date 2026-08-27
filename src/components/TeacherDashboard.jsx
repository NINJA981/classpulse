'use client';

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
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Teacher Zine Welcome Banner */}
      <div className="zine-card-sky p-6 space-y-3 zine-tape-top border-3 border-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-900 text-yellow-300 font-mono text-xs font-black uppercase tracking-wider mb-2 border border-slate-900 shadow-zine-sm">
              <UserCheck className="w-4 h-4 text-yellow-300" />
              <span>TEACHER WORKBENCH</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 font-zine-title tracking-tight">
              Welcome back, {currentUser.name}!
            </h2>
            <p className="text-sm font-handwriting text-slate-900 font-black mt-1">
              {currentUser.department || 'Science & Biology'} • Lead Instructor: {myClassroom.name} ({myClassroom.room})
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={launchQuiz}
              className="px-5 py-3 bg-yellow-300 hover:bg-yellow-400 active:bg-yellow-500 text-slate-900 font-black rounded-xl border-2 border-slate-900 shadow-zine-interactive text-sm flex items-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-slate-900" />
              <span>Broadcast Live Quiz</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Assigned Classroom */}
        <div className="zine-card p-6 space-y-3 bg-white border-2 border-slate-900">
          <span className="text-xs font-mono font-black bg-slate-900 text-yellow-300 px-2.5 py-1 rounded uppercase tracking-wider inline-block">
            PRIMARY CLASSROOM
          </span>
          <h3 className="text-2xl font-black text-slate-900 font-zine-title">{myClassroom.name}</h3>
          <p className="text-sm font-black text-slate-800">{myClassroom.room} • {myClassroom.studentCount} Enrolled Students</p>
          <div className="pt-2">
            <span className="px-3 py-1 rounded-full font-black text-xs uppercase border-2 border-slate-900 bg-emerald-200 text-slate-900 inline-block shadow-zine-sm">
              CLASSROOM ACTIVE
            </span>
          </div>
        </div>

        {/* Card 2: Today's Subject */}
        <div className="zine-card-yellow p-6 space-y-3 border-2 border-slate-900">
          <span className="text-xs font-mono font-black bg-slate-900 text-yellow-300 px-2.5 py-1 rounded uppercase tracking-wider inline-block">
            CURRENT SUBJECT
          </span>
          <h3 className="text-2xl font-black text-slate-900 font-zine-title">Biology & Photosynthesis</h3>
          <p className="text-sm font-black text-slate-900">Light reactions & ATP synthesis overview</p>
          <button
            onClick={() => setActiveTab('quiz')}
            className="text-sm font-black text-slate-900 flex items-center gap-1.5 pt-2 underline cursor-pointer hover:text-indigo-900"
          >
            <span>Prepare Quiz Questions</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 3: Timetable Quick Check */}
        <div className="zine-card-pink p-6 space-y-3 border-2 border-slate-900">
          <span className="text-xs font-mono font-black bg-slate-900 text-yellow-300 px-2.5 py-1 rounded uppercase tracking-wider inline-block">
            TODAY'S SCHEDULE
          </span>
          <h3 className="text-2xl font-black text-slate-900 font-zine-title">3 Sessions Scheduled</h3>
          <p className="text-sm font-black text-slate-900">Next session: 11:15 AM (Science Lab 2)</p>
          <button
            onClick={() => setActiveTab('management')}
            className="text-sm font-black text-slate-900 flex items-center gap-1.5 pt-2 underline cursor-pointer hover:text-indigo-900"
          >
            <span>View Full Weekly Timetable</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekly Timetable Preview */}
      <div className="zine-card p-6 space-y-4 bg-white border-2 border-slate-900">
        <h3 className="text-lg font-black text-slate-900 font-zine-title border-b-2 border-slate-900 pb-3 flex items-center justify-between">
          <span>Weekly Timetable for {myClassroom.name}</span>
          <span className="text-xs font-mono font-black bg-yellow-200 text-slate-900 px-3 py-1 rounded border-2 border-slate-900 shadow-zine-sm">
            INSTRUCTOR: {currentUser.name.toUpperCase()}
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {['Monday', 'Tuesday', 'Wednesday'].map((day) => {
            const slots = myTimetable[day] || [];
            return (
              <div key={day} className="p-4 bg-slate-50 border-2 border-slate-900 rounded-xl space-y-3 shadow-zine-sm">
                <div className="font-black text-slate-900 text-sm font-mono border-b-2 border-slate-900 pb-2 flex justify-between">
                  <span>📅 {day}</span>
                  <span className="bg-yellow-200 text-slate-900 px-2 py-0.5 rounded border border-slate-900 font-bold">{slots.length} Sessions</span>
                </div>
                {slots.length === 0 ? (
                  <p className="text-xs font-handwriting text-slate-700 font-bold py-2">No sessions scheduled for {day}.</p>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    {slots.map((s, i) => (
                      <div key={i} className="p-3 bg-white border-2 border-slate-900 rounded-xl text-xs space-y-1 hover:bg-yellow-50 transition">
                        <div className="font-black text-slate-900 text-sm">{s.subject}</div>
                        <div className="text-xs font-mono font-black text-slate-800 bg-sky-100 px-2 py-0.5 rounded border border-slate-900 inline-block">
                          ⏰ {s.time} • {s.room}
                        </div>
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
