import React, { useState, useEffect } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  School,
  UserCheck,
  GraduationCap,
  Plus,
  Search,
  Trash2,
  X,
  Building,
  Mail,
  ShieldCheck,
  Calendar,
  Link,
  Users,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Lock,
  Edit2,
  Sparkles,
  BookOpen,
  Clock,
  ChevronRight,
  ShieldAlert,
  AlertTriangle
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
    updateTimetableSlot,
    addTimetableSlot,
    assignTeacherToClassroom,
    assignStudentToClassroom,
    accessControls,
    toggleUserPermission,
    toggleUserStatus
  } = useClassPulse();

  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState('access');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Deletion Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    type: null, // 'classroom' | 'teacher' | 'student'
    id: null,
    name: ''
  });

  // Keyboard Escape listener for modals
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

  // Assignment & Timetable State
  const [selectedClassForAssign, setSelectedClassForAssign] = useState(classrooms[0]?.id || '10A');
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState(teachers[0]?.id || 't1');

  const [selectedStudentForAssign, setSelectedStudentForAssign] = useState(students[0]?.id || 's1');
  const [selectedTargetClassroom, setSelectedTargetClassroom] = useState(classrooms[0]?.name || 'Grade 10-A');

  const [selectedTimetableClass, setSelectedTimetableClass] = useState(classrooms[0]?.name || 'Grade 10-A');
  const [selectedTimetableDay, setSelectedTimetableDay] = useState('Monday');

  // Timetable Slot Form
  const [newSlotForm, setNewSlotForm] = useState({
    time: '02:30 - 03:30 PM',
    subject: 'Biology Lab',
    teacher: 'Dr. Anitha',
    room: 'Science Lab 2'
  });

  // Form States
  const [classroomForm, setClassroomForm] = useState({
    name: '',
    room: '',
    gradeLevel: 'Grade 10',
    leadTeacher: 'Dr. Anitha',
    studentCount: 35,
    description: 'General Studies'
  });

  const [studentForm, setStudentForm] = useState({
    name: '',
    rollNo: '',
    className: classrooms[0]?.name || 'Grade 10-A',
    nickname: '',
    email: ''
  });

  const [teacherForm, setTeacherForm] = useState({
    name: '',
    staffId: '',
    email: '',
    department: 'Science & Biology',
    assignedClasses: 'Grade 10-A'
  });

  // Handle Item Addition
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (activeSubTab === 'classrooms') {
      if (!classroomForm.name || !classroomForm.room) return;
      addClassroom(classroomForm);
      setClassroomForm({ name: '', room: '', gradeLevel: 'Grade 10', leadTeacher: 'Dr. Anitha', studentCount: 35, description: '' });
    } else if (activeSubTab === 'students') {
      if (!studentForm.name || !studentForm.rollNo) return;
      addStudent(studentForm);
      setStudentForm({ name: '', rollNo: '', className: classrooms[0]?.name || 'Grade 10-A', nickname: '', email: '' });
    } else if (activeSubTab === 'teachers') {
      if (!teacherForm.name || !teacherForm.staffId) return;
      addTeacher(teacherForm);
      setTeacherForm({ name: '', staffId: '', email: '', department: 'Science & Biology', assignedClasses: 'Grade 10-A' });
    }
    setIsModalOpen(false);
  };

  // Open Deletion Guard Modal
  const requestDelete = (type, id, name) => {
    setDeleteConfirm({ isOpen: true, type, id, name });
  };

  // Confirm Deletion Execution
  const executeDelete = () => {
    if (deleteConfirm.type === 'classroom') {
      deleteClassroom(deleteConfirm.id);
    } else if (deleteConfirm.type === 'teacher') {
      deleteTeacher(deleteConfirm.id);
    } else if (deleteConfirm.type === 'student') {
      deleteStudent(deleteConfirm.id);
    }
    setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' });
  };

  // Handle Teacher Assignment
  const handleTeacherAssignment = (e) => {
    e.preventDefault();
    assignTeacherToClassroom(selectedClassForAssign, selectedTeacherForAssign);
  };

  // Handle Student Assignment
  const handleStudentAssignment = (e) => {
    e.preventDefault();
    assignStudentToClassroom(selectedStudentForAssign, selectedTargetClassroom);
  };

  // Handle Adding Timetable Slot
  const handleAddTimetableSlot = (e) => {
    e.preventDefault();
    addTimetableSlot(selectedTimetableClass, selectedTimetableDay, newSlotForm);
    setNewSlotForm({ time: '02:30 - 03:30 PM', subject: '', teacher: teachers[0]?.name || 'Dr. Anitha', room: 'Science Lab 2' });
  };

  const currentClassTimetable = timetables[selectedTimetableClass] || {};
  const currentDaySlots = currentClassTimetable[selectedTimetableDay] || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Admin Zine Header Banner */}
      <div className="zine-card p-6 bg-yellow-100 zine-tape-top space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-yellow-300" />
              <span>ADMIN CONTROL CENTER • ZINE EDITION</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 font-zine-title tracking-tight flex items-center gap-2">
              Classroom & System Administration
            </h2>
            <p className="text-xs font-handwriting text-slate-700 font-bold max-w-2xl">
              Clean, organized control suite for school admins. Manage permissions, create classrooms, assign teachers & students, and set timetables.
            </p>
          </div>

          {/* Contextual Action Button */}
          {['classrooms', 'students', 'teachers'].includes(activeSubTab) && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-yellow-300 font-bold rounded-xl border-2 border-slate-900 shadow-zine-interactive text-xs flex items-center gap-2 transition cursor-pointer self-start md:self-auto focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activeSubTab === 'classrooms' && 'Add Classroom'}
                {activeSubTab === 'students' && 'Add Student'}
                {activeSubTab === 'teachers' && 'Add Teacher'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2 border-b-2 border-slate-900">
          <div className="flex items-center gap-2 shrink-0">
            {/* Tab 1: Control Access */}
            <button
              onClick={() => setActiveSubTab('access')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border-2 border-slate-900 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 ${
                activeSubTab === 'access'
                  ? 'bg-yellow-300 text-slate-900 shadow-zine-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>1. Control Access</span>
            </button>

            {/* Tab 2: Classrooms */}
            <button
              onClick={() => setActiveSubTab('classrooms')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border-2 border-slate-900 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 ${
                activeSubTab === 'classrooms'
                  ? 'bg-yellow-300 text-slate-900 shadow-zine-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>2. Classrooms ({classrooms.length})</span>
            </button>

            {/* Tab 3: Teachers */}
            <button
              onClick={() => setActiveSubTab('teachers')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border-2 border-slate-900 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 ${
                activeSubTab === 'teachers'
                  ? 'bg-yellow-300 text-slate-900 shadow-zine-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>3. Teachers ({teachers.length})</span>
            </button>

            {/* Tab 4: Students */}
            <button
              onClick={() => setActiveSubTab('students')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border-2 border-slate-900 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 ${
                activeSubTab === 'students'
                  ? 'bg-yellow-300 text-slate-900 shadow-zine-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>4. Students ({students.length})</span>
            </button>

            {/* Tab 5: Assign Teachers */}
            <button
              onClick={() => setActiveSubTab('assign-teacher')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border-2 border-slate-900 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 ${
                activeSubTab === 'assign-teacher'
                  ? 'bg-sky-200 text-slate-900 shadow-zine-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Link className="w-4 h-4" />
              <span>5. Assign Teachers</span>
            </button>

            {/* Tab 6: Assign Students */}
            <button
              onClick={() => setActiveSubTab('assign-student')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border-2 border-slate-900 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 ${
                activeSubTab === 'assign-student'
                  ? 'bg-sky-200 text-slate-900 shadow-zine-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>6. Assign Students</span>
            </button>

            {/* Tab 7: Assign Timetables */}
            <button
              onClick={() => setActiveSubTab('timetables')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border-2 border-slate-900 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 ${
                activeSubTab === 'timetables'
                  ? 'bg-pink-200 text-slate-900 shadow-zine-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>7. Timetables</span>
            </button>
          </div>

          {/* Search bar for list sub-tabs */}
          {['classrooms', 'teachers', 'students'].includes(activeSubTab) && (
            <div className="relative min-w-[200px] shrink-0">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${activeSubTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border-2 border-slate-900 rounded-xl font-bold text-slate-900 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              />
            </div>
          )}
        </div>
      </div>

      {/* ----------------- 1. CONTROL ACCESS SUB-TAB ----------------- */}
      {activeSubTab === 'access' && (
        <div className="space-y-6">
          <div className="zine-card-yellow p-5 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Lock className="w-4 h-4 text-slate-900" />
              <span>Role-Based Access Control (RBAC) Matrix</span>
            </div>
            <p className="text-xs font-handwriting text-slate-700">
              Configure system permissions for each role. Click any checkbox to grant or restrict access instantly.
            </p>
          </div>

          {/* Role Permissions Matrix Table */}
          <div className="zine-card overflow-hidden">
            <div className="p-4 bg-slate-900 text-yellow-300 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between border-b-2 border-slate-900">
              <span>SYSTEM PERMISSIONS BY ROLE</span>
              <span>ADMIN CONFIGURABLE</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b-2 border-slate-900 font-bold uppercase tracking-wider text-slate-800">
                  <tr>
                    <th className="px-4 py-3 border-r-2 border-slate-900">Permission Feature</th>
                    <th className="px-4 py-3 border-r-2 border-slate-900 bg-yellow-100">🔐 Admin</th>
                    <th className="px-4 py-3 border-r-2 border-slate-900 bg-sky-100">👨‍🏫 Teacher</th>
                    <th className="px-4 py-3 bg-emerald-100">🎓 Student</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-900">
                  {[
                    { key: 'manageClassrooms', label: 'Create & Manage Classrooms' },
                    { key: 'manageTeachers', label: 'Add & Remove Teacher Profiles' },
                    { key: 'manageStudents', label: 'Add & Roster Student Accounts' },
                    { key: 'assignTimetables', label: 'Create & Assign Weekly Timetables' },
                    { key: 'controlAccess', label: 'Modify Access Control & Security' },
                    { key: 'launchQuizzes', label: 'Trigger AI Classroom Quizzes' },
                    { key: 'viewAnalytics', label: 'View Class Performance Analytics' }
                  ].map((perm) => (
                    <tr key={perm.key} className="hover:bg-slate-50 font-medium">
                      <td className="px-4 py-3 font-bold text-slate-900 border-r-2 border-slate-900">
                        {perm.label}
                      </td>
                      {['Admin', 'Teacher', 'Student'].map((role) => {
                        const isGranted = accessControls.roles[role]?.permissions[perm.key];
                        return (
                          <td key={role} className="px-4 py-3 border-r-2 border-slate-900 text-center">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!isGranted}
                                onChange={() => toggleUserPermission(role, perm.key)}
                                className="w-4 h-4 rounded border-2 border-slate-900 text-slate-900 focus:ring-0 cursor-pointer accent-slate-900"
                              />
                              <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border border-slate-900 ${
                                isGranted ? 'bg-emerald-200 text-slate-900' : 'bg-rose-100 text-slate-700'
                              }`}>
                                {isGranted ? 'ALLOWED' : 'DENIED'}
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

          {/* User Account Status & Security Sentinel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Teachers Account Control */}
            <div className="zine-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-sky-600" />
                  Teacher Account Controls
                </h3>
                <span className="text-[10px] font-mono font-bold bg-sky-200 px-2 py-0.5 rounded border border-slate-900">
                  {teachers.length} Accounts
                </span>
              </div>

              <div className="space-y-2">
                {teachers.map((t) => (
                  <div key={t.id} className="p-3 bg-slate-50 border-2 border-slate-900 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{t.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{t.staffId} • {t.department}</div>
                    </div>
                    <button
                      onClick={() => toggleUserStatus(t.id, 'teacher')}
                      className={`px-3 py-1 rounded-lg border-2 border-slate-900 text-[11px] font-bold cursor-pointer transition shadow-zine-sm ${
                        t.status === 'Active' ? 'bg-emerald-200 text-slate-900' : 'bg-rose-200 text-slate-900'
                      }`}
                    >
                      {t.status === 'Active' ? 'ACTIVE' : 'SUSPENDED'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Students Account Control */}
            <div className="zine-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  Student Roster Controls
                </h3>
                <span className="text-[10px] font-mono font-bold bg-emerald-200 px-2 py-0.5 rounded border border-slate-900">
                  {students.length} Accounts
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {students.map((s) => (
                  <div key={s.id} className="p-3 bg-slate-50 border-2 border-slate-900 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{s.rollNo} • {s.className}</div>
                    </div>
                    <button
                      onClick={() => toggleUserStatus(s.id, 'student')}
                      className={`px-3 py-1 rounded-lg border-2 border-slate-900 text-[11px] font-bold cursor-pointer transition shadow-zine-sm ${
                        s.status === 'Active' ? 'bg-emerald-200 text-slate-900' : 'bg-rose-200 text-slate-900'
                      }`}
                    >
                      {s.status === 'Active' ? 'ACTIVE' : 'SUSPENDED'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- 2. ADD CLASSROOMS SUB-TAB ----------------- */}
      {activeSubTab === 'classrooms' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {classrooms
            .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.room.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((cls, idx) => (
              <div key={cls.id} className={`zine-card p-5 space-y-4 relative ${
                idx % 3 === 0 ? 'bg-white' : idx % 3 === 1 ? 'bg-yellow-50' : 'bg-sky-50'
              }`}>
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                      ID: {cls.id}
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900 font-zine-title mt-1">{cls.name}</h3>
                    <span className="text-xs font-bold text-slate-600 font-handwriting">{cls.room}</span>
                  </div>
                  <button
                    onClick={() => requestDelete('classroom', cls.id, cls.name)}
                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition border border-slate-900 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900"
                    title="Delete Classroom"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">Lead Instructor:</span>
                    <span className="font-extrabold text-slate-900 bg-yellow-200 px-2 py-0.5 rounded border border-slate-900">{cls.leadTeacher}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">Grade Stream:</span>
                    <span className="font-extrabold text-slate-900 font-mono">{cls.gradeLevel || 'Grade 10'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">Student Roster Capacity:</span>
                    <span className="font-extrabold text-slate-900 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-700" />
                      {cls.studentCount} Students
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] border-t-2 border-slate-900">
                  <span className={`px-2.5 py-0.5 rounded-full font-extrabold uppercase border border-slate-900 ${
                    cls.status === 'Active' ? 'bg-emerald-200 text-slate-900' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {cls.status}
                  </span>
                  <span className="font-handwriting font-bold text-slate-500">Classroom Active</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ----------------- 3. ADD TEACHERS SUB-TAB ----------------- */}
      {activeSubTab === 'teachers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {teachers
            .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.department.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((t) => (
              <div key={t.id} className="zine-card p-5 space-y-4 bg-white zine-tape-corner">
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-300 border-2 border-slate-900 text-slate-900 font-extrabold flex items-center justify-center text-sm shadow-zine-sm">
                      {t.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">{t.name}</h3>
                      <span className="text-[11px] font-mono font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded border border-slate-900">{t.staffId}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => requestDelete('teacher', t.id, t.name)}
                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition border border-slate-900 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900"
                    title="Delete Teacher"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs text-slate-800 font-medium">
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-600" />
                    <span><strong>Dept:</strong> {t.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-600" />
                    <span><strong>Email:</strong> {t.email}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider font-mono">Assigned Classes:</span>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(t.assignedClasses) ? t.assignedClasses : [t.assignedClasses]).map((c, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-sky-200 text-slate-900 text-[11px] font-bold border border-slate-900">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ----------------- 4. ADD STUDENTS SUB-TAB ----------------- */}
      {activeSubTab === 'students' && (
        <div className="zine-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-yellow-300 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Assigned Classroom</th>
                  <th className="px-4 py-3">Projector Nickname</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-900 bg-white font-medium">
                {students
                  .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNo.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(s => (
                    <tr key={s.id} className="hover:bg-yellow-50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-900">{s.rollNo}</td>
                      <td className="px-4 py-3 font-extrabold text-slate-900">{s.name}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        <span className="px-2 py-0.5 rounded bg-sky-200 border border-slate-900">
                          {s.className}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-900 font-mono text-[11px] border border-slate-900">
                          {s.nickname || s.name.split(' ')[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase border border-slate-900 ${
                          s.status === 'Active' ? 'bg-emerald-200 text-slate-900' : 'bg-rose-200 text-slate-900'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => requestDelete('student', s.id, s.name)}
                          className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-100 rounded transition border border-slate-900 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900"
                          title="Delete Student"
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

      {/* ----------------- 5. ASSIGN TEACHERS TO CLASSROOMS ----------------- */}
      {activeSubTab === 'assign-teacher' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Assign Teacher */}
          <div className="lg:col-span-5 zine-card-sky p-6 space-y-4">
            <div className="border-b-2 border-slate-900 pb-2">
              <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                EXPLAINER STEP 5
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 font-zine-title mt-1">Assign Teacher to Classroom</h3>
              <p className="text-xs font-handwriting text-slate-700">Link a qualified teacher to lead a specific classroom section.</p>
            </div>

            <form onSubmit={handleTeacherAssignment} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-900 mb-1">Select Classroom:</label>
                <select
                  value={selectedClassForAssign}
                  onChange={(e) => setSelectedClassForAssign(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-bold shadow-zine-sm focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.room}) — Current Lead: {c.leadTeacher}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-900 mb-1">Select Lead Teacher:</label>
                <select
                  value={selectedTeacherForAssign}
                  onChange={(e) => setSelectedTeacherForAssign(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-bold shadow-zine-sm focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.staffId}) — {t.department}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-yellow-300 font-extrabold rounded-xl border-2 border-slate-900 shadow-zine-interactive text-xs flex items-center justify-center gap-2 cursor-pointer transition uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <Link className="w-4 h-4" />
                <span>Confirm Teacher Assignment</span>
              </button>
            </form>
          </div>

          {/* Right List: Current Assignments */}
          <div className="lg:col-span-7 zine-card p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 border-b-2 border-slate-900 pb-2 flex items-center justify-between">
              <span>Current Classroom Lead Assignments</span>
              <span className="text-xs font-mono font-bold bg-yellow-200 px-2 py-0.5 rounded border border-slate-900">
                {classrooms.length} Active Classes
              </span>
            </h3>

            <div className="space-y-3">
              {classrooms.map((cls) => (
                <div key={cls.id} className="p-4 bg-slate-50 border-2 border-slate-900 rounded-xl flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="font-extrabold text-slate-900 text-sm">{cls.name}</div>
                    <div className="text-slate-600 font-medium">{cls.room} • {cls.studentCount} Students</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Assigned Lead Teacher:</span>
                    <span className="px-3 py-1 bg-yellow-200 text-slate-900 font-extrabold rounded-lg border border-slate-900 inline-block mt-0.5">
                      👨‍🏫 {cls.leadTeacher}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- 6. ASSIGN STUDENTS TO CLASSROOMS ----------------- */}
      {activeSubTab === 'assign-student' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Assign Student */}
          <div className="lg:col-span-5 zine-card-mint p-6 space-y-4">
            <div className="border-b-2 border-slate-900 pb-2">
              <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                EXPLAINER STEP 6
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 font-zine-title mt-1">Assign Student to Classroom</h3>
              <p className="text-xs font-handwriting text-slate-700">Place individual students into their assigned classroom section.</p>
            </div>

            <form onSubmit={handleStudentAssignment} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-900 mb-1">Select Student:</label>
                <select
                  value={selectedStudentForAssign}
                  onChange={(e) => setSelectedStudentForAssign(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-bold shadow-zine-sm focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.rollNo}) — Currently in {s.className}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-900 mb-1">Target Classroom:</label>
                <select
                  value={selectedTargetClassroom}
                  onChange={(e) => setSelectedTargetClassroom(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-bold shadow-zine-sm focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.room})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-yellow-300 font-extrabold rounded-xl border-2 border-slate-900 shadow-zine-interactive text-xs flex items-center justify-center gap-2 cursor-pointer transition uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <Users className="w-4 h-4" />
                <span>Move Student to Classroom</span>
              </button>
            </form>
          </div>

          {/* Right Roster per Classroom */}
          <div className="lg:col-span-7 zine-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
              <h3 className="text-base font-extrabold text-slate-900">Classroom Student Rosters</h3>
              <select
                value={selectedTargetClassroom}
                onChange={(e) => setSelectedTargetClassroom(e.target.value)}
                className="p-1.5 bg-yellow-200 border-2 border-slate-900 text-xs font-bold rounded-lg focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                {classrooms.map(c => (
                  <option key={c.id} value={c.name}>View Roster: {c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {students.filter(s => s.className === selectedTargetClassroom).length === 0 ? (
                <div className="p-6 text-center text-xs font-handwriting text-slate-500 border-2 border-dashed border-slate-900 rounded-xl">
                  No students assigned to {selectedTargetClassroom} yet.
                </div>
              ) : (
                students
                  .filter(s => s.className === selectedTargetClassroom)
                  .map((s) => (
                    <div key={s.id} className="p-3 bg-slate-50 border-2 border-slate-900 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-slate-900">{s.name}</span>
                        <span className="ml-2 font-mono text-[11px] text-indigo-800 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-slate-900">{s.rollNo}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">{s.email}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- 7. ASSIGN TIMETABLES TO CLASSROOMS ----------------- */}
      {activeSubTab === 'timetables' && (
        <div className="space-y-6">
          {/* Classroom & Day Selector Bar */}
          <div className="zine-card-pink p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-900 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                  EXPLAINER STEP 7
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 font-zine-title mt-1">Classroom Timetable Manager</h3>
                <p className="text-xs font-handwriting text-slate-700">Assign subjects, time slots, and teachers to classroom schedules.</p>
              </div>

              {/* Classroom Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 uppercase">Class:</span>
                <select
                  value={selectedTimetableClass}
                  onChange={(e) => setSelectedTimetableClass(e.target.value)}
                  className="p-2 bg-white border-2 border-slate-900 text-xs font-extrabold text-slate-900 rounded-xl shadow-zine-sm focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.room})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Day Selector Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedTimetableDay(day)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border-2 border-slate-900 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    selectedTimetableDay === day
                      ? 'bg-yellow-300 text-slate-900 shadow-zine-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  📅 {day}
                </button>
              ))}
            </div>
          </div>

          {/* Timetable Schedule Grid + Add Slot Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Schedule Slots List */}
            <div className="lg:col-span-7 zine-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                <h3 className="text-base font-extrabold text-slate-900 font-zine-title">
                  {selectedTimetableClass} • {selectedTimetableDay} Schedule
                </h3>
                <span className="text-xs font-mono font-bold bg-yellow-200 px-2 py-0.5 rounded border border-slate-900">
                  {currentDaySlots.length} Slots Set
                </span>
              </div>

              {currentDaySlots.length === 0 ? (
                <div className="p-8 text-center text-xs font-handwriting text-slate-500 border-2 border-dashed border-slate-900 rounded-xl">
                  No time slots assigned for {selectedTimetableDay} yet. Use the form on the right to add a session slot!
                </div>
              ) : (
                <div className="space-y-3">
                  {currentDaySlots.map((slot, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border-2 border-slate-900 rounded-xl space-y-2 hover:bg-yellow-50 transition">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold bg-slate-900 text-yellow-300 px-2.5 py-0.5 rounded border border-slate-900">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {slot.time}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-sky-200 text-slate-900 font-extrabold text-xs border border-slate-900">
                          {slot.room}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">{slot.subject}</h4>
                          <p className="text-xs font-bold text-slate-600">Instructor: {slot.teacher}</p>
                        </div>
                        <span className="text-[10px] font-handwriting font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-slate-900">
                          CONFIRMED SLOT
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Add New Slot Form */}
            <div className="lg:col-span-5 zine-card-yellow p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b-2 border-slate-900 pb-2">
                ➕ Add Timetable Time Slot
              </h3>

              <form onSubmit={handleAddTimetableSlot} className="space-y-3 text-xs font-bold">
                <div>
                  <label className="block text-slate-900 mb-1">Time Duration:</label>
                  <input
                    type="text"
                    placeholder="e.g. 02:30 - 03:30 PM"
                    value={newSlotForm.time}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, time: e.target.value })}
                    required
                    className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-900 mb-1">Subject Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. Organic Chemistry"
                    value={newSlotForm.subject}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                    required
                    className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-900 mb-1">Assigned Teacher:</label>
                  <select
                    value={newSlotForm.teacher}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, teacher: e.target.value })}
                    className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.department})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-900 mb-1">Classroom / Lab Location:</label>
                  <input
                    type="text"
                    placeholder="e.g. Science Lab 2"
                    value={newSlotForm.room}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, room: e.target.value })}
                    required
                    className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-yellow-300 font-extrabold rounded-xl border-2 border-slate-900 shadow-zine-interactive text-xs flex items-center justify-center gap-2 cursor-pointer transition uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Slot to {selectedTimetableDay}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL DIALOG FOR ADDING ITEMS ----------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="zine-card max-w-md w-full p-6 space-y-4 bg-white zine-tape-top">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 font-zine-title flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                {activeSubTab === 'classrooms' && 'Add New Classroom'}
                {activeSubTab === 'students' && 'Add New Student'}
                {activeSubTab === 'teachers' && 'Add New Teacher'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-600 hover:text-slate-900 rounded-lg border-2 border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3 text-xs font-bold">
              {/* Form 1: Classroom */}
              {activeSubTab === 'classrooms' && (
                <>
                  <div>
                    <label className="block text-slate-900 mb-1">Classroom Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Grade 12-A"
                      value={classroomForm.name}
                      onChange={(e) => setClassroomForm({ ...classroomForm, name: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-900 mb-1">Room / Lab Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Science Lab 3"
                      value={classroomForm.room}
                      onChange={(e) => setClassroomForm({ ...classroomForm, room: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-900 mb-1">Lead Instructor</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Anitha"
                      value={classroomForm.leadTeacher}
                      onChange={(e) => setClassroomForm({ ...classroomForm, leadTeacher: e.target.value })}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>
                </>
              )}

              {/* Form 2: Student */}
              {activeSubTab === 'students' && (
                <>
                  <div>
                    <label className="block text-slate-900 mb-1">Full Student Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Maya Patel"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-900 mb-1">Roll / Student ID Number</label>
                    <input
                      type="text"
                      placeholder="e.g. STU-1045"
                      value={studentForm.rollNo}
                      onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-900 mb-1">Assigned Classroom</label>
                    <select
                      value={studentForm.className}
                      onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      {classrooms.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-900 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. maya@classpulse.edu"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>
                </>
              )}

              {/* Form 3: Teacher */}
              {activeSubTab === 'teachers' && (
                <>
                  <div>
                    <label className="block text-slate-900 mb-1">Teacher Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Prof. Vikram Seth"
                      value={teacherForm.name}
                      onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-900 mb-1">Staff ID Number</label>
                    <input
                      type="text"
                      placeholder="e.g. TCH-508"
                      value={teacherForm.staffId}
                      onChange={(e) => setTeacherForm({ ...teacherForm, staffId: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-900 mb-1">Department / Subject Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Physics & Astronomy"
                      value={teacherForm.department}
                      onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl text-slate-900 font-bold focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t-2 border-slate-900">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-900 font-bold rounded-xl border-2 border-slate-900 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-300 text-slate-900 font-extrabold rounded-xl border-2 border-slate-900 shadow-zine-sm cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- DELETION CONFIRMATION GUARD MODAL ----------------- */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="zine-card-pink max-w-md w-full p-6 space-y-4 zine-tape-top">
            <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-200 border-2 border-slate-900 flex items-center justify-center text-slate-900 shadow-zine-sm shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-zine-title">Confirm Deletion</h3>
                <p className="text-xs font-mono font-bold text-slate-700 uppercase">Action requires validation</p>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-900 leading-relaxed">
              Are you sure you want to delete <span className="bg-yellow-200 px-1.5 py-0.5 rounded border border-slate-900">{deleteConfirm.name}</span> from the system? This will remove all associated schedules and records.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3 border-t-2 border-slate-900">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' })}
                className="px-4 py-2 bg-white text-slate-900 font-bold rounded-xl border-2 border-slate-900 cursor-pointer shadow-zine-sm focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Cancel (Keep)
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-2 bg-rose-500 text-white font-extrabold rounded-xl border-2 border-slate-900 shadow-zine-interactive cursor-pointer uppercase tracking-wider text-xs focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Yes, Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
