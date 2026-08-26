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
        <div className="bg-[#d5cfbf] border-b-2 border-black px-4 py-2 flex items-center justify-between font-mono text-xs font-bold select-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-black bg-white flex items-center justify-center font-bold text-[9px]">■</div>
            <span className="font-hypercard-header uppercase tracking-wider text-black">ADMIN CONTROL</span>
          </div>

          <div className="mac-title-bar h-3.5 w-32 border border-black hidden sm:block"></div>

          <div className="flex items-center gap-2 font-mono text-xs font-bold text-black">
            <span>ADMINISTRATOR PORTAL</span>
          </div>
        </div>

        {/* HyperCard Header Controls */}
        <div className="p-5 bg-[#f7f4ed] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-black font-hypercard-header uppercase tracking-tight flex items-center gap-2">
                Admin Control
              </h2>
            </div>

            {/* Admin Section Dropdown Controller */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-yellow-200 border-2 border-black px-3 py-1.5 rounded-lg shadow-[2px_2px_0px_0px_#000]">
                <span className="font-mono text-xs font-bold text-black uppercase shrink-0">
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
                  className="bg-white border-2 border-black text-xs font-mono font-bold text-black px-3 py-1 rounded cursor-pointer shadow-[1px_1px_0px_0px_#000] focus:outline-none"
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
                  className="px-4 py-1.5 hypercard-btn-primary text-xs flex items-center gap-1.5 cursor-pointer ml-1"
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
        </div>
      </div>

      {/* ----------------- SECTION 1: CONTROL ACCESS ----------------- */}
      {activeSubTab === 'access' && (
        <div className="space-y-6">
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

      {/* ----------------- SECTION 2: CLASSROOMS (WITH INTERACTIVE DRILL-DOWN) ----------------- */}
      {activeSubTab === 'classrooms' && (
        <div>
          {/* CASE A: ALL CLASSROOMS GRID VIEW */}
          {!selectedClassroomId && (
            <div className="space-y-4">
              <div className="bg-yellow-100 border-2 border-black p-3 rounded-lg shadow-[2px_2px_0px_0px_#000] text-xs font-mono font-bold text-black flex items-center justify-between">
                <span>🏫 Click on any classroom to view enrolled students and assign teachers directly!</span>
                <span className="bg-black text-white px-2 py-0.5 rounded text-[10px] uppercase">
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
                        className={`hypercard-card p-5 space-y-4 relative cursor-pointer hover:translate-x-1 hover:-translate-y-1 transition ${
                          idx % 3 === 0 ? 'bg-white' : idx % 3 === 1 ? 'bg-yellow-50' : 'bg-sky-50'
                        }`}
                      >
                        <div className="flex items-start justify-between border-b-2 border-black pb-3 font-mono">
                          <div>
                            <span className="text-[10px] font-mono font-bold bg-black text-white px-2 py-0.5 rounded">
                              ID: {cls.id}
                            </span>
                            <h3 className="text-xl font-hypercard-header text-black mt-1">{cls.name}</h3>
                            <span className="text-xs font-bold text-slate-700">{cls.room}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDelete('classroom', cls.id, cls.name);
                            }}
                            className="p-1.5 text-black hover:bg-rose-200 rounded border-2 border-black cursor-pointer"
                            title="Delete Classroom"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2 text-xs font-mono text-black">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700">Lead Instructor:</span>
                            <span className="font-bold text-black bg-yellow-200 px-2 py-0.5 border border-black">
                              👨‍🏫 {cls.leadTeacher}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700">Grade Stream:</span>
                            <span className="font-bold text-black">{cls.gradeLevel || 'Grade 10'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700">Enrolled Students:</span>
                            <span className="font-bold text-black flex items-center gap-1 bg-emerald-200 px-2 py-0.5 border border-black">
                              <Users className="w-3.5 h-3.5 text-black" />
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
                            className="w-full py-2 hypercard-btn-primary text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer uppercase"
                          >
                            <Users className="w-4 h-4" />
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_#000]">
                <button
                  onClick={() => setSelectedClassroomId(null)}
                  className="px-4 py-2 hypercard-btn text-xs font-mono font-bold flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>← Back to All Classrooms Grid</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-black">Switch Classroom:</span>
                  <select
                    value={selectedClassroomId}
                    onChange={(e) => setSelectedClassroomId(e.target.value)}
                    className="p-1.5 bg-yellow-200 border-2 border-black text-xs font-mono font-bold rounded cursor-pointer"
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
              <div className="hypercard-card-yellow p-5 space-y-2">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <div>
                    <span className="bg-black text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                      CLASSROOM DRILL-DOWN DETAILS
                    </span>
                    <h2 className="text-2xl font-black font-hypercard-header text-black mt-1">
                      🏫 {selectedClassroomObj.name} ({selectedClassroomObj.room})
                    </h2>
                  </div>
                  <button
                    onClick={() => requestDelete('classroom', selectedClassroomObj.id, selectedClassroomObj.name)}
                    className="px-3 py-1.5 bg-rose-200 border-2 border-black text-xs font-mono font-bold hover:bg-rose-300 rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-black" />
                    <span>Delete Classroom</span>
                  </button>
                </div>
                <p className="text-xs font-mono font-bold text-slate-800">
                  {selectedClassroomObj.description || 'Specialization stream'} • Grade Stream: {selectedClassroomObj.gradeLevel} • Capacity: {selectedClassroomObj.studentCount} Students
                </p>
              </div>

              {/* Two Column Layout: Assign Lead Teacher & Manage Student Roster */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
                {/* Left Column: Assigned Lead Teacher Control Card */}
                <div className="lg:col-span-5 hypercard-card-sky p-5 space-y-4">
                  <div className="border-b-2 border-black pb-2">
                    <h3 className="text-base font-hypercard-header text-black flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-black" />
                      Lead Teacher Assignment
                    </h3>
                    <p className="text-xs text-slate-800">Assigned Lead Instructor for {selectedClassroomObj.name}.</p>
                  </div>

                  {/* Current Lead Teacher Display */}
                  <div className="p-4 bg-white border-2 border-black rounded-lg space-y-2 shadow-[2px_2px_0px_0px_#000]">
                    <span className="text-[10px] font-bold uppercase text-slate-600">CURRENT LEAD TEACHER:</span>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-yellow-200 border-2 border-black font-hypercard-header flex items-center justify-center text-sm">
                        👨‍🏫
                      </div>
                      <div>
                        <div className="text-base font-bold text-black">{selectedClassroomObj.leadTeacher}</div>
                        <div className="text-xs text-slate-700">Primary Lead Instructor</div>
                      </div>
                    </div>
                  </div>

                  {/* Change / Reassign Lead Teacher Form */}
                  <form
                    onSubmit={(e) => handleInlineTeacherAssign(e, selectedClassroomObj.id)}
                    className="p-4 bg-white border-2 border-black rounded-lg space-y-3 shadow-[2px_2px_0px_0px_#000]"
                  >
                    <label className="block text-xs font-bold text-black uppercase">
                      Select New Lead Teacher:
                    </label>
                    <select
                      value={selectedTeacherForInline}
                      onChange={(e) => setSelectedTeacherForInline(e.target.value)}
                      className="w-full p-2 bg-[#f7f4ed] border-2 border-black text-xs font-bold text-black rounded"
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
                      className="w-full py-2 hypercard-btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer uppercase"
                    >
                      <Link className="w-4 h-4" />
                      <span>Assign Selected Teacher</span>
                    </button>
                  </form>
                </div>

                {/* Right Column: Enrolled Students Roster & Add Student Form */}
                <div className="lg:col-span-7 hypercard-card p-5 space-y-4 bg-white">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <h3 className="text-base font-hypercard-header text-black flex items-center gap-2">
                      <Users className="w-5 h-5 text-black" />
                      Classroom Roster ({students.filter(s => s.className === selectedClassroomObj.name).length} Students)
                    </h3>
                  </div>

                  {/* Inline Add / Move Student Form */}
                  <form
                    onSubmit={(e) => handleInlineStudentAssign(e, selectedClassroomObj.name)}
                    className="p-4 bg-emerald-100 border-2 border-black rounded-lg space-y-3 shadow-[2px_2px_0px_0px_#000]"
                  >
                    <label className="block text-xs font-bold text-black uppercase">
                      ➕ Add / Assign Student to {selectedClassroomObj.name}:
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        value={selectedStudentForInline}
                        onChange={(e) => setSelectedStudentForInline(e.target.value)}
                        className="flex-1 p-2 bg-white border-2 border-black text-xs font-bold text-black rounded"
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
                        className="px-4 py-2 hypercard-btn-primary text-xs flex items-center justify-center gap-1.5 cursor-pointer uppercase shrink-0"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Add to Classroom</span>
                      </button>
                    </div>
                  </form>

                  {/* Enrolled Students Table */}
                  <div className="border-2 border-black rounded-lg overflow-hidden">
                    <div className="bg-black text-white p-2 text-xs font-bold uppercase tracking-wider flex justify-between">
                      <span>STUDENT ROSTER</span>
                      <span>ENROLLED MEMBERS</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#e8e3d5] border-b-2 border-black font-bold uppercase text-black">
                          <tr>
                            <th className="px-3 py-2 border-r border-black">Roll No</th>
                            <th className="px-3 py-2 border-r border-black">Name</th>
                            <th className="px-3 py-2 border-r border-black">Email</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y border-black bg-white font-bold text-black">
                          {students.filter(s => s.className === selectedClassroomObj.name).length === 0 ? (
                            <tr>
                              <td colSpan="4" className="p-6 text-center text-slate-500 font-mono text-xs">
                                No students currently assigned to {selectedClassroomObj.name}. Use the box above to add students!
                              </td>
                            </tr>
                          ) : (
                            students
                              .filter(s => s.className === selectedClassroomObj.name)
                              .map((s) => (
                                <tr key={s.id} className="hover:bg-yellow-50">
                                  <td className="px-3 py-2 border-r border-black font-mono">
                                    <span className="bg-sky-100 px-1.5 py-0.5 border border-black">{s.rollNo}</span>
                                  </td>
                                  <td className="px-3 py-2 border-r border-black">{s.name}</td>
                                  <td className="px-3 py-2 border-r border-black text-slate-700 text-[11px]">{s.email}</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => assignStudentToClassroom(s.id, 'Unassigned')}
                                      className="px-2 py-1 bg-rose-100 hover:bg-rose-200 border border-black text-[10px] font-bold text-black rounded cursor-pointer"
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

      {/* ----------------- SECTION 4: STUDENTS ----------------- */}
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

      {/* ----------------- SECTION 5: TIMETABLES ----------------- */}
      {activeSubTab === 'timetables' && (
        <div className="space-y-6">
          {/* Classroom & Day Selector Bar */}
          <div className="hypercard-card-yellow p-5 space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-3">
              <div>
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
              <div className="p-3 bg-black text-white text-xs font-bold uppercase flex items-center justify-between border-2 border-black rounded-lg">
                <span>{selectedTimetableClass} — {selectedTimetableDay} Schedule</span>
                <span className="bg-yellow-300 text-black px-2 py-0.5 rounded text-[10px]">
                  {(timetables[selectedTimetableClass]?.[selectedTimetableDay] || []).length} Sessions
                </span>
              </div>

              {(timetables[selectedTimetableClass]?.[selectedTimetableDay] || []).length === 0 ? (
                <div className="p-8 text-center bg-white border-2 border-black rounded-lg text-xs text-slate-600">
                  No sessions scheduled for {selectedTimetableDay} yet. Use the form to add slots!
                </div>
              ) : (
                (timetables[selectedTimetableClass]?.[selectedTimetableDay] || []).map((slot, idx) => (
                  <div key={idx} className="p-4 bg-white border-2 border-black rounded-lg flex items-center justify-between text-xs shadow-[2px_2px_0px_0px_#000]">
                    <div className="space-y-1">
                      <div className="font-bold text-black text-sm">{slot.subject}</div>
                      <div className="text-slate-700 text-[11px] flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-black" />
                        <span>{slot.time} • Room: {slot.room}</span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-sky-100 text-black font-bold border border-black rounded text-[11px]">
                      👨‍🏫 {slot.teacher}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Right Column: Add New Timetable Slot Form */}
            <div className="lg:col-span-5 hypercard-card-mint p-5 space-y-4">
              <div className="border-b-2 border-black pb-2">
                <h3 className="text-base font-hypercard-header text-black">Add Timetable Slot</h3>
                <p className="text-xs text-slate-800">Add a period to {selectedTimetableClass} on {selectedTimetableDay}.</p>
              </div>

              <form onSubmit={handleAddTimetableSlot} className="space-y-3 text-xs font-bold">
                <div>
                  <label className="block text-black mb-1">Time Interval:</label>
                  <input
                    type="text"
                    value={newSlotForm.time}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, time: e.target.value })}
                    className="w-full p-2 bg-white border-2 border-black rounded text-black font-bold"
                    placeholder="e.g. 09:00 - 10:00 AM"
                    required
                  />
                </div>

                <div>
                  <label className="block text-black mb-1">Subject Name:</label>
                  <input
                    type="text"
                    value={newSlotForm.subject}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                    className="w-full p-2 bg-white border-2 border-black rounded text-black font-bold"
                    placeholder="e.g. Biology Lab"
                    required
                  />
                </div>

                <div>
                  <label className="block text-black mb-1">Assigned Instructor:</label>
                  <select
                    value={newSlotForm.teacher}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, teacher: e.target.value })}
                    className="w-full p-2 bg-white border-2 border-black rounded text-black font-bold"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.department})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-black mb-1">Room / Lab Number:</label>
                  <input
                    type="text"
                    value={newSlotForm.room}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, room: e.target.value })}
                    className="w-full p-2 bg-white border-2 border-black rounded text-black font-bold"
                    placeholder="e.g. Science Lab 2"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 hypercard-btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider mt-2"
                >
                  <Plus className="w-4 h-4" />
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
          <div className="hypercard-card w-full max-w-lg p-6 bg-white space-y-4 shadow-[6px_6px_0px_0px_#000]">
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
                <X className="w-5 h-5 text-black" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-mono font-bold text-black">
              {activeSubTab === 'classrooms' && (
                <>
                  <div>
                    <label className="block text-black mb-1">Classroom Name:</label>
                    <input
                      type="text"
                      value={classroomForm.name}
                      onChange={(e) => setClassroomForm({ ...classroomForm, name: e.target.value })}
                      placeholder="e.g. Grade 12-A"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-black mb-1">Room Number:</label>
                      <input
                        type="text"
                        value={classroomForm.room}
                        onChange={(e) => setClassroomForm({ ...classroomForm, room: e.target.value })}
                        placeholder="e.g. Room 402"
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-black mb-1">Grade Level:</label>
                      <select
                        value={classroomForm.gradeLevel}
                        onChange={(e) => setClassroomForm({ ...classroomForm, gradeLevel: e.target.value })}
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                      >
                        <option value="Grade 9">Grade 9</option>
                        <option value="Grade 10">Grade 10</option>
                        <option value="Grade 11">Grade 11</option>
                        <option value="Grade 12">Grade 12</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-black mb-1">Lead Instructor:</label>
                    <select
                      value={classroomForm.leadTeacher}
                      onChange={(e) => setClassroomForm({ ...classroomForm, leadTeacher: e.target.value })}
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
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
                    <label className="block text-black mb-1">Student Full Name:</label>
                    <input
                      type="text"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      placeholder="e.g. Ananya Harish"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-black mb-1">Roll Number:</label>
                      <input
                        type="text"
                        value={studentForm.rollNo}
                        onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                        placeholder="e.g. STU-1008"
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-black mb-1">Assigned Classroom:</label>
                      <select
                        value={studentForm.className}
                        onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })}
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                      >
                        {classrooms.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-black mb-1">Email Address:</label>
                    <input
                      type="email"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      placeholder="e.g. student@classpulse.edu"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                    />
                  </div>
                </>
              )}

              {activeSubTab === 'teachers' && (
                <>
                  <div>
                    <label className="block text-black mb-1">Teacher Full Name:</label>
                    <input
                      type="text"
                      value={teacherForm.name}
                      onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                      placeholder="e.g. Dr. Anitha"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-black mb-1">Staff ID:</label>
                      <input
                        type="text"
                        value={teacherForm.staffId}
                        onChange={(e) => setTeacherForm({ ...teacherForm, staffId: e.target.value })}
                        placeholder="e.g. TCH-508"
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-black mb-1">Department:</label>
                      <input
                        type="text"
                        value={teacherForm.department}
                        onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })}
                        placeholder="e.g. Biology & Science"
                        className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-black mb-1">Email Address:</label>
                    <input
                      type="email"
                      value={teacherForm.email}
                      onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                      placeholder="e.g. teacher@classpulse.edu"
                      className="w-full p-2.5 bg-[#f7f4ed] border-2 border-black rounded"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 flex items-center justify-end gap-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 hypercard-btn text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 hypercard-btn-primary text-xs cursor-pointer uppercase"
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
          <div className="hypercard-card w-full max-w-md p-6 bg-white space-y-4 shadow-[6px_6px_0px_0px_#000]">
            <div className="flex items-center gap-3 text-rose-600 border-b-2 border-black pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-hypercard-header text-black">Confirm Deletion</h3>
            </div>
            <p className="text-xs font-bold text-slate-800">
              Are you sure you want to delete <span className="underline">{deleteConfirm.name}</span>? This action will remove the record.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2 border-t-2 border-black">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' })}
                className="px-4 py-2 hypercard-btn text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-5 py-2 bg-rose-600 text-white font-bold border-2 border-black text-xs hover:bg-rose-700 rounded shadow-[2px_2px_0px_0px_#000] cursor-pointer"
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
