'use client';

import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  School,
  Calendar,
  UserCheck,
  GraduationCap,
  Clock,
  Search,
  Users,
  Building,
  ArrowLeft,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const TeacherClassroomView = () => {
  const {
    classrooms,
    students,
    timetables,
    currentUser
  } = useClassPulse();

  // Find instructor's primary assigned class
  const myClassroom = classrooms.find(c => c.leadTeacher === currentUser?.name) || classrooms[0];

  const [activeSection, setActiveSection] = useState('timetables'); // 'timetables' | 'classrooms'
  const [selectedStream, setSelectedStream] = useState(myClassroom?.name || classrooms[0]?.name);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassroomId, setSelectedClassroomId] = useState(null);

  const selectedClassroomObj = classrooms.find(c => c.id === selectedClassroomId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-mono select-none text-slate-900 animate-portal-enter">
      {/* Teacher Zine Welcome Banner */}
      <div className="zine-card-sky p-6 space-y-4 zine-tape-top border-3 border-slate-900 shadow-zine">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-900 text-yellow-300 font-mono text-xs font-black uppercase tracking-wider mb-2 border border-slate-900 shadow-zine-sm">
              <UserCheck className="w-4 h-4 text-yellow-300" />
              <span>TEACHER WORKBENCH • CLASSROOMS & TIMETABLES</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 font-zine-title tracking-tight">
              Class Streams & Weekly Timetables
            </h2>
            <p className="text-xs font-mono font-bold text-slate-800 mt-1">
              Read-only live schedule database synchronized with Admin Control.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-yellow-200 border-2 border-slate-900 px-3.5 py-2 rounded-xl shadow-zine-sm shrink-0">
            <Lock className="w-4 h-4 text-slate-900" />
            <span className="text-xs font-black text-slate-900 uppercase">INSTRUCTOR ACCESS MODE</span>
          </div>
        </div>

        {/* Section Navigation Controller (Zine Dropdown & Pill Style) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t-2 border-slate-900">
          <div className="flex items-center gap-3 bg-white border-2 border-slate-900 p-2.5 rounded-xl shadow-zine-sm flex-1 max-w-md">
            <Sliders className="w-4 h-4 text-slate-900 shrink-0" />
            <span className="text-xs font-black text-slate-900 uppercase shrink-0">Select View:</span>
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="bg-yellow-100 border border-slate-900 text-xs font-black text-slate-900 px-3 py-1.5 rounded-lg cursor-pointer shadow-sm focus:outline-none w-full"
            >
              <option value="timetables">📅 Schedules & Timetables</option>
              <option value="classrooms">🏫 Classroom Streams Directory ({classrooms.length})</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-black bg-yellow-300 border-2 border-slate-900 px-3.5 py-2 rounded-xl shadow-zine-sm">
            <CheckCircle2 className="w-4 h-4 text-slate-900" />
            <span>Assigned Stream: {myClassroom?.name || 'Grade 10-A'}</span>
          </div>
        </div>
      </div>

      {/* ----------------- SECTION 1: SCHEDULES & TIMETABLES (READ-ONLY) ----------------- */}
      {activeSection === 'timetables' && (
        <div className="zine-card p-6 space-y-6 bg-white border-2 border-slate-900 shadow-zine">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 font-zine-title flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-900" />
                Schedule View: {selectedStream}
              </h3>
              <p className="text-xs font-bold text-slate-700">
                Weekly master timetable schedule configured by System Administration.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-black">
              <span>Select Stream:</span>
              <select
                value={selectedStream}
                onChange={(e) => setSelectedStream(e.target.value)}
                className="p-2 bg-yellow-200 border-2 border-slate-900 font-black text-slate-900 rounded-xl focus:outline-none"
              >
                {classrooms.map(c => (
                  <option key={c.id} value={c.name}>{c.name} ({c.room})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Day Buttons */}
          <div className="flex flex-wrap gap-2">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer border-2 border-slate-900 ${
                  selectedDay === day
                    ? 'bg-yellow-300 text-slate-900 shadow-zine-sm translate-y-[-1px]'
                    : 'bg-slate-100 text-slate-700 hover:bg-yellow-100'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Timetable Slot List */}
          <div className="space-y-3">
            {(timetables[selectedStream]?.[selectedDay] || []).length === 0 ? (
              <div className="p-6 bg-slate-50 border-2 border-slate-900 rounded-xl text-center text-xs font-bold text-slate-700">
                No sessions scheduled for {selectedStream} on {selectedDay}.
              </div>
            ) : (
              (timetables[selectedStream]?.[selectedDay] || []).map((slot, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border-2 border-slate-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-zine-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                      <Clock className="w-4 h-4 text-slate-900" />
                      <span>{slot.time}</span>
                      <span className="bg-yellow-300 text-slate-900 px-2 py-0.5 border border-slate-900 text-xs rounded font-black">
                        {slot.subject}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      Instructor: {slot.teacher} • Location: {slot.room}
                    </div>
                  </div>

                  <span className="px-2.5 py-1 bg-sky-200 text-slate-900 border border-slate-900 text-[11px] font-black rounded-lg self-start sm:self-center">
                    Verified Slot
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ----------------- SECTION 2: CLASSROOM STREAMS DIRECTORY ----------------- */}
      {activeSection === 'classrooms' && (
        <div className="space-y-6">
          {!selectedClassroomId && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border-2 border-slate-900 rounded-xl shadow-zine-sm">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-700 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search streams by name or room..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-yellow-50 border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
                  />
                </div>
                <div className="text-xs font-black text-slate-700">
                  Total Active Streams: <strong className="text-slate-900">{classrooms.length}</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {classrooms
                  .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.room.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((cls) => {
                    const enrolledCount = students.filter(s => s.className === cls.name).length;
                    return (
                      <div
                        key={cls.id}
                        onClick={() => setSelectedClassroomId(cls.id)}
                        className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-4 cursor-pointer shadow-zine hover:shadow-zine-lg transition flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <span className="text-[11px] font-black bg-yellow-300 text-slate-900 px-2 py-0.5 rounded border border-slate-900">
                              {cls.room}
                            </span>
                            <span className="text-[10px] font-black bg-emerald-200 text-slate-900 px-2 py-0.5 rounded border border-slate-900">
                              ACTIVE
                            </span>
                          </div>

                          <h3 className="text-2xl font-black text-slate-900 font-zine-title">{cls.name}</h3>

                          <div className="space-y-2 text-xs font-bold text-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Lead Instructor:</span>
                              <span className="font-black text-slate-900 bg-sky-100 px-2 py-0.5 rounded border border-slate-900">
                                👨‍🏫 {cls.leadTeacher}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Grade Level:</span>
                              <span className="font-black text-slate-900">{cls.gradeLevel || 'Grade 10'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Enrolled Roster:</span>
                              <span className="font-black text-slate-900 bg-yellow-200 px-2 py-0.5 rounded border border-slate-900">
                                {enrolledCount} Students
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t-2 border-slate-900">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClassroomId(cls.id);
                            }}
                            className="w-full py-2 bg-slate-900 text-yellow-300 font-black text-xs rounded-xl border-2 border-slate-900 shadow-zine-sm flex items-center justify-center gap-2"
                          >
                            <span>Inspect Class Roster</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Drill-down View */}
          {selectedClassroomId && selectedClassroomObj && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-4 border-2 border-slate-900 rounded-xl shadow-zine-sm">
                <button
                  onClick={() => setSelectedClassroomId(null)}
                  className="px-4 py-2 bg-yellow-300 text-slate-900 text-xs font-black flex items-center gap-2 rounded-xl border-2 border-slate-900 shadow-zine-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to All Streams</span>
                </button>
                <div className="text-xs font-black text-slate-900">
                  Stream: <strong>{selectedClassroomObj.name} ({selectedClassroomObj.room})</strong>
                </div>
              </div>

              <div className="bg-white p-6 border-2 border-slate-900 rounded-2xl shadow-zine space-y-4">
                <h3 className="text-xl font-black text-slate-900 font-zine-title border-b-2 border-slate-900 pb-3">
                  🎓 Enrolled Roster for {selectedClassroomObj.name}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-yellow-200 border-b-2 border-slate-900 font-black text-slate-900">
                      <tr>
                        <th className="p-3">Roll No</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {students.filter(s => s.className === selectedClassroomObj.name).map((s) => (
                        <tr key={s.id} className="hover:bg-yellow-50">
                          <td className="p-3 font-bold">{s.rollNo}</td>
                          <td className="p-3 font-black text-slate-900">{s.name}</td>
                          <td className="p-3 text-slate-700">{s.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
