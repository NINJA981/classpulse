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
  Lock,
  Clock,
  ChevronLeft,
  ChevronRight,
  Folder,
  Layers,
  HardDrive,
  AlertTriangle,
  Home,
  Sliders
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

  // Active Sub-Tab / Card Index (1 to 7)
  // 'access' | 'classrooms' | 'teachers' | 'students' | 'assign-teacher' | 'assign-student' | 'timetables'
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

  // Card Navigation Array for Shoebox Stack Controller
  const cardsList = [
    { id: 'access', label: 'Control Access', icon: Lock, num: 1 },
    { id: 'classrooms', label: 'Classrooms', icon: Building, num: 2 },
    { id: 'teachers', label: 'Teachers', icon: UserCheck, num: 3 },
    { id: 'students', label: 'Students', icon: GraduationCap, num: 4 },
    { id: 'assign-teacher', label: 'Assign Teachers', icon: Link, num: 5 },
    { id: 'assign-student', label: 'Assign Students', icon: Users, num: 6 },
    { id: 'timetables', label: 'Timetables', icon: Calendar, num: 7 }
  ];

  const currentCardIndex = cardsList.findIndex(c => c.id === activeSubTab);

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setActiveSubTab(cardsList[currentCardIndex - 1].id);
    }
  };

  const nextCard = () => {
    if (currentCardIndex < cardsList.length - 1) {
      setActiveSubTab(cardsList[currentCardIndex + 1].id);
    }
  };

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
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* HyperCard Window Title Bar & Shoebox Stack Header */}
      <div className="hypercard-stack overflow-hidden">
        {/* Macintosh Window Title Bar */}
        <div className="bg-[#d5cfbf] border-b-2 border-black px-4 py-2 flex items-center justify-between font-mono text-xs font-bold select-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-black bg-white flex items-center justify-center font-bold text-[9px]">■</div>
            <span className="font-hypercard-header uppercase tracking-wider text-black">HYPERCARD STACK v2.0 • ADMIN SHOEBOX INDEX</span>
          </div>

          <div className="mac-title-bar h-3.5 w-32 border border-black hidden sm:block"></div>

          <div className="flex items-center gap-2 font-hypercard-pixel text-sm">
            <span>CARD {currentCardIndex + 1} OF 7</span>
          </div>
        </div>

        {/* HyperCard Shoebox Header Controls */}
        <div className="p-5 bg-[#f7f4ed] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
            <div>
              <span className="font-hypercard-pixel text-lg bg-black text-white px-2 py-0.5 rounded inline-block mb-1">
                🗂️ CLASSROOM ADMINISTRATION STACK
              </span>
              <h2 className="text-2xl font-black text-black font-hypercard-header uppercase tracking-tight flex items-center gap-2">
                HyperCard Admin Index
              </h2>
              <p className="text-xs font-mono font-bold text-slate-800">
                Organized Shoebox Stack: Control access permissions, add classrooms & users, assign rosters and configure weekly timetables.
              </p>
            </div>

            {/* Shoebox Stack Pagination & Home Controller */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={prevCard}
                disabled={currentCardIndex === 0}
                className="px-3 py-1.5 hypercard-btn text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous Card in Stack"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev Card</span>
              </button>

              <div className="px-3 py-1.5 bg-white border-2 border-black text-xs font-hypercard-pixel font-bold shadow-[2px_2px_0px_0px_#000]">
                {currentCardIndex + 1} / 7
              </div>

              <button
                onClick={nextCard}
                disabled={currentCardIndex === cardsList.length - 1}
                className="px-3 py-1.5 hypercard-btn text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next Card in Stack"
              >
                <span>Next Card</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {['classrooms', 'students', 'teachers'].includes(activeSubTab) && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-1.5 hypercard-btn-primary text-xs flex items-center gap-1.5 cursor-pointer ml-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {activeSubTab === 'classrooms' && 'New Classroom'}
                    {activeSubTab === 'students' && 'New Student'}
                    {activeSubTab === 'teachers' && 'New Teacher'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* HyperCard Index Tabs Bar (Shoebox Card Headers) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1">
            {cardsList.map((card) => {
              const Icon = card.icon;
              const isActive = activeSubTab === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => setActiveSubTab(card.id)}
                  className={`px-3.5 py-2 rounded-t-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isActive ? 'hypercard-tab-active' : 'hypercard-tab-inactive'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>Card {card.num}: {card.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ----------------- CARD 1: CONTROL ACCESS ----------------- */}
      {activeSubTab === 'access' && (
        <div className="space-y-6">
          <div className="hypercard-card-yellow p-5 space-y-2">
            <div className="flex items-center gap-2 font-hypercard-header text-sm text-black">
              <Lock className="w-4 h-4 text-black" />
              <span>HyperCard Access Permission Matrix (RBAC)</span>
            </div>
            <p className="text-xs font-mono font-bold text-slate-800">
              Configure system privileges for each role. Checkboxes update permissions live in the index stack.
            </p>
          </div>

          {/* Role Permissions Matrix Table */}
          <div className="hypercard-card overflow-hidden">
            <div className="p-3 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between border-b-2 border-black">
              <span>SYSTEM PERMISSIONS BY ROLE</span>
              <span>ADMIN CONFIGURABLE</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#e8e3d5] border-b-2 border-black font-bold uppercase tracking-wider text-black">
                  <tr>
                    <th className="px-4 py-3 border-r-2 border-black">Permission Feature</th>
                    <th className="px-4 py-3 border-r-2 border-black bg-yellow-100">🔐 Admin</th>
                    <th className="px-4 py-3 border-r-2 border-black bg-sky-100">👨‍🏫 Teacher</th>
                    <th className="px-4 py-3 bg-emerald-100">🎓 Student</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black bg-white">
                  {[
                    { key: 'manageClassrooms', label: 'Create & Manage Classrooms' },
                    { key: 'manageTeachers', label: 'Add & Remove Teacher Profiles' },
                    { key: 'manageStudents', label: 'Add & Roster Student Accounts' },
                    { key: 'assignTimetables', label: 'Create & Assign Weekly Timetables' },
                    { key: 'controlAccess', label: 'Modify Access Control & Security' },
                    { key: 'launchQuizzes', label: 'Trigger AI Classroom Quizzes' },
                    { key: 'viewAnalytics', label: 'View Class Performance Analytics' }
                  ].map((perm) => (
                    <tr key={perm.key} className="hover:bg-yellow-50 font-bold">
                      <td className="px-4 py-3 text-black border-r-2 border-black">
                        {perm.label}
                      </td>
                      {['Admin', 'Teacher', 'Student'].map((role) => {
                        const isGranted = accessControls.roles[role]?.permissions[perm.key];
                        return (
                          <td key={role} className="px-4 py-3 border-r-2 border-black text-center">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!isGranted}
                                onChange={() => toggleUserPermission(role, perm.key)}
                                className="w-4 h-4 rounded border-2 border-black text-black accent-black cursor-pointer"
                              />
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border border-black ${
                                isGranted ? 'bg-emerald-200 text-black' : 'bg-rose-200 text-black'
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

          {/* User Account Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Teachers Account Control */}
            <div className="hypercard-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <h3 className="text-sm font-hypercard-header text-black flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-black" />
                  Teacher Account Controls
                </h3>
                <span className="text-[10px] font-mono font-bold bg-sky-200 px-2 py-0.5 border border-black">
                  {teachers.length} Accounts
                </span>
              </div>

              <div className="space-y-2">
                {teachers.map((t) => (
                  <div key={t.id} className="p-3 bg-[#f7f4ed] border-2 border-black rounded-lg flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-bold text-black">{t.name}</div>
                      <div className="text-[11px] text-slate-700">{t.staffId} • {t.department}</div>
                    </div>
                    <button
                      onClick={() => toggleUserStatus(t.id, 'teacher')}
                      className={`px-3 py-1 border-2 border-black text-[10px] font-bold cursor-pointer transition shadow-[2px_2px_0px_0px_#000] ${
                        t.status === 'Active' ? 'bg-emerald-200 text-black' : 'bg-rose-200 text-black'
                      }`}
                    >
                      {t.status === 'Active' ? 'ACTIVE' : 'SUSPENDED'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Students Account Control */}
            <div className="hypercard-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <h3 className="text-sm font-hypercard-header text-black flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-black" />
                  Student Roster Controls
                </h3>
                <span className="text-[10px] font-mono font-bold bg-emerald-200 px-2 py-0.5 border border-black">
                  {students.length} Accounts
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {students.map((s) => (
                  <div key={s.id} className="p-3 bg-[#f7f4ed] border-2 border-black rounded-lg flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-bold text-black">{s.name}</div>
                      <div className="text-[11px] text-slate-700">{s.rollNo} • {s.className}</div>
                    </div>
                    <button
                      onClick={() => toggleUserStatus(s.id, 'student')}
                      className={`px-3 py-1 border-2 border-black text-[10px] font-bold cursor-pointer transition shadow-[2px_2px_0px_0px_#000] ${
                        s.status === 'Active' ? 'bg-emerald-200 text-black' : 'bg-rose-200 text-black'
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

      {/* ----------------- CARD 2: CLASSROOMS ----------------- */}
      {activeSubTab === 'classrooms' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {classrooms
            .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.room.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((cls, idx) => (
              <div key={cls.id} className={`hypercard-card p-5 space-y-4 relative ${
                idx % 3 === 0 ? 'bg-white' : idx % 3 === 1 ? 'bg-yellow-50' : 'bg-sky-50'
              }`}>
                <div className="flex items-start justify-between border-b-2 border-black pb-3 font-mono">
                  <div>
                    <span className="text-[10px] font-mono font-bold bg-black text-white px-2 py-0.5 rounded">
                      ID: {cls.id}
                    </span>
                    <h3 className="text-lg font-hypercard-header text-black mt-1">{cls.name}</h3>
                    <span className="text-xs font-bold text-slate-700">{cls.room}</span>
                  </div>
                  <button
                    onClick={() => requestDelete('classroom', cls.id, cls.name)}
                    className="p-1.5 text-black hover:bg-rose-200 rounded border-2 border-black cursor-pointer"
                    title="Delete Classroom"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs font-mono text-black">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Lead Instructor:</span>
                    <span className="font-bold text-black bg-yellow-200 px-2 py-0.5 border border-black">{cls.leadTeacher}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Grade Stream:</span>
                    <span className="font-bold text-black">{cls.gradeLevel || 'Grade 10'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Student Capacity:</span>
                    <span className="font-bold text-black flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-black" />
                      {cls.studentCount} Students
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[10px] font-mono border-t-2 border-black">
                  <span className={`px-2 py-0.5 font-bold uppercase border border-black ${
                    cls.status === 'Active' ? 'bg-emerald-200 text-black' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {cls.status}
                  </span>
                  <span className="font-bold text-slate-600">Shoebox Card #{cls.id}</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ----------------- CARD 3: TEACHERS ----------------- */}
      {activeSubTab === 'teachers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {teachers
            .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.department.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((t) => (
              <div key={t.id} className="hypercard-card p-5 space-y-4 bg-white">
                <div className="flex items-start justify-between border-b-2 border-black pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-200 border-2 border-black text-black font-hypercard-header flex items-center justify-center text-sm shadow-[2px_2px_0px_0px_#000]">
                      {t.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="font-mono">
                      <h3 className="text-sm font-bold text-black">{t.name}</h3>
                      <span className="text-[10px] font-mono font-bold text-black bg-sky-100 px-1.5 py-0.5 border border-black">{t.staffId}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => requestDelete('teacher', t.id, t.name)}
                    className="p-1.5 text-black hover:bg-rose-200 rounded border-2 border-black cursor-pointer"
                    title="Delete Teacher"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs font-mono text-black">
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-black" />
                    <span><strong>Dept:</strong> {t.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-black" />
                    <span><strong>Email:</strong> {t.email}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] font-bold text-black block mb-1 uppercase tracking-wider">Assigned Classes:</span>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(t.assignedClasses) ? t.assignedClasses : [t.assignedClasses]).map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-sky-200 text-black text-[10px] font-bold border border-black">
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

      {/* ----------------- CARD 4: STUDENTS ----------------- */}
      {activeSubTab === 'students' && (
        <div className="hypercard-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-black text-white font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 border-r border-slate-700">Roll No</th>
                  <th className="px-4 py-3 border-r border-slate-700">Student Name</th>
                  <th className="px-4 py-3 border-r border-slate-700">Assigned Classroom</th>
                  <th className="px-4 py-3 border-r border-slate-700">Projector Nickname</th>
                  <th className="px-4 py-3 border-r border-slate-700">Email Address</th>
                  <th className="px-4 py-3 border-r border-slate-700">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black bg-white font-bold">
                {students
                  .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNo.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(s => (
                    <tr key={s.id} className="hover:bg-yellow-50 transition">
                      <td className="px-4 py-3 border-r-2 border-black font-mono text-black">{s.rollNo}</td>
                      <td className="px-4 py-3 border-r-2 border-black text-black">{s.name}</td>
                      <td className="px-4 py-3 border-r-2 border-black text-black">
                        <span className="px-2 py-0.5 bg-sky-200 border border-black">
                          {s.className}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-r-2 border-black">
                        <span className="px-2 py-0.5 bg-slate-100 text-black font-mono text-[10px] border border-black">
                          {s.nickname || s.name.split(' ')[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-r-2 border-black text-slate-700">{s.email}</td>
                      <td className="px-4 py-3 border-r-2 border-black">
                        <span className={`px-2 py-0.5 font-bold text-[10px] uppercase border border-black ${
                          s.status === 'Active' ? 'bg-emerald-200 text-black' : 'bg-rose-200 text-black'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => requestDelete('student', s.id, s.name)}
                          className="p-1 text-black hover:bg-rose-200 rounded border border-black cursor-pointer"
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

      {/* ----------------- CARD 5: ASSIGN TEACHERS ----------------- */}
      {activeSubTab === 'assign-teacher' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Assign Teacher */}
          <div className="lg:col-span-5 hypercard-card-sky p-6 space-y-4">
            <div className="border-b-2 border-black pb-2 font-mono">
              <span className="text-[10px] bg-black text-white px-2 py-0.5 font-bold uppercase">
                HYPERCARD STEP 5
              </span>
              <h3 className="text-lg font-hypercard-header text-black mt-1">Assign Teacher to Section</h3>
              <p className="text-xs text-slate-800">Link an instructor to lead a specific classroom section.</p>
            </div>

            <form onSubmit={handleTeacherAssignment} className="space-y-4 text-xs font-mono font-bold">
              <div>
                <label className="block text-black mb-1">Select Classroom Section:</label>
                <select
                  value={selectedClassForAssign}
                  onChange={(e) => setSelectedClassForAssign(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-bold shadow-[2px_2px_0px_0px_#000]"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.room}) — Lead: {c.leadTeacher}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-black mb-1">Select Lead Instructor:</label>
                <select
                  value={selectedTeacherForAssign}
                  onChange={(e) => setSelectedTeacherForAssign(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-bold shadow-[2px_2px_0px_0px_#000]"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.staffId}) — {t.department}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 hypercard-btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Link className="w-4 h-4" />
                <span>Confirm Teacher Assignment</span>
              </button>
            </form>
          </div>

          {/* Right List: Current Assignments */}
          <div className="lg:col-span-7 hypercard-card p-6 space-y-4 font-mono">
            <h3 className="text-base font-hypercard-header text-black border-b-2 border-black pb-2 flex items-center justify-between">
              <span>Current Lead Teacher Assignments</span>
              <span className="text-xs bg-yellow-200 px-2 py-0.5 border border-black">
                {classrooms.length} Active Classes
              </span>
            </h3>

            <div className="space-y-3">
              {classrooms.map((cls) => (
                <div key={cls.id} className="p-4 bg-[#f7f4ed] border-2 border-black rounded-lg flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-black text-sm">{cls.name}</div>
                    <div className="text-slate-700">{cls.room} • {cls.studentCount} Students</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-600 uppercase block font-bold">Assigned Instructor:</span>
                    <span className="px-3 py-1 bg-yellow-200 text-black font-bold border border-black inline-block mt-0.5">
                      👨‍🏫 {cls.leadTeacher}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- CARD 6: ASSIGN STUDENTS ----------------- */}
      {activeSubTab === 'assign-student' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Assign Student */}
          <div className="lg:col-span-5 hypercard-card-mint p-6 space-y-4">
            <div className="border-b-2 border-black pb-2 font-mono">
              <span className="text-[10px] bg-black text-white px-2 py-0.5 font-bold uppercase">
                HYPERCARD STEP 6
              </span>
              <h3 className="text-lg font-hypercard-header text-black mt-1">Assign Student to Section</h3>
              <p className="text-xs text-slate-800">Place students into specific classroom rosters.</p>
            </div>

            <form onSubmit={handleStudentAssignment} className="space-y-4 text-xs font-mono font-bold">
              <div>
                <label className="block text-black mb-1">Select Student:</label>
                <select
                  value={selectedStudentForAssign}
                  onChange={(e) => setSelectedStudentForAssign(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-bold shadow-[2px_2px_0px_0px_#000]"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.rollNo}) — Currently in {s.className}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-black mb-1">Target Classroom Section:</label>
                <select
                  value={selectedTargetClassroom}
                  onChange={(e) => setSelectedTargetClassroom(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-bold shadow-[2px_2px_0px_0px_#000]"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.room})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 hypercard-btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Users className="w-4 h-4" />
                <span>Move Student to Classroom</span>
              </button>
            </form>
          </div>

          {/* Right Roster per Classroom */}
          <div className="lg:col-span-7 hypercard-card p-6 space-y-4 font-mono">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h3 className="text-base font-hypercard-header text-black">Section Roster View</h3>
              <select
                value={selectedTargetClassroom}
                onChange={(e) => setSelectedTargetClassroom(e.target.value)}
                className="p-1.5 bg-yellow-200 border-2 border-black text-xs font-bold rounded"
              >
                {classrooms.map(c => (
                  <option key={c.id} value={c.name}>View Roster: {c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {students.filter(s => s.className === selectedTargetClassroom).length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-500 border-2 border-dashed border-black rounded-lg">
                  No students assigned to {selectedTargetClassroom} yet.
                </div>
              ) : (
                students
                  .filter(s => s.className === selectedTargetClassroom)
                  .map((s) => (
                    <div key={s.id} className="p-3 bg-[#f7f4ed] border-2 border-black rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-black">{s.name}</span>
                        <span className="ml-2 font-mono text-[10px] text-black bg-sky-100 px-1.5 py-0.5 border border-black">{s.rollNo}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">{s.email}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- CARD 7: TIMETABLES ----------------- */}
      {activeSubTab === 'timetables' && (
        <div className="space-y-6">
          {/* Classroom & Day Selector Bar */}
          <div className="hypercard-card-yellow p-5 space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-3">
              <div>
                <span className="text-[10px] bg-black text-white px-2 py-0.5 font-bold uppercase">
                  HYPERCARD STEP 7
                </span>
                <h3 className="text-lg font-hypercard-header text-black mt-1">Classroom Weekly Timetable</h3>
                <p className="text-xs text-slate-800">Assign subjects, time slots, and teachers to weekly classroom schedules.</p>
              </div>

              {/* Classroom Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-black uppercase">Class:</span>
                <select
                  value={selectedTimetableClass}
                  onChange={(e) => setSelectedTimetableClass(e.target.value)}
                  className="p-2 bg-white border-2 border-black text-xs font-bold text-black rounded shadow-[2px_2px_0px_0px_#000]"
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
                  className={`px-4 py-2 rounded text-xs font-bold border-2 border-black transition cursor-pointer ${
                    selectedTimetableDay === day
                      ? 'bg-black text-yellow-300 shadow-[2px_2px_0px_0px_#888]'
                      : 'bg-white text-black hover:bg-slate-100'
                  }`}
                >
                  📅 {day}
                </button>
              ))}
            </div>
          </div>

          {/* Timetable Schedule Grid + Add Slot Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
            {/* Left: Schedule Slots List */}
            <div className="lg:col-span-7 hypercard-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <h3 className="text-base font-hypercard-header text-black">
                  {selectedTimetableClass} • {selectedTimetableDay} Schedule
                </h3>
                <span className="text-xs bg-yellow-200 px-2 py-0.5 border border-black font-bold">
                  {currentDaySlots.length} Slots Set
                </span>
              </div>

              {currentDaySlots.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500 border-2 border-dashed border-black rounded-lg">
                  No time slots assigned for {selectedTimetableDay} yet. Use the form on the right to add a session slot!
                </div>
              ) : (
                <div className="space-y-3">
                  {currentDaySlots.map((slot, idx) => (
                    <div key={idx} className="p-4 bg-[#f7f4ed] border-2 border-black rounded-lg space-y-2 hover:bg-yellow-50 transition">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold bg-black text-white px-2 py-0.5 border border-black">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {slot.time}
                        </span>
                        <span className="px-2 py-0.5 bg-sky-200 text-black font-bold text-xs border border-black">
                          {slot.room}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <h4 className="text-sm font-bold text-black">{slot.subject}</h4>
                          <p className="text-xs text-slate-700">Instructor: {slot.teacher}</p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 border border-black">
                          CONFIRMED SLOT
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Add New Slot Form */}
            <div className="lg:col-span-5 hypercard-card-yellow p-6 space-y-4">
              <h3 className="text-base font-hypercard-header text-black border-b-2 border-black pb-2">
                ➕ Add Timetable Slot
              </h3>

              <form onSubmit={handleAddTimetableSlot} className="space-y-3 text-xs font-bold">
                <div>
                  <label className="block text-black mb-1">Time Duration:</label>
                  <input
                    type="text"
                    placeholder="e.g. 02:30 - 03:30 PM"
                    value={newSlotForm.time}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, time: e.target.value })}
                    required
                    className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-bold"
                  />
                </div>

                <div>
                  <label className="block text-black mb-1">Subject Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. Organic Chemistry"
                    value={newSlotForm.subject}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                    required
                    className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-bold"
                  />
                </div>

                <div>
                  <label className="block text-black mb-1">Assigned Instructor:</label>
                  <select
                    value={newSlotForm.teacher}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, teacher: e.target.value })}
                    className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-bold"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.department})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-black mb-1">Classroom / Lab Location:</label>
                  <input
                    type="text"
                    placeholder="e.g. Science Lab 2"
                    value={newSlotForm.room}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, room: e.target.value })}
                    required
                    className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-bold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 hypercard-btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
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
          <div className="hypercard-card max-w-md w-full p-6 space-y-4 bg-white font-mono">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="text-base font-hypercard-header text-black flex items-center gap-2">
                <Plus className="w-5 h-5 text-black" />
                {activeSubTab === 'classrooms' && 'Add New Classroom'}
                {activeSubTab === 'students' && 'Add New Student'}
                {activeSubTab === 'teachers' && 'Add New Teacher'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-black hover:bg-slate-200 border-2 border-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3 text-xs font-bold">
              {/* Form 1: Classroom */}
              {activeSubTab === 'classrooms' && (
                <>
                  <div>
                    <label className="block text-black mb-1">Classroom Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Grade 12-A"
                      value={classroomForm.name}
                      onChange={(e) => setClassroomForm({ ...classroomForm, name: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-black mb-1">Room / Lab Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Science Lab 3"
                      value={classroomForm.room}
                      onChange={(e) => setClassroomForm({ ...classroomForm, room: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-black mb-1">Lead Instructor</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Anitha"
                      value={classroomForm.leadTeacher}
                      onChange={(e) => setClassroomForm({ ...classroomForm, leadTeacher: e.target.value })}
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    />
                  </div>
                </>
              )}

              {/* Form 2: Student */}
              {activeSubTab === 'students' && (
                <>
                  <div>
                    <label className="block text-black mb-1">Full Student Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Maya Patel"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-black mb-1">Roll / Student ID Number</label>
                    <input
                      type="text"
                      placeholder="e.g. STU-1045"
                      value={studentForm.rollNo}
                      onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-black mb-1">Assigned Classroom</label>
                    <select
                      value={studentForm.className}
                      onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })}
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    >
                      {classrooms.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-black mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. maya@classpulse.edu"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    />
                  </div>
                </>
              )}

              {/* Form 3: Teacher */}
              {activeSubTab === 'teachers' && (
                <>
                  <div>
                    <label className="block text-black mb-1">Teacher Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Prof. Vikram Seth"
                      value={teacherForm.name}
                      onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-black mb-1">Staff ID Number</label>
                    <input
                      type="text"
                      placeholder="e.g. TCH-508"
                      value={teacherForm.staffId}
                      onChange={(e) => setTeacherForm({ ...teacherForm, staffId: e.target.value })}
                      required
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-black mb-1">Department / Subject Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Physics & Astronomy"
                      value={teacherForm.department}
                      onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })}
                      className="w-full p-2.5 border-2 border-black rounded text-black font-bold"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-black font-bold rounded border-2 border-black cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-300 text-black font-extrabold rounded border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-mono">
          <div className="hypercard-card max-w-md w-full p-6 space-y-4 bg-[#fff1f2]">
            <div className="flex items-center gap-3 border-b-2 border-black pb-3">
              <div className="w-10 h-10 rounded bg-rose-200 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000] shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <h3 className="text-base font-hypercard-header text-black">Confirm Deletion</h3>
                <p className="text-[10px] font-mono font-bold text-slate-700 uppercase">HyperCard Stack Warning</p>
              </div>
            </div>

            <p className="text-xs font-bold text-black leading-relaxed">
              Are you sure you want to delete <span className="bg-yellow-200 px-1.5 py-0.5 border border-black">{deleteConfirm.name}</span> from the stack index? This will unassign associated timetables and rosters.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' })}
                className="px-4 py-2 bg-white text-black font-bold rounded border-2 border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
              >
                Cancel (Keep)
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-2 bg-rose-600 text-white font-extrabold rounded border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer uppercase tracking-wider text-xs"
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
