'use client';

import React, { useState, useEffect } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  ShieldCheck,
  Building,
  UserCheck,
  GraduationCap,
  Calendar,
  Plus,
  Search,
  Trash2,
  X,
  Mail,
  Link,
  Users,
  CheckCircle2,
  Lock,
  Clock,
  AlertTriangle,
  UserPlus,
  ArrowLeft,
  ChevronRight,
  Sliders,
  Check,
  Ban,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  Filter
} from 'lucide-react';

export const ManagementView = () => {
  const {
    classrooms,
    addClassroom,
    deleteClassroom,
    students,
    addStudent,
    deleteStudent,
    teachers,
    addTeacher,
    deleteTeacher,
    timetables,
    addTimetableSlot,
    assignTeacherToClassroom,
    assignStudentToClassroom,
    accessControls,
    toggleUserPermission,
    toggleUserStatus
  } = useClassPulse();

  // Active Tab: 'access' | 'classrooms' | 'teachers' | 'students' | 'timetables'
  const [activeSubTab, setActiveSubTab] = useState('access');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Selected Classroom ID for Drill-Down Inspection View
  const [selectedClassroomId, setSelectedClassroomId] = useState(null);
  const [selectedTeacherForInline, setSelectedTeacherForInline] = useState(teachers[0]?.id || '');
  const [selectedStudentForInline, setSelectedStudentForInline] = useState(students[0]?.id || '');

  // Deletion Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    type: null,
    id: null,
    name: ''
  });

  // Enterprise Tab Configuration
  const tabsList = [
    { id: 'access', label: 'Access Control (RBAC)', icon: ShieldCheck, badge: 'Security' },
    { id: 'classrooms', label: 'Classrooms Directory', icon: Building, count: classrooms.length },
    { id: 'teachers', label: 'Faculty Directory', icon: UserCheck, count: teachers.length },
    { id: 'students', label: 'Student Roster', icon: GraduationCap, count: students.length },
    { id: 'timetables', label: 'Schedules & Timetables', icon: Calendar }
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (deleteConfirm.isOpen) {
          setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' });
        } else if (isModalOpen) {
          setIsModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, deleteConfirm.isOpen]);

  // Timetable State
  const [selectedTimetableClass, setSelectedTimetableClass] = useState(classrooms[0]?.name || 'Grade 10-A');
  const [selectedTimetableDay, setSelectedTimetableDay] = useState('Monday');

  // Timetable Slot Form
  const [newSlotForm, setNewSlotForm] = useState({
    time: '02:30 - 03:30 PM',
    subject: 'Biology Lab',
    teacher: teachers[0]?.name || 'Dr. Anitha',
    room: 'Science Lab 2'
  });

  // Form States
  const [classroomForm, setClassroomForm] = useState({
    name: '',
    room: '',
    gradeLevel: 'Grade 10',
    leadTeacher: teachers[0]?.name || 'Dr. Anitha',
    studentCount: 35,
    description: 'General Academic Stream'
  });

  const [studentForm, setStudentForm] = useState({
    name: '',
    rollNo: '',
    className: classrooms[0]?.name || 'Grade 10-A',
    email: '',
    nickname: ''
  });

  const [teacherForm, setTeacherForm] = useState({
    name: '',
    staffId: '',
    department: 'Computer Science',
    email: '',
    assignedClasses: classrooms[0]?.name || 'Grade 10-A'
  });

  const requestDelete = (type, id, name) => {
    setDeleteConfirm({ isOpen: true, type, id, name });
  };

  const executeDelete = () => {
    if (deleteConfirm.type === 'classroom') {
      deleteClassroom(deleteConfirm.id);
      if (selectedClassroomId === deleteConfirm.id) {
        setSelectedClassroomId(null);
      }
    } else if (deleteConfirm.type === 'teacher') {
      deleteTeacher(deleteConfirm.id);
    } else if (deleteConfirm.type === 'student') {
      deleteStudent(deleteConfirm.id);
    }
    setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' });
  };

  const handleInlineTeacherAssign = (e, classroomId) => {
    e.preventDefault();
    if (!selectedTeacherForInline) return;
    assignTeacherToClassroom(classroomId, selectedTeacherForInline);
  };

  const handleInlineStudentAssign = (e, className) => {
    e.preventDefault();
    if (!selectedStudentForInline) return;
    assignStudentToClassroom(selectedStudentForInline, className);
  };

  const handleAddTimetableSlot = (e) => {
    e.preventDefault();
    addTimetableSlot(selectedTimetableClass, selectedTimetableDay, newSlotForm);
    setNewSlotForm({ time: '02:30 - 03:30 PM', subject: '', teacher: teachers[0]?.name || 'Dr. Anitha', room: 'Science Lab 2' });
  };

  const selectedClassroomObj = classrooms.find(c => c.id === selectedClassroomId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans select-none text-slate-900 animate-portal-enter">
      {/* Executive Header Banner */}
      <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                Executive Administration
              </span>
              <span className="text-xs font-medium text-slate-500">• Live Service Port 5173</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              System Operations & Control
            </h1>
            <p className="text-xs font-normal text-slate-500 max-w-2xl">
              Central executive control for user privileges, classroom streams, faculty assignments, student rosters, and timetables.
            </p>
          </div>
        </div>

        {/* System Overview Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block">Classrooms Managed</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              <span>{classrooms.length}</span>
              <span className="text-[11px] font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">Active</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block">Faculty Members</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              <span>{teachers.length}</span>
              <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">Verified</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block">Enrolled Students</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              <span>{students.length}</span>
              <span className="text-[11px] font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">Roster</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block">Security Status</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              <span className="text-sky-700 flex items-center gap-1 text-sm font-semibold">
                <Activity className="w-4 h-4 text-sky-600" /> 100% Enforced
              </span>
            </div>
          </div>
        </div>

        {/* Section Dropdown Controller Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2.5 rounded-xl shadow-sm flex-1 max-w-md">
            <Sliders className="w-4 h-4 text-slate-700 shrink-0" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider shrink-0">
              Select Admin View:
            </span>
            <select
              value={activeSubTab}
              onChange={(e) => {
                setActiveSubTab(e.target.value);
                if (e.target.value !== 'classrooms') setSelectedClassroomId(null);
              }}
              className="bg-white border border-slate-300 text-xs font-bold text-slate-900 px-3.5 py-2 rounded-lg cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-700 w-full"
            >
              {tabsList.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>Active Section: {tabsList.find(t => t.id === activeSubTab)?.label}</span>
          </div>
        </div>
      </div>

      {/* ----------------- SECTION 1: ACCESS CONTROL (RBAC MATRIX) ----------------- */}
      {activeSubTab === 'access' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-sky-300">
                  <Lock className="w-4 h-4 text-sky-300" />
                  Role-Based Access Control (RBAC) Matrix
                </h3>
                <p className="text-xs text-slate-300 font-normal">
                  Configure feature privileges across Admin, Teacher, and Student user roles.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-slate-800 text-sky-300 text-xs font-medium rounded-lg border border-slate-700">
                Security Enforced
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <tr>
                    <th className="px-6 py-4">Permission Capability</th>
                    <th className="px-6 py-4 text-center bg-slate-100/50">🔐 Admin</th>
                    <th className="px-6 py-4 text-center bg-slate-100/50">👨‍🏫 Teacher</th>
                    <th className="px-6 py-4 text-center bg-slate-100/50">🎓 Student</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {[
                    { key: 'manageClassrooms', label: 'Create & Manage Classrooms Stream' },
                    { key: 'manageTeachers', label: 'Add & Manage Faculty Profiles' },
                    { key: 'manageStudents', label: 'Add & Roster Student Accounts' },
                    { key: 'assignTimetables', label: 'Create & Edit Weekly Schedules' },
                    { key: 'controlAccess', label: 'Modify Access Control Policies' },
                    { key: 'launchQuizzes', label: 'Launch AI Interactive Quizzes' },
                    { key: 'viewAnalytics', label: 'View Performance Analytics & Logs' }
                  ].map((perm) => (
                    <tr key={perm.key} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 text-slate-900 font-medium">
                        {perm.label}
                      </td>
                      {['Admin', 'Teacher', 'Student'].map((role) => {
                        const isGranted = accessControls.roles[role]?.permissions[perm.key];
                        return (
                          <td key={role} className="px-6 py-4 text-center">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!isGranted}
                                onChange={() => toggleUserPermission(role, perm.key)}
                                className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-700 cursor-pointer"
                              />
                              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border ${
                                isGranted 
                                  ? 'bg-slate-100 text-slate-800 border-slate-300' 
                                  : 'bg-slate-100/60 text-slate-400 border-slate-200'
                              }`}>
                                {isGranted ? 'Granted' : 'Restricted'}
                              </span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SECTION 2: CLASSROOMS DIRECTORY ----------------- */}
      {activeSubTab === 'classrooms' && (
        <div className="space-y-6">
          {!selectedClassroomId && (
            <div className="space-y-4">
              {/* Classroom Directory Action Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-300 rounded-2xl shadow-sm">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search classrooms by name or room number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-medium text-slate-500">
                    Showing <strong className="text-slate-900">{classrooms.length}</strong> classrooms
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Classroom</span>
                  </button>
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
                        className="bg-white border border-slate-300 rounded-2xl p-6 space-y-4 cursor-pointer shadow-sm hover:shadow-md hover:border-slate-400 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[11px] font-semibold bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200">
                                {cls.room}
                              </span>
                              <h3 className="text-xl font-bold text-slate-900 mt-1">{cls.name}</h3>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDelete('classroom', cls.id, cls.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Classroom"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-2 text-xs text-slate-600">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Lead Instructor:</span>
                              <span className="font-semibold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-300">
                                👨‍🏫 {cls.leadTeacher}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Enrolled Roster:</span>
                              <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-300 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-sky-600" />
                                {enrolledCount} Students
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClassroomId(cls.id);
                            }}
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                          >
                            <span>Inspect Roster & Lead Teacher</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-300 rounded-2xl shadow-sm">
                <button
                  onClick={() => setSelectedClassroomId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-2 rounded-xl border border-slate-300 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Classrooms Grid</span>
                </button>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Switch Stream:</span>
                  <select
                    value={selectedClassroomId}
                    onChange={(e) => setSelectedClassroomId(e.target.value)}
                    className="p-2 bg-slate-50 border border-slate-300 font-semibold text-slate-900 rounded-xl focus:outline-none"
                  >
                    {classrooms.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.room})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white p-6 border border-slate-300 rounded-2xl shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                  🎓 Enrolled Roster for {selectedClassroomObj.name} ({selectedClassroomObj.room})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                      <tr>
                        <th className="px-4 py-3">Roll No</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {students.filter(s => s.className === selectedClassroomObj.name).map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono font-medium text-slate-900">{s.rollNo}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{s.name}</td>
                          <td className="px-4 py-3 text-slate-500">{s.email}</td>
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

      {/* ----------------- SECTION 3: FACULTY DIRECTORY ----------------- */}
      {activeSubTab === 'teachers' && (
        <div className="space-y-4">
          {/* Faculty Directory Action Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-300 rounded-2xl shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search faculty members by name or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-medium text-slate-500">
                Total Faculty: <strong className="text-slate-900">{teachers.length}</strong>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Teacher</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {teachers
              .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.department.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((t) => (
                <div key={t.id} className="bg-white border border-slate-300 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 flex items-center justify-center font-bold text-sm">
                        {t.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{t.name}</h3>
                        <span className="text-[11px] font-mono text-slate-500">{t.staffId}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => requestDelete('teacher', t.id, t.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-semibold text-slate-900 bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200">{t.department}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-medium text-slate-800">{t.email}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ----------------- SECTION 4: STUDENT ROSTER DIRECTORY ----------------- */}
      {activeSubTab === 'students' && (
        <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4.5 h-4.5 text-sky-600" />
                Student Roster Registry ({students.length} Accounts)
              </h3>
              <p className="text-xs text-slate-500">Active student profile listings across all classroom streams.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Student</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                <tr>
                  <th className="px-5 py-3.5">Roll No</th>
                  <th className="px-5 py-3.5">Student Name</th>
                  <th className="px-5 py-3.5">Assigned Stream</th>
                  <th className="px-5 py-3.5">Email Address</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 font-mono font-medium text-slate-900">{s.rollNo}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{s.name}</td>
                    <td className="px-5 py-3.5">
                      <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-0.5 rounded-md font-medium">
                        {s.className}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{s.email}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => requestDelete('student', s.id, s.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- SECTION 5: TIMETABLE & SCHEDULES ----------------- */}
      {activeSubTab === 'timetables' && (
        <div className="bg-white p-6 border border-slate-300 rounded-2xl shadow-sm space-y-6">
          {/* Top Timetable Header with Stream Selector & Add Slot Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              Schedule Management: {selectedTimetableClass}
            </h3>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Select Stream:</span>
                <select
                  value={selectedTimetableClass}
                  onChange={(e) => setSelectedTimetableClass(e.target.value)}
                  className="p-2 bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 rounded-xl focus:outline-none"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Timetable Slot</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
              <button
                key={day}
                onClick={() => setSelectedTimetableDay(day)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer border ${
                  selectedTimetableDay === day
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-300'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {(timetables[selectedTimetableClass]?.[selectedTimetableDay] || []).map((slot, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <Clock className="w-4 h-4 text-sky-600" />
                    <span>{slot.time}</span>
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 border border-slate-300 text-xs rounded-md">{slot.subject}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Instructor: {slot.teacher} • Location: {slot.room}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- CREATION MODAL ----------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl max-w-lg w-full p-6 space-y-5 animate-portal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Create New {activeSubTab === 'classrooms' ? 'Classroom' : activeSubTab === 'students' ? 'Student' : activeSubTab === 'teachers' ? 'Teacher' : 'Timetable Slot'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeSubTab === 'classrooms' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                addClassroom(classroomForm);
                setIsModalOpen(false);
              }} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Classroom Stream Name</label>
                  <input
                    type="text"
                    required
                    value={classroomForm.name}
                    onChange={(e) => setClassroomForm({...classroomForm, name: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                    placeholder="Grade 10-C"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Location</label>
                  <input
                    type="text"
                    required
                    value={classroomForm.room}
                    onChange={(e) => setClassroomForm({...classroomForm, room: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                    placeholder="Room 402"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Teacher</label>
                  <select
                    value={classroomForm.leadTeacher}
                    onChange={(e) => setClassroomForm({...classroomForm, leadTeacher: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.department})</option>
                    ))}
                  </select>
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-xs font-medium text-slate-700 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-xl shadow-sm"
                  >
                    Save Classroom
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === 'students' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                addStudent(studentForm);
                setIsModalOpen(false);
              }} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name</label>
                  <input
                    type="text"
                    required
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                    placeholder="Ananya Harish"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Roll No</label>
                  <input
                    type="text"
                    required
                    value={studentForm.rollNo}
                    onChange={(e) => setStudentForm({...studentForm, rollNo: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                    placeholder="STU-1005"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Stream</label>
                  <select
                    value={studentForm.className}
                    onChange={(e) => setStudentForm({...studentForm, className: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                  >
                    {classrooms.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-xs font-medium text-slate-700 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-xl shadow-sm"
                  >
                    Save Student
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === 'teachers' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                addTeacher(teacherForm);
                setIsModalOpen(false);
              }} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teacher Full Name</label>
                  <input
                    type="text"
                    required
                    value={teacherForm.name}
                    onChange={(e) => setTeacherForm({...teacherForm, name: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                    placeholder="Dr. Anitha"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Staff ID</label>
                  <input
                    type="text"
                    required
                    value={teacherForm.staffId}
                    onChange={(e) => setTeacherForm({...teacherForm, staffId: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                    placeholder="TCH-505"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={teacherForm.department}
                    onChange={(e) => setTeacherForm({...teacherForm, department: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                    placeholder="Computer Science"
                  />
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-xs font-medium text-slate-700 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-xl shadow-sm"
                  >
                    Save Teacher
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === 'timetables' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                addTimetableSlot(selectedTimetableClass, selectedTimetableDay, newSlotForm);
                setIsModalOpen(false);
              }} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Time Interval</label>
                  <input
                    type="text"
                    required
                    value={newSlotForm.time}
                    onChange={(e) => setNewSlotForm({...newSlotForm, time: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                    placeholder="02:30 - 03:30 PM"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={newSlotForm.subject}
                    onChange={(e) => setNewSlotForm({...newSlotForm, subject: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                    placeholder="Biology Lab"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Teacher</label>
                  <select
                    value={newSlotForm.teacher}
                    onChange={(e) => setNewSlotForm({...newSlotForm, teacher: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-xs font-medium text-slate-700 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-xl shadow-sm"
                  >
                    Add Slot
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ----------------- DELETION CONFIRMATION MODAL ----------------- */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl max-w-md w-full p-6 space-y-4 animate-portal-enter">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">{deleteConfirm.name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' })}
                className="px-4 py-2 border border-slate-300 text-xs font-medium text-slate-700 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-xl shadow-sm"
              >
                Delete Resource
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
