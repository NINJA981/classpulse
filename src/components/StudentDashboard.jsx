import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  GraduationCap,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  BookOpen,
  UserCheck,
  CheckCircle2,
  Tv2
} from 'lucide-react';

export const StudentDashboard = () => {
  const { currentUser, timetables, setActiveTab, classrooms } = useClassPulse();

  const studentClass = currentUser.className || 'Grade 10-A';
  const myTimetable = timetables[studentClass] || {};
  const classroomInfo = classrooms.find(c => c.name === studentClass) || classrooms[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Student Zine Welcome Banner */}
      <div className="zine-card-mint p-6 space-y-3 zine-tape-top">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold uppercase tracking-wider mb-1">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-300" />
              <span>STUDENT LEARNING PORTAL</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 font-zine-title">
              Hello, {currentUser.name}!
            </h2>
            <p className="text-xs font-handwriting text-slate-700 font-bold">
              Roll No: {currentUser.rollNo || 'STU-1001'} • Enrolled in {studentClass} ({classroomInfo?.room})
            </p>
          </div>

          <button
            onClick={() => setActiveTab('projector')}
            className="px-4 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-slate-900 font-extrabold rounded-xl border-2 border-slate-900 shadow-zine-interactive text-xs flex items-center gap-2 transition cursor-pointer"
          >
            <Tv2 className="w-4 h-4 text-slate-900" />
            <span>Join Live Classroom Quiz</span>
          </button>
        </div>
      </div>

      {/* Student Profile & Schedule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Student ID Card */}
        <div className="zine-card p-5 space-y-3 bg-white zine-tape-corner">
          <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
            STUDENT IDENTITY CARD
          </span>
          <div className="flex items-center gap-3 pt-1">
            <div className="w-12 h-12 rounded-xl bg-yellow-300 border-2 border-slate-900 font-extrabold text-slate-900 flex items-center justify-center text-lg shadow-zine-sm">
              🎓
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-zine-title">{currentUser.name}</h3>
              <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-slate-900">{currentUser.rollNo || 'STU-1001'}</span>
            </div>
          </div>
          <div className="text-xs text-slate-700 font-medium pt-2 border-t-2 border-slate-900 space-y-1">
            <div><strong>Section:</strong> {studentClass}</div>
            <div><strong>Lead Teacher:</strong> {classroomInfo?.leadTeacher || 'Dr. Anitha'}</div>
            <div><strong>Location:</strong> {classroomInfo?.room || 'Science Lab 2'}</div>
          </div>
        </div>

        {/* Card 2: Today's Subject Schedule */}
        <div className="zine-card-yellow p-5 space-y-2">
          <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
            TODAY'S CLASS SCHEDULE
          </span>
          <h3 className="text-lg font-extrabold text-slate-900 font-zine-title">Biology & Chemistry</h3>
          <p className="text-xs font-bold text-slate-700">09:00 AM - Biology Lab (Dr. Anitha)</p>
          <p className="text-xs font-bold text-slate-700">11:15 AM - Chemistry (Dr. Meena)</p>
        </div>

        {/* Card 3: Live Quiz Status */}
        <div className="zine-card-sky p-5 space-y-2">
          <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
            ACTIVE QUIZ ROOM
          </span>
          <h3 className="text-lg font-extrabold text-slate-900 font-zine-title">Photosynthesis Check</h3>
          <p className="text-xs font-bold text-slate-700">4 Multiple Choice Questions Ready</p>
          <button
            onClick={() => setActiveTab('projector')}
            className="text-xs font-extrabold text-slate-900 flex items-center gap-1 pt-1 underline cursor-pointer"
          >
            <span>Enter Quiz Kiosk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Class Timetable for Student */}
      <div className="zine-card p-6 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 font-zine-title border-b-2 border-slate-900 pb-2 flex items-center justify-between">
          <span>My Class Timetable ({studentClass})</span>
          <span className="text-xs font-mono font-bold bg-yellow-200 px-2 py-0.5 rounded border border-slate-900">
            WEEKLY SCHEDULE
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
            const slots = myTimetable[day] || [];
            return (
              <div key={day} className="p-4 bg-slate-50 border-2 border-slate-900 rounded-xl space-y-2">
                <div className="font-extrabold text-slate-900 text-xs font-mono border-b-2 border-slate-900 pb-1 flex justify-between">
                  <span>📅 {day}</span>
                  <span className="text-slate-500">{slots.length} Classes</span>
                </div>
                {slots.length === 0 ? (
                  <p className="text-[11px] font-handwriting text-slate-500 py-2">No scheduled classes.</p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {slots.map((s, i) => (
                      <div key={i} className="p-2 bg-white border border-slate-900 rounded-lg text-xs">
                        <div className="font-bold text-slate-900">{s.subject}</div>
                        <div className="text-[10px] font-mono text-slate-600">{s.time} • {s.teacher}</div>
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
