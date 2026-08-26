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
  Sliders,
  UserPlus,
  ArrowLeft
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

  // Active Sub-Tab: 'access' | 'classrooms' | 'teachers' | 'students' | 'timetables'
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
    type: null, // 'classroom' | 'teacher' | 'student'
    id: null,
    name: ''
  });

  // Consolidated Admin Section Dropdown Items (Assign Teachers/Students merged into Classrooms)
  const cardsList = [
    { id: 'access', label: 'Control Access', icon: Lock, num: 1 },
    { id: 'classrooms', label: 'Classrooms', icon: Building, num: 2 },
    { id: 'teachers', label: 'Teachers', icon: UserCheck, num: 3 },
    { id: 'students', label: 'Students', icon: GraduationCap, num: 4 },
    { id: 'timetables', label: 'Timetables', icon: Calendar, num: 5 }
  ];

  const currentCardIndex = cardsList.findIndex(c => c.id === activeSubTab);

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
      setClassroomForm({ name: '', room: '', gradeLevel: 'Grade 10', leadTeacher: teachers[0]?.name || 'Dr. Anitha', studentCount: 35, description: '' });
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

  // Handle Inline Teacher Assignment inside Classroom Detail
  const handleInlineTeacherAssign = (e, classroomId) => {
    e.preventDefault();
    if (!selectedTeacherForInline) return;
    assignTeacherToClassroom(classroomId, selectedTeacherForInline);
  };

  // Handle Inline Student Assignment inside Classroom Detail
  const handleInlineStudentAssign = (e, className) => {
    e.preventDefault();
    if (!selectedStudentForInline) return;
    assignStudentToClassroom(selectedStudentForInline, className);
  };

  // Handle Adding Timetable Slot
  const handleAddTimetableSlot = (e) => {
    e.preventDefault();
    addTimetableSlot(selectedTimetableClass, selectedTimetableDay, newSlotForm);
    setNewSlotForm({ time: '02:30 - 03:30 PM', subject: '', teacher: teachers[0]?.name || 'Dr. Anitha', room: 'Science Lab 2' });
  };

  const selectedClassroomObj = classrooms.find(c => c.id === selectedClassroomId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* HyperCard Window Title Bar & Header Controls */}
      <div className="hypercard-stack overflow-hidden">
        {/* Macintosh Window Title Bar */}
        <div className="bg-[#d5cfbf] border-b-2 border-black px-4 py-2 flex items-center justify-between font-mono text-xs font-black select-none">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-black bg-white flex items-center justify-center font-black text-[10px]">■</div>
            <span className="font-hypercard-header uppercase tracking-wider text-black text-sm">ADMIN CONTROL</span>
          </div>

          <div className="mac-title-bar h-3.5 w-32 border border-black hidden sm:block"></div>

          <div className="flex items-center gap-2 font-mono text-xs font-black text-black">
            <span>ADMINISTRATOR PORTAL</span>
          </div>
        </div>

        {/* HyperCard Header Controls */}
        <div className="p-5 bg-[#f7f4ed] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-black font-hypercard-header uppercase tracking-tight flex items-center gap-2">
                Admin Control
              </h2>
            </div>

            {/* Admin Section Dropdown Controller */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-yellow-300 border-2 border-black px-3.5 py-2 rounded-lg shadow-[3px_3px_0px_0px_#000]">
                <span className="font-mono text-xs font-black text-black uppercase shrink-0">
                  🗂️ Select Admin Section:
                </span>
                <select
                  value={activeSubTab}
                  onChange={(e) => {
                    setActiveSubTab(e.target.value);
                    if (e.target.value !== 'classrooms') {
                      setSelectedClassroomId(null);
                    }
                  }}
                  className="bg-white border-2 border-black text-xs font-mono font-black text-black px-3 py-1.5 rounded cursor-pointer shadow-[1px_1px_0px_0px_#000] focus:outline-none"
                >
                  {cardsList.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.label}
                    </option>
                  ))}
                </select>
              </div>

              {['classrooms', 'students', 'teachers'].includes(activeSubTab) && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 hypercard-btn-primary text-xs font-mono font-black uppercase flex items-center gap-1.5 cursor-pointer ml-1 shadow-[3px_3px_0px_0px_#000]"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>
                    {activeSubTab === 'classrooms' && 'New Classroom'}
                    {activeSubTab === 'students' && 'New Student'}
                    {activeSubTab === 'teachers' && 'New Teacher'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- SECTION 1: CONTROL ACCESS ----------------- */}
      {activeSubTab === 'access' && (
        <div className="space-y-6">
          {/* Role Permissions Matrix Table */}
          <div className="hypercard-card overflow-hidden border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="p-3 bg-black text-white font-mono text-xs font-black uppercase tracking-wider flex items-center justify-between border-b-2 border-black">
              <span>SYSTEM PERMISSIONS BY ROLE</span>
              <span>ADMIN CONFIGURABLE</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#e8e3d5] border-b-2 border-black font-black uppercase tracking-wider text-black">
                  <tr>
                    <th className="px-4 py-3.5 border-r-2 border-black text-sm">Permission Feature</th>
                    <th className="px-4 py-3.5 border-r-2 border-black bg-yellow-200 text-sm">🔐 Admin</th>
                    <th className="px-4 py-3.5 border-r-2 border-black bg-sky-200 text-sm">👨‍🏫 Teacher</th>
                    <th className="px-4 py-3.5 bg-emerald-200 text-sm">🎓 Student</th>
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
                    <tr key={perm.key} className="hover:bg-yellow-50 font-black">
                      <td className="px-4 py-3.5 text-black border-r-2 border-black text-xs font-black">
                        {perm.label}
                      </td>
                      {['Admin', 'Teacher', 'Student'].map((role) => {
                        const isGranted = accessControls.roles[role]?.permissions[perm.key];
                        return (
                          <td key={role} className="px-4 py-3.5 border-r-2 border-black text-center">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!isGranted}
                                onChange={() => toggleUserPermission(role, perm.key)}
                                className="w-4.5 h-4.5 rounded border-2 border-black text-black accent-black cursor-pointer"
                              />
                              <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 border-2 border-black shadow-[1px_1px_0px_0px_#000] ${
                                isGranted ? 'bg-emerald-300 text-black' : 'bg-rose-300 text-black'
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
            <div className="hypercard-card p-5 space-y-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
              <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                <h3 className="text-base font-hypercard-header text-black flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-black stroke-[3]" />
                  Teacher Account Controls
                </h3>
                <span className="text-xs font-mono font-black bg-sky-200 px-2.5 py-0.5 border-2 border-black text-black">
                  {teachers.length} Accounts
                </span>
              </div>

              <div className="space-y-2.5">
                {teachers.map((t) => (
                  <div key={t.id} className="p-3 bg-[#f7f4ed] border-2 border-black rounded-lg flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-black text-black text-sm">{t.name}</div>
                      <div className="text-xs font-black text-slate-800">{t.staffId} • {t.department}</div>
                    </div>
                    <button
                      onClick={() => toggleUserStatus(t.id, 'teacher')}
                      className={`px-3 py-1.5 border-2 border-black text-xs font-black cursor-pointer transition shadow-[2px_2px_0px_0px_#000] ${
                        t.status === 'Active' ? 'bg-emerald-300 text-black' : 'bg-rose-300 text-black'
                      }`}
                    >
                      {t.status === 'Active' ? 'ACTIVE' : 'SUSPENDED'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Students Account Control */}
            <div className="hypercard-card p-5 space-y-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
              <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                <h3 className="text-base font-hypercard-header text-black flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-black stroke-[3]" />
                  Student Roster Controls
                </h3>
                <span className="text-xs font-mono font-black bg-emerald-200 px-2.5 py-0.5 border-2 border-black text-black">
                  {students.length} Accounts
                </span>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {students.map((s) => (
                  <div key={s.id} className="p-3 bg-[#f7f4ed] border-2 border-black rounded-lg flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-black text-black text-sm">{s.name}</div>
                      <div className="text-xs font-black text-slate-800">{s.rollNo} • {s.className}</div>
                    </div>
                    <button
                      onClick={() => toggleUserStatus(s.id, 'student')}
                      className={`px-3 py-1.5 border-2 border-black text-xs font-black cursor-pointer transition shadow-[2px_2px_0px_0px_#000] ${
                        s.status === 'Active' ? 'bg-emerald-300 text-black' : 'bg-rose-300 text-black'
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

      {/* ----------------- SECTION 2: CLASSROOMS (WITH INTERACTIVE DRILL-DOWN) ----------------- */}
      {activeSubTab === 'classrooms' && (
        <div>
          {/* CASE A: ALL CLASSROOMS GRID VIEW */}
          {!selectedClassroomId && (
            <div className="space-y-4 font-mono">
              <div className="bg-yellow-200 border-2 border-black p-3 rounded-lg shadow-[3px_3px_0px_0px_#000] text-xs font-black text-black flex items-center justify-between">
                <span>🏫 Click on any classroom card below to view enrolled students and assign teachers!</span>
                <span className="bg-black text-yellow-300 px-2.5 py-0.5 rounded text-xs font-black uppercase">
                  {classrooms.length} Classrooms Available
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {classrooms
                  .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.room.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((cls, idx) => {
                    const enrolledCount = students.filter(s => s.className === cls.name).length;
                    return (
                      <div
                        key={cls.id}
                        onClick={() => setSelectedClassroomId(cls.id)}
                        className={`hypercard-card p-5 space-y-4 relative cursor-pointer border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:-translate-y-1 transition ${
                          idx % 3 === 0 ? 'bg-white' : idx % 3 === 1 ? 'bg-yellow-50' : 'bg-sky-50'
                        }`}
                      >
                        <div className="flex items-start justify-between border-b-2 border-black pb-3 font-mono">
                          <div>
                            <span className="text-xs font-mono font-black bg-black text-white px-2 py-0.5 rounded">
                              ID: {cls.id}
                            </span>
                            <h3 className="text-2xl font-black font-hypercard-header text-black mt-1">{cls.name}</h3>
                            <span className="text-xs font-black text-slate-800">{cls.room}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDelete('classroom', cls.id, cls.name);
                            }}
                            className="p-1.5 text-black hover:bg-rose-200 rounded border-2 border-black cursor-pointer"
                            title="Delete Classroom"
                          >
                            <Trash2 className="w-4.5 h-4.5 stroke-[2.5]" />
                          </button>
                        </div>

                        <div className="space-y-2.5 text-xs font-mono text-black">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800">Lead Instructor:</span>
                            <span className="font-black text-black bg-yellow-300 px-2 py-0.5 border-2 border-black">
                              👨‍🏫 {cls.leadTeacher}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800">Grade Stream:</span>
                            <span className="font-black text-black text-sm">{cls.gradeLevel || 'Grade 10'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800">Enrolled Students:</span>
                            <span className="font-black text-black flex items-center gap-1 bg-emerald-300 px-2 py-0.5 border-2 border-black text-xs">
                              <Users className="w-4 h-4 text-black stroke-[2.5]" />
                              {enrolledCount} Students
                            </span>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClassroomId(cls.id);
                            }}
                            className="w-full py-2.5 hypercard-btn-primary text-xs font-mono font-black flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]"
                          >
                            <Users className="w-4 h-4 stroke-[2.5]" />
                            <span>View Classroom →</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* CASE B: INTERACTIVE CLASSROOM DRILL-DOWN INSPECTION VIEW */}
          {selectedClassroomId && selectedClassroomObj && (
            <div className="space-y-6">
              {/* Back Bar & Quick Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_#000]">
                <button
                  onClick={() => setSelectedClassroomId(null)}
                  className="px-4 py-2 hypercard-btn text-xs font-mono font-black flex items-center gap-2 cursor-pointer shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[3]" />
                  <span>← Back to All Classrooms Grid</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black text-black">Switch Classroom:</span>
                  <select
                    value={selectedClassroomId}
                    onChange={(e) => setSelectedClassroomId(e.target.value)}
                    className="p-2 bg-yellow-300 border-2 border-black text-xs font-mono font-black rounded cursor-pointer shadow-[2px_2px_0px_0px_#000]"
                  >
                    {classrooms.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.room})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Classroom Header Banner */}
              <div className="hypercard-card-yellow p-5 space-y-2 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
                <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                  <div>
                    <span className="bg-black text-yellow-300 text-xs font-mono font-black px-2.5 py-0.5 rounded uppercase">
                      CLASSROOM DRILL-DOWN DETAILS
                    </span>
                    <h2 className="text-3xl font-black font-hypercard-header text-black mt-1">
                      🏫 {selectedClassroomObj.name} ({selectedClassroomObj.room})
                    </h2>
                  </div>
                  <button
                    onClick={() => requestDelete('classroom', selectedClassroomObj.id, selectedClassroomObj.name)}
                    className="px-3.5 py-2 bg-rose-300 border-2 border-black text-xs font-mono font-black hover:bg-rose-400 rounded flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_#000]"
                  >
                    <Trash2 className="w-4 h-4 text-black stroke-[2.5]" />
                    <span>Delete Classroom</span>
                  </button>
                </div>
                <p className="text-xs font-mono font-black text-black">
                  {selectedClassroomObj.description || 'Specialization stream'} • Grade Stream: {selectedClassroomObj.gradeLevel} • Capacity: {selectedClassroomObj.studentCount} Students
                </p>
              </div>

              {/* Two Column Layout: Assign Lead Teacher & Manage Student Roster */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
                {/* Left Column: Assigned Lead Teacher Control Card */}
                <div className="lg:col-span-5 hypercard-card-sky p-5 space-y-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
                  <div className="border-b-2 border-black pb-2.5">
                    <h3 className="text-base font-hypercard-header text-black flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-black stroke-[3]" />
                      Lead Teacher Assignment
                    </h3>
                    <p className="text-xs font-black text-slate-900">Assigned Lead Instructor for {selectedClassroomObj.name}.</p>
                  </div>

                  {/* Current Lead Teacher Display */}
                  <div className="p-4 bg-white border-2 border-black rounded-lg space-y-2 shadow-[2px_2px_0px_0px_#000]">
                    <span className="text-xs font-black uppercase text-slate-800">CURRENT LEAD TEACHER:</span>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-yellow-300 border-2 border-black font-hypercard-header flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_#000]">
                        👨‍🏫
                      </div>
                      <div>
                        <div className="text-lg font-black text-black">{selectedClassroomObj.leadTeacher}</div>
                        <div className="text-xs font-black text-slate-800">Primary Lead Instructor</div>
                      </div>
                    </div>
                  </div>

                  {/* Change / Reassign Lead Teacher Form */}
                  <form
                    onSubmit={(e) => handleInlineTeacherAssign(e, selectedClassroomObj.id)}
                    className="p-4 bg-white border-2 border-black rounded-lg space-y-3 shadow-[2px_2px_0px_0px_#000]"
                  >
                    <label className="block text-xs font-black text-black uppercase">
                      Select New Lead Teacher:
                    </label>
                    <select
                      value={selectedTeacherForInline}
                      onChange={(e) => setSelectedTeacherForInline(e.target.value)}
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black text-xs font-black text-black rounded"
                    >
                      <option value="">-- Choose Instructor --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.staffId}) — {t.department}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="w-full py-2.5 hypercard-btn-primary text-xs font-black flex items-center justify-center gap-2 cursor-pointer uppercase shadow-[2px_2px_0px_0px_#000]"
                    >
                      <Link className="w-4 h-4 stroke-[2.5]" />
                      <span>Assign Selected Teacher</span>
                    </button>
                  </form>
                </div>

                {/* Right Column: Enrolled Students Roster & Add Student Form */}
                <div className="lg:col-span-7 hypercard-card p-5 space-y-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000]">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                    <h3 className="text-base font-hypercard-header text-black flex items-center gap-2">
                      <Users className="w-5 h-5 text-black stroke-[3]" />
                      Classroom Roster ({students.filter(s => s.className === selectedClassroomObj.name).length} Students)
                    </h3>
                  </div>

                  {/* Inline Add / Move Student Form */}
                  <form
                    onSubmit={(e) => handleInlineStudentAssign(e, selectedClassroomObj.name)}
                    className="p-4 bg-emerald-200 border-2 border-black rounded-lg space-y-3 shadow-[2px_2px_0px_0px_#000]"
                  >
                    <label className="block text-xs font-black text-black uppercase">
                      ➕ Add / Assign Student to {selectedClassroomObj.name}:
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        value={selectedStudentForInline}
                        onChange={(e) => setSelectedStudentForInline(e.target.value)}
                        className="flex-1 p-2.5 bg-white border-2 border-black text-xs font-black text-black rounded"
                      >
                        <option value="">-- Choose Student from Directory --</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.rollNo}) — Currently in {s.className}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-4 py-2.5 hypercard-btn-primary text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer uppercase shrink-0 shadow-[2px_2px_0px_0px_#000]"
                      >
                        <UserPlus className="w-4 h-4 stroke-[2.5]" />
                        <span>Add to Classroom</span>
                      </button>
                    </div>
                  </form>

                  {/* Enrolled Students Table */}
                  <div className="border-2 border-black rounded-lg overflow-hidden">
                    <div className="bg-black text-white p-2.5 text-xs font-black uppercase tracking-wider flex justify-between">
                      <span>STUDENT ROSTER</span>
                      <span>ENROLLED MEMBERS</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#e8e3d5] border-b-2 border-black font-black uppercase text-black">
                          <tr>
                            <th className="px-3.5 py-2.5 border-r-2 border-black">Roll No</th>
                            <th className="px-3.5 py-2.5 border-r-2 border-black">Name</th>
                            <th className="px-3.5 py-2.5 border-r-2 border-black">Email</th>
                            <th className="px-3.5 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y-2 border-black bg-white font-black text-black">
                          {students.filter(s => s.className === selectedClassroomObj.name).length === 0 ? (
                            <tr>
                              <td colSpan="4" className="p-6 text-center text-black font-mono text-xs font-black">
                                No students currently assigned to {selectedClassroomObj.name}. Use the box above to add students!
                              </td>
                            </tr>
                          ) : (
                            students
                              .filter(s => s.className === selectedClassroomObj.name)
                              .map((s) => (
                                <tr key={s.id} className="hover:bg-yellow-50">
                                  <td className="px-3.5 py-2.5 border-r-2 border-black font-mono">
                                    <span className="bg-sky-200 px-2 py-0.5 border border-black font-black">{s.rollNo}</span>
                                  </td>
                                  <td className="px-3.5 py-2.5 border-r-2 border-black font-black text-sm">{s.name}</td>
                                  <td className="px-3.5 py-2.5 border-r-2 border-black text-slate-800 text-xs font-extrabold">{s.email}</td>
                                  <td className="px-3.5 py-2.5 text-right">
                                    <button
                                      onClick={() => assignStudentToClassroom(s.id, 'Unassigned')}
                                      className="px-2.5 py-1 bg-rose-200 hover:bg-rose-300 border border-black text-xs font-black text-black rounded cursor-pointer"
                                      title="Remove student from classroom"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------- SECTION 3: TEACHERS ----------------- */}
      {activeSubTab === 'teachers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
          {teachers
            .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.department.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((t) => (
              <div key={t.id} className="hypercard-card p-5 space-y-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000]">
                <div className="flex items-start justify-between border-b-2 border-black pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-yellow-300 border-2 border-black text-black font-hypercard-header flex items-center justify-center text-base font-black shadow-[2px_2px_0px_0px_#000]">
                      {t.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="font-mono">
                      <h3 className="text-base font-black text-black">{t.name}</h3>
                      <span className="text-xs font-mono font-black text-black bg-sky-200 px-2 py-0.5 border border-black">{t.staffId}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => requestDelete('teacher', t.id, t.name)}
                    className="p-1.5 text-black hover:bg-rose-200 rounded border-2 border-black cursor-pointer"
                    title="Delete Teacher"
                  >
                    <Trash2 className="w-4.5 h-4.5 stroke-[2.5]" />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs font-mono text-black">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-black stroke-[2.5]" />
                    <span><strong>Dept:</strong> {t.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-black stroke-[2.5]" />
                    <span><strong>Email:</strong> {t.email}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs font-black text-black block mb-1 uppercase tracking-wider">Assigned Classes:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(t.assignedClasses) ? t.assignedClasses : [t.assignedClasses]).map((c, i) => (
                        <span key={i} className="px-2.5 py-0.5 bg-sky-200 text-black text-xs font-black border border-black">
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

      {/* ----------------- SECTION 4: STUDENTS ----------------- */}
      {activeSubTab === 'students' && (
        <div className="hypercard-card overflow-hidden border-2 border-black shadow-[4px_4px_0px_0px_#000]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-black text-white font-black uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 border-r border-slate-700">Roll No</th>
                  <th className="px-4 py-3.5 border-r border-slate-700">Student Name</th>
                  <th className="px-4 py-3.5 border-r border-slate-700">Assigned Classroom</th>
                  <th className="px-4 py-3.5 border-r border-slate-700">Projector Nickname</th>
                  <th className="px-4 py-3.5 border-r border-slate-700">Email Address</th>
                  <th className="px-4 py-3.5 border-r border-slate-700">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black bg-white font-black">
                {students
                  .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNo.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(s => (
                    <tr key={s.id} className="hover:bg-yellow-50 transition">
                      <td className="px-4 py-3.5 border-r-2 border-black font-mono text-black font-black">{s.rollNo}</td>
                      <td className="px-4 py-3.5 border-r-2 border-black text-black font-black text-sm">{s.name}</td>
                      <td className="px-4 py-3.5 border-r-2 border-black text-black">
                        <span className="px-2.5 py-0.5 bg-sky-200 border border-black font-black">
                          {s.className}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 border-r-2 border-black">
                        <span className="px-2 py-0.5 bg-slate-100 text-black font-mono text-xs font-black border border-black">
                          {s.nickname || s.name.split(' ')[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 border-r-2 border-black text-slate-800 font-extrabold">{s.email}</td>
                      <td className="px-4 py-3.5 border-r-2 border-black">
                        <span className={`px-2.5 py-0.5 font-black text-xs uppercase border border-black ${
                          s.status === 'Active' ? 'bg-emerald-300 text-black' : 'bg-rose-300 text-black'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => requestDelete('student', s.id, s.name)}
                          className="p-1.5 text-black hover:bg-rose-200 rounded border border-black cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- SECTION 5: TIMETABLES ----------------- */}
      {activeSubTab === 'timetables' && (
        <div className="space-y-6">
          {/* Classroom & Day Selector Bar */}
          <div className="hypercard-card-yellow p-5 space-y-4 font-mono border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xl font-hypercard-header text-black mt-1">Classroom Weekly Timetable</h3>
                <p className="text-xs font-black text-slate-900">Assign subjects, time slots, and teachers to weekly classroom schedules.</p>
              </div>

              {/* Classroom Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-black uppercase">Class:</span>
                <select
                  value={selectedTimetableClass}
                  onChange={(e) => setSelectedTimetableClass(e.target.value)}
                  className="p-2 bg-white border-2 border-black text-xs font-black text-black rounded shadow-[2px_2px_0px_0px_#000]"
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
                  className={`px-4 py-2 rounded text-xs font-black border-2 border-black transition cursor-pointer ${
                    selectedTimetableDay === day
                      ? 'bg-black text-yellow-300 shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-white text-black hover:bg-yellow-100'
                  }`}
                >
                  📅 {day}
                </button>
              ))}
            </div>
          </div>

          {/* Timetable Grid & Slot Addition */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
            {/* Left Column: Current Day Schedule Cards */}
            <div className="lg:col-span-7 space-y-3">
              <div className="p-3 bg-black text-white text-xs font-black uppercase flex items-center justify-between border-2 border-black rounded-lg">
                <span>{selectedTimetableClass} — {selectedTimetableDay} Schedule</span>
                <span className="bg-yellow-300 text-black px-2 py-0.5 rounded text-xs font-black">
                  {(timetables[selectedTimetableClass]?.[selectedTimetableDay] || []).length} Sessions
                </span>
              </div>

              {(timetables[selectedTimetableClass]?.[selectedTimetableDay] || []).length === 0 ? (
                <div className="p-8 text-center bg-white border-2 border-black rounded-lg text-xs font-black text-black">
                  No sessions scheduled for {selectedTimetableDay} yet. Use the form to add slots!
                </div>
              ) : (
                (timetables[selectedTimetableClass]?.[selectedTimetableDay] || []).map((slot, idx) => (
                  <div key={idx} className="p-4 bg-white border-2 border-black rounded-lg flex items-center justify-between text-xs shadow-[3px_3px_0px_0px_#000]">
                    <div className="space-y-1">
                      <div className="font-black text-black text-base">{slot.subject}</div>
                      <div className="text-black text-xs font-black flex items-center gap-2">
                        <Clock className="w-4 h-4 text-black stroke-[2.5]" />
                        <span>{slot.time} • Room: {slot.room}</span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-sky-200 text-black font-black border-2 border-black rounded text-xs">
                      👨‍🏫 {slot.teacher}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Right Column: Add New Timetable Slot Form */}
            <div className="lg:col-span-5 hypercard-card-mint p-5 space-y-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
              <div className="border-b-2 border-black pb-2">
                <h3 className="text-base font-hypercard-header text-black">Add Timetable Slot</h3>
                <p className="text-xs font-black text-black">Add a period to {selectedTimetableClass} on {selectedTimetableDay}.</p>
              </div>

              <form onSubmit={handleAddTimetableSlot} className="space-y-3 text-xs font-black">
                <div>
                  <label className="block text-black mb-1 font-black">Time Interval:</label>
                  <input
                    type="text"
                    value={newSlotForm.time}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, time: e.target.value })}
                    className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-black"
                    placeholder="e.g. 09:00 - 10:00 AM"
                    required
                  />
                </div>

                <div>
                  <label className="block text-black mb-1 font-black">Subject Name:</label>
                  <input
                    type="text"
                    value={newSlotForm.subject}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                    className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-black"
                    placeholder="e.g. Biology Lab"
                    required
                  />
                </div>

                <div>
                  <label className="block text-black mb-1 font-black">Assigned Instructor:</label>
                  <select
                    value={newSlotForm.teacher}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, teacher: e.target.value })}
                    className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-black"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.department})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-black mb-1 font-black">Room / Lab Number:</label>
                  <input
                    type="text"
                    value={newSlotForm.room}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, room: e.target.value })}
                    className="w-full p-2.5 bg-white border-2 border-black rounded text-black font-black"
                    placeholder="e.g. Science Lab 2"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 hypercard-btn-primary text-xs font-black flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider mt-2 shadow-[2px_2px_0px_0px_#000]"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add Slot to Schedule</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Item Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="hypercard-card w-full max-w-lg p-6 bg-white space-y-4 border-2 border-black shadow-[6px_6px_0px_0px_#000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-3 font-mono">
              <h3 className="text-lg font-hypercard-header text-black">
                {activeSubTab === 'classrooms' && '🏫 Add New Classroom Section'}
                {activeSubTab === 'students' && '🎓 Register New Student'}
                {activeSubTab === 'teachers' && '👨‍🏫 Register New Teacher'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-200 rounded border border-black cursor-pointer"
              >
                <X className="w-5 h-5 text-black stroke-[3]" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-mono font-black text-black">
              {activeSubTab === 'classrooms' && (
                <>
                  <div>
                    <label className="block text-black mb-1 font-black uppercase">Classroom Name:</label>
                    <input
                      type="text"
                      value={classroomForm.name}
                      onChange={(e) => setClassroomForm({ ...classroomForm, name: e.target.value })}
                      placeholder="e.g. Grade 12-A"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-black mb-1 font-black uppercase">Room Number:</label>
                      <input
                        type="text"
                        value={classroomForm.room}
                        onChange={(e) => setClassroomForm({ ...classroomForm, room: e.target.value })}
                        placeholder="e.g. Room 402"
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-black mb-1 font-black uppercase">Grade Level:</label>
                      <select
                        value={classroomForm.gradeLevel}
                        onChange={(e) => setClassroomForm({ ...classroomForm, gradeLevel: e.target.value })}
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                      >
                        <option value="Grade 9">Grade 9</option>
                        <option value="Grade 10">Grade 10</option>
                        <option value="Grade 11">Grade 11</option>
                        <option value="Grade 12">Grade 12</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-black mb-1 font-black uppercase">Lead Instructor:</label>
                    <select
                      value={classroomForm.leadTeacher}
                      onChange={(e) => setClassroomForm({ ...classroomForm, leadTeacher: e.target.value })}
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                    >
                      {teachers.map(t => (
                        <option key={t.id} value={t.name}>{t.name} ({t.department})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeSubTab === 'students' && (
                <>
                  <div>
                    <label className="block text-black mb-1 font-black uppercase">Student Full Name:</label>
                    <input
                      type="text"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      placeholder="e.g. Ananya Harish"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-black mb-1 font-black uppercase">Roll Number:</label>
                      <input
                        type="text"
                        value={studentForm.rollNo}
                        onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                        placeholder="e.g. STU-1008"
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-black mb-1 font-black uppercase">Assigned Classroom:</label>
                      <select
                        value={studentForm.className}
                        onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })}
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                      >
                        {classrooms.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-black mb-1 font-black uppercase">Email Address:</label>
                    <input
                      type="email"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      placeholder="e.g. student@classpulse.edu"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                    />
                  </div>
                </>
              )}

              {activeSubTab === 'teachers' && (
                <>
                  <div>
                    <label className="block text-black mb-1 font-black uppercase">Teacher Full Name:</label>
                    <input
                      type="text"
                      value={teacherForm.name}
                      onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                      placeholder="e.g. Dr. Anitha"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-black mb-1 font-black uppercase">Staff ID:</label>
                      <input
                        type="text"
                        value={teacherForm.staffId}
                        onChange={(e) => setTeacherForm({ ...teacherForm, staffId: e.target.value })}
                        placeholder="e.g. TCH-508"
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-black mb-1 font-black uppercase">Department:</label>
                      <input
                        type="text"
                        value={teacherForm.department}
                        onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })}
                        placeholder="e.g. Biology & Science"
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-black mb-1 font-black uppercase">Email Address:</label>
                    <input
                      type="email"
                      value={teacherForm.email}
                      onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                      placeholder="e.g. teacher@classpulse.edu"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded font-black text-black"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 flex items-center justify-end gap-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 hypercard-btn text-xs font-black cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 hypercard-btn-primary text-xs font-black cursor-pointer uppercase shadow-[2px_2px_0px_0px_#000]"
                >
                  Create & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Guard Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-mono">
          <div className="hypercard-card w-full max-w-md p-6 bg-white space-y-4 border-2 border-black shadow-[6px_6px_0px_0px_#000]">
            <div className="flex items-center gap-3 text-rose-600 border-b-2 border-black pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0 stroke-[3]" />
              <h3 className="text-base font-hypercard-header text-black">Confirm Deletion</h3>
            </div>
            <p className="text-xs font-black text-black">
              Are you sure you want to delete <span className="underline">{deleteConfirm.name}</span>? This action will remove the record.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2 border-t-2 border-black">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' })}
                className="px-4 py-2 hypercard-btn text-xs font-black cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-5 py-2 bg-rose-600 text-white font-black border-2 border-black text-xs hover:bg-rose-700 rounded shadow-[2px_2px_0px_0px_#000] cursor-pointer uppercase"
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
