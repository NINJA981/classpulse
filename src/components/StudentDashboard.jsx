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
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Student Zine Welcome Banner */}
      <div className="zine-card-mint p-6 space-y-3 zine-tape-top border-3 border-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-900 text-yellow-300 font-mono text-xs font-black uppercase tracking-wider mb-2 border border-slate-900 shadow-zine-sm">
              <GraduationCap className="w-4 h-4 text-emerald-300" />
              <span>STUDENT LEARNING PORTAL</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 font-zine-title tracking-tight">
              Hello, {currentUser.name}!
            </h2>
            <p className="text-sm font-handwriting text-slate-900 font-black mt-1">
              Roll No: {currentUser.rollNo || 'STU-1001'} • Enrolled in {studentClass} ({classroomInfo?.room})
            </p>
          </div>

          <button
            onClick={() => setActiveTab('projector')}
            className="px-5 py-3 bg-yellow-300 hover:bg-yellow-400 active:bg-yellow-500 text-slate-900 font-black rounded-xl border-2 border-slate-900 shadow-zine-interactive text-sm flex items-center gap-2 transition cursor-pointer"
          >
            <Tv2 className="w-5 h-5 text-slate-900" />
            <span>Join Live Classroom Quiz</span>
          </button>
        </div>
      </div>

      {/* Student Profile & Schedule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Student ID Card */}
        <div className="zine-card p-6 space-y-3 bg-white zine-tape-corner border-2 border-slate-900">
          <span className="text-xs font-mono font-black bg-slate-900 text-yellow-300 px-2.5 py-1 rounded uppercase tracking-wider inline-block">
            STUDENT IDENTITY CARD
          </span>
          <div className="flex items-center gap-3 pt-1">
            <div className="w-14 h-14 rounded-xl bg-yellow-300 border-2 border-slate-900 font-black text-slate-900 flex items-center justify-center text-2xl shadow-zine-sm">
              🎓
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 font-zine-title">{currentUser.name}</h3>
              <span className="text-xs font-mono font-black text-slate-900 bg-indigo-100 px-2 py-0.5 rounded border border-slate-900">
                {currentUser.rollNo || 'STU-1001'}
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-900 font-bold pt-3 border-t-2 border-slate-900 space-y-1.5">
            <div><strong>Section:</strong> <span className="bg-sky-100 px-1.5 py-0.5 rounded border border-slate-900">{studentClass}</span></div>
            <div><strong>Lead Teacher:</strong> {classroomInfo?.leadTeacher || 'Dr. Anitha'}</div>
            <div><strong>Class Location:</strong> {classroomInfo?.room || 'Science Lab 2'}</div>
          </div>
        </div>

        {/* Card 2: Today's Subject Schedule */}
        <div className="zine-card-yellow p-6 space-y-3 border-2 border-slate-900">
          <span className="text-xs font-mono font-black bg-slate-900 text-yellow-300 px-2.5 py-1 rounded uppercase tracking-wider inline-block">
            TODAY'S SCHEDULE
          </span>
          <h3 className="text-2xl font-black text-slate-900 font-zine-title">Biology & Chemistry</h3>
          <div className="space-y-1 text-xs font-black text-slate-900">
            <p className="bg-white p-2 rounded-lg border border-slate-900">⏰ 09:00 AM - Biology (Dr. Anitha)</p>
            <p className="bg-white p-2 rounded-lg border border-slate-900">⏰ 11:15 AM - Chemistry (Dr. Meena)</p>
          </div>
        </div>

        {/* Card 3: Live Quiz Status */}
        <div className="zine-card-sky p-6 space-y-3 border-2 border-slate-900">
          <span className="text-xs font-mono font-black bg-slate-900 text-yellow-300 px-2.5 py-1 rounded uppercase tracking-wider inline-block">
            ACTIVE QUIZ ROOM
          </span>
          <h3 className="text-2xl font-black text-slate-900 font-zine-title">Photosynthesis Check</h3>
          <p className="text-xs font-black text-slate-900">4 Multiple Choice Questions Ready</p>
          <button
            onClick={() => setActiveTab('projector')}
            className="text-sm font-black text-slate-900 flex items-center gap-1.5 pt-2 underline cursor-pointer hover:text-indigo-900"
          >
            <span>Enter Quiz Kiosk</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Class Timetable for Student */}
      <div className="zine-card p-6 space-y-4 bg-white border-2 border-slate-900">
        <h3 className="text-lg font-black text-slate-900 font-zine-title border-b-2 border-slate-900 pb-3 flex items-center justify-between">
          <span>My Class Timetable ({studentClass})</span>
          <span className="text-xs font-mono font-black bg-yellow-200 text-slate-900 px-3 py-1 rounded border-2 border-slate-900 shadow-zine-sm">
            WEEKLY SCHEDULE
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
            const slots = myTimetable[day] || [];
            return (
              <div key={day} className="p-4 bg-slate-50 border-2 border-slate-900 rounded-xl space-y-3 shadow-zine-sm">
                <div className="font-black text-slate-900 text-sm font-mono border-b-2 border-slate-900 pb-2 flex justify-between">
                  <span>📅 {day}</span>
                  <span className="bg-yellow-200 text-slate-900 px-2 py-0.5 rounded border border-slate-900 font-bold">{slots.length} Classes</span>
                </div>
                {slots.length === 0 ? (
                  <p className="text-xs font-handwriting text-slate-700 font-bold py-2">No scheduled classes for {day}.</p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {slots.map((s, i) => (
                      <div key={i} className="p-3 bg-white border-2 border-slate-900 rounded-xl text-xs space-y-1 hover:bg-yellow-50 transition">
                        <div className="font-black text-slate-900 text-sm">{s.subject}</div>
                        <div className="text-xs font-mono font-black text-slate-800 bg-sky-100 px-2 py-0.5 rounded border border-slate-900 inline-block">
                          ⏰ {s.time} • {s.teacher}
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
