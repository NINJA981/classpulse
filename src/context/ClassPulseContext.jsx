'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  clearSession,
  getStoredUser,
  isSignedIn,
  login as apiLogin,
  request
} from '../lib/apiClient';
import {
  INITIAL_PI_NODES,
  INITIAL_TRANSCRIPTS,
  SAMPLE_GENERATED_QUIZ,
  INITIAL_ANALYTICS
} from '../mock/liveDataSimulator';

const ClassPulseContext = createContext(null);

const MORE_SIMULATED_TRANSCRIPTS = [
  {
    tamilText: 'Photolysis-ல் H2O மூலக்கூறு பிளக்கப்பட்டு H+ அயனிகளும் O2 வாயுவும் வெளியாகிறது.',
    englishText: 'In photolysis, H2O molecules are split releasing H+ ions and O2 gas.',
    topicTag: 'Photolysis',
    confidence: 0.97
  },
  {
    tamilText: 'ATP Synthase enzyme மூலமாக proton gradient பயன்படுத்தப்பட்டு ATP தயாராகிறது.',
    englishText: 'ATP is generated through ATP Synthase enzyme utilizing the proton gradient.',
    topicTag: 'ATP Synthesis',
    confidence: 0.94
  },
  {
    tamilText: 'Dark reaction-ல் RuBisCO enzyme தான் Carbon dioxide-ஐ RuBP உடன் இணைக்க முக்கிய பங்கு வகிக்கிறது.',
    englishText: 'In Dark reaction, RuBisCO enzyme plays a key role in combining Carbon dioxide with RuBP.',
    topicTag: 'RuBisCO Enzyme',
    confidence: 0.96
  }
];

// Initial Timetable Structure per Classroom
const INITIAL_TIMETABLES = {
  'Grade 10-A': {
    Monday: [
      { time: '09:00 - 10:00 AM', subject: 'Biology', teacher: 'Dr. Anitha', room: 'Science Lab 2' },
      { time: '10:00 - 11:00 AM', subject: 'Physics', teacher: 'Prof. Rajesh Kumar', room: 'Physics Lab 1' },
      { time: '11:15 - 12:15 PM', subject: 'Chemistry', teacher: 'Dr. Meena Sundaram', room: 'Science Lab 2' },
      { time: '01:30 - 02:30 PM', subject: 'Mathematics', teacher: 'Prof. Vikram Seth', room: 'Room 304' }
    ],
    Tuesday: [
      { time: '09:00 - 10:00 AM', subject: 'Chemistry', teacher: 'Dr. Meena Sundaram', room: 'Science Lab 2' },
      { time: '10:00 - 11:00 AM', subject: 'Biology', teacher: 'Dr. Anitha', room: 'Science Lab 2' },
      { time: '11:15 - 12:15 PM', subject: 'English', teacher: 'Ms. Sarah Jenkins', room: 'Room 201' },
      { time: '01:30 - 02:30 PM', subject: 'Physics', teacher: 'Prof. Rajesh Kumar', room: 'Physics Lab 1' }
    ],
    Wednesday: [
      { time: '09:00 - 10:00 AM', subject: 'Mathematics', teacher: 'Prof. Vikram Seth', room: 'Room 304' },
      { time: '10:00 - 11:00 AM', subject: 'Biology Lab', teacher: 'Dr. Anitha', room: 'Science Lab 2' },
      { time: '11:15 - 12:15 PM', subject: 'History', teacher: 'Mr. David Miller', room: 'Room 105' },
      { time: '01:30 - 02:30 PM', subject: 'Computer Science', teacher: 'Dr. Alan Turing', room: 'Comp Lab 1' }
    ],
    Thursday: [
      { time: '09:00 - 10:00 AM', subject: 'Physics', teacher: 'Prof. Rajesh Kumar', room: 'Physics Lab 1' },
      { time: '10:00 - 11:00 AM', subject: 'Mathematics', teacher: 'Prof. Vikram Seth', room: 'Room 304' },
      { time: '11:15 - 12:15 PM', subject: 'Biology', teacher: 'Dr. Anitha', room: 'Science Lab 2' },
      { time: '01:30 - 02:30 PM', subject: 'Physical Ed', teacher: 'Coach Roberts', room: 'Gymnasium' }
    ],
    Friday: [
      { time: '09:00 - 10:00 AM', subject: 'Biology Revision', teacher: 'Dr. Anitha', room: 'Science Lab 2' },
      { time: '10:00 - 11:00 AM', subject: 'Chemistry Lab', teacher: 'Dr. Meena Sundaram', room: 'Chemistry Lab 3' },
      { time: '11:15 - 12:15 PM', subject: 'Weekly Quiz', teacher: 'Dr. Anitha', room: 'Science Lab 2' },
      { time: '01:30 - 02:30 PM', subject: 'Library Hour', teacher: 'Librarian Joy', room: 'Library' }
    ]
  },
  'Grade 9-B': {
    Monday: [
      { time: '09:00 - 10:00 AM', subject: 'Physics', teacher: 'Prof. Rajesh Kumar', room: 'Physics Lab 1' },
      { time: '10:00 - 11:00 AM', subject: 'Mathematics', teacher: 'Prof. Vikram Seth', room: 'Room 202' },
      { time: '11:15 - 12:15 PM', subject: 'English', teacher: 'Ms. Sarah Jenkins', room: 'Room 201' },
      { time: '01:30 - 02:30 PM', subject: 'Biology', teacher: 'Dr. Anitha', room: 'Science Lab 2' }
    ]
  },
  'Grade 11-C': {
    Monday: [
      { time: '09:00 - 10:00 AM', subject: 'Chemistry', teacher: 'Dr. Meena Sundaram', room: 'Chemistry Lab 3' },
      { time: '10:00 - 11:00 AM', subject: 'Biology', teacher: 'Dr. Anitha', room: 'Science Lab 2' },
      { time: '11:15 - 12:15 PM', subject: 'Mathematics', teacher: 'Prof. Vikram Seth', room: 'Room 304' },
      { time: '01:30 - 02:30 PM', subject: 'Physics', teacher: 'Prof. Rajesh Kumar', room: 'Physics Lab 1' }
    ]
  }
};

// Initial Access Control Matrix
const INITIAL_ACCESS_CONTROLS = {
  roles: {
    Admin: {
      description: 'Full system administration & configuration rights',
      badgeColor: 'bg-yellow-200 text-slate-900',
      permissions: {
        manageClassrooms: true,
        manageTeachers: true,
        manageStudents: true,
        assignTimetables: true,
        controlAccess: true,
        launchQuizzes: true,
        viewAnalytics: true
      }
    },
    Teacher: {
      description: 'Classroom management & live lecture/quiz controls',
      badgeColor: 'bg-sky-200 text-slate-900',
      permissions: {
        manageClassrooms: false,
        manageTeachers: false,
        manageStudents: false,
        assignTimetables: false,
        controlAccess: false,
        launchQuizzes: true,
        viewAnalytics: true
      }
    },
    Student: {
      description: 'Classroom participation, timetable viewing & live quiz response',
      badgeColor: 'bg-emerald-200 text-slate-900',
      permissions: {
        manageClassrooms: false,
        manageTeachers: false,
        manageStudents: false,
        assignTimetables: false,
        controlAccess: false,
        launchQuizzes: false,
        viewAnalytics: false
      }
    }
  }
};

function mapBackendTeacher(t) {
  return {
    id: t.id,
    name: t.name || 'Faculty Member',
    staffId: t.staffId || `FAC-${t.id.slice(-4).toUpperCase()}`,
    email: t.email || 'faculty@clasepulse.test',
    department: t.department || 'Faculty Staff',
    assignedClasses: t.assignedClasses || ['Class 12-A'],
    status: 'Active',
    createdAt: t.createdAt
  };
}

function mapBackendStudent(s) {
  return {
    id: s.id,
    name: s.name || 'Student',
    rollNo: s.rollNumber || `STU-${s.id.slice(-4).toUpperCase()}`,
    className: s.className || 'Class 12-A',
    nickname: s.nickname || (s.name ? s.name.split(' ')[0] : 'Student'),
    email: s.email || `${s.rollNumber ? s.rollNumber.toLowerCase() : 'student'}@clasepulse.edu`,
    status: 'Active',
    createdAt: s.createdAt
  };
}

function mapSectionToClassroom(s, teachersMap = {}) {
  return {
    id: s.id,
    name: s.name,
    room: s.joinCode ? `Code: ${s.joinCode}` : 'Room 101',
    joinCode: s.joinCode,
    courseId: s.courseId,
    gradeLevel: s.name.match(/\d+/)?.[0] ? `Grade ${s.name.match(/\d+/)[0]}` : 'General',
    leadTeacher: (s.teacherNames && s.teacherNames[0]) || (s.teacherIds && teachersMap[s.teacherIds[0]]) || 'Faculty Lead',
    studentCount: s.enrolledCount ?? 0,
    status: 'Active',
    description: `Section join code: ${s.joinCode || 'N/A'}`
  };
}

function generateTimetableForClass(className, teachersList = [], coursesList = []) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const times = ['09:00 - 10:00 AM', '10:00 - 11:00 AM', '11:15 - 12:15 PM', '01:30 - 02:30 PM'];
  const schedule = {};
  days.forEach((day, dIdx) => {
    schedule[day] = times.map((time, tIdx) => {
      const course = coursesList[(dIdx + tIdx) % Math.max(coursesList.length, 1)];
      const teacher = teachersList[(dIdx + tIdx) % Math.max(teachersList.length, 1)];
      return {
        time,
        subject: course?.title || (tIdx % 2 === 0 ? 'Mathematics XII' : 'Chemistry XII'),
        teacher: teacher?.name || 'Demo Teacher',
        room: `Lab ${(tIdx % 3) + 1}`
      };
    });
  });
  return schedule;
}

export const ClassPulseProvider = ({ children }) => {
  // Authentication & Role State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('admin');
  const [currentPort, setCurrentPort] = useState('5171');
  const [currentUser, setCurrentUser] = useState({
    id: 'usr-admin-01',
    name: 'Head Administrator',
    email: 'admin@classpulse.edu',
    role: 'admin',
    staffId: 'ADM-101'
  });

  const [activeTab, setActiveTab] = useState('management');
  const [adminSubTab, setAdminSubTab] = useState('overview');
  const [onboardingStep, setOnboardingStep] = useState('institution');

  // Backend live data states
  const [overview, setOverview] = useState({
    counts: {
      teachers: 0,
      students: 0,
      courses: 0,
      sections: 0,
      lessons: 0,
      publishedLessons: 0,
      questions: 0,
      approvedQuestions: 0
    },
    lessonsByStatus: [],
    recentLessons: [],
    institution: null
  });
  const [institution, setInstitution] = useState(null);
  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);

  const ADMIN_USER = {
    id: 'usr-admin-01',
    name: 'Principal Administrator',
    email: 'admin@classpulse.edu',
    role: 'admin',
    staffId: 'ADM-101'
  };

  const fetchBackendData = async () => {
    if (!isSignedIn()) return;
    setLoadingData(true);
    try {
      const [overviewRes, teachersRes, studentsRes, sectionsRes, coursesRes, lessonsRes, timetablesRes] = await Promise.allSettled([
        request('/admin/overview'),
        request('/admin/teachers'),
        request('/admin/students'),
        request('/admin/sections'),
        request('/admin/courses'),
        request('/lessons?page=1&pageSize=50'),
        request('/admin/timetables')
      ]);

      let tMap = {};
      let loadedTeachers = [];
      if (teachersRes.status === 'fulfilled' && teachersRes.value?.items) {
        loadedTeachers = teachersRes.value.items.map(mapBackendTeacher);
        setTeachers(loadedTeachers);
        loadedTeachers.forEach(t => { tMap[t.id] = t.name; });
      }

      let loadedSections = [];
      if (sectionsRes.status === 'fulfilled' && sectionsRes.value?.items) {
        loadedSections = sectionsRes.value.items.map(s => mapSectionToClassroom(s, tMap));
        setClassrooms(loadedSections);
      }

      if (studentsRes.status === 'fulfilled' && studentsRes.value?.items) {
        const loadedStudents = studentsRes.value.items.map(mapBackendStudent);
        setStudents(loadedStudents);
      }

      let loadedCourses = [];
      if (coursesRes.status === 'fulfilled' && coursesRes.value?.items) {
        loadedCourses = coursesRes.value.items;
        setCourses(loadedCourses);
      }

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setOverview(overviewRes.value);
        if (overviewRes.value.institution) {
          setInstitution(overviewRes.value.institution);
        }
        setBackendConnected(true);
      }

      if (lessonsRes.status === 'fulfilled' && lessonsRes.value?.lessons) {
        setLessons(lessonsRes.value.lessons);
      }

      let hasSavedTimetables = false;
      if (timetablesRes.status === 'fulfilled' && timetablesRes.value?.timetables && Object.keys(timetablesRes.value.timetables).length > 0) {
        setTimetables(timetablesRes.value.timetables);
        hasSavedTimetables = true;
      }

      if (!hasSavedTimetables && loadedSections.length > 0) {
        const generated = {};
        loadedSections.forEach(sec => {
          generated[sec.name] = generateTimetableForClass(sec.name, loadedTeachers, loadedCourses);
        });
        setTimetables(generated);
        request('/admin/timetables', {
          method: 'PUT',
          body: JSON.stringify({ timetables: generated })
        }).catch(err => console.error('Failed to init timetables:', err));
      }
    } catch (err) {
      console.error('Failed to load backend data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  /** Puts the console into its signed-in state once a token exists. */
  const applySession = (user) => {
    setUserRole('admin');
    setIsLoggedIn(true);
    setCurrentUser({ ...ADMIN_USER, ...(user || {}) });
    setActiveTab('management');
  };

  const login = async (email, password) => {
    const teacher = await apiLogin(email, password);
    applySession({ id: teacher.id, name: teacher.name, email: teacher.email, role: 'admin' });
    await fetchBackendData();
    return teacher;
  };

  // Session detection for single unified Admin Portal
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const port = window.location.port || '5171';
    setCurrentPort(port);

    if (isSignedIn()) {
      applySession(getStoredUser());
      fetchBackendData();
    } else {
      setUserRole('admin');
      setIsLoggedIn(false);
    }
  }, []);

  const logout = () => {
    clearSession();
    setIsLoggedIn(false);
  };

  // Data simulation states
  const [piNodes, setPiNodes] = useState(INITIAL_PI_NODES);
  const [transcripts, setTranscripts] = useState(INITIAL_TRANSCRIPTS);
  const [detectedTopics, setDetectedTopics] = useState([
    'Photosynthesis',
    'Chloroplast Structure',
    'Light-Dependent Reactions',
    'ATP & NADPH',
    'Calvin Cycle'
  ]);
  
  const [pushPrompt, setPushPrompt] = useState({
    active: true,
    topic: 'Photosynthesis & Light Reactions',
    text: 'Just covered photosynthesis & ATP/NADPH synthesis — launch a quiz now?',
    timestamp: 'Just now'
  });

  const [quizState, setQuizState] = useState({
    currentQuiz: SAMPLE_GENERATED_QUIZ,
    status: 'preview',
    timeRemaining: 45,
    sessionPin: 'CP-8492',
    connectedStudents: 38,
    studentAnswers: {
      Q1: { A: 4, B: 30, C: 2, D: 2 },
      Q2: { A: 3, B: 31, C: 3, D: 1 },
      Q3: { A: 2, B: 5, C: 29, D: 2 },
      Q4: { A: 1, B: 2, C: 34, D: 1 }
    }
  });

  const [globalMute, setGlobalMute] = useState(false);
  const [isSimulatingLive, setIsSimulatingLive] = useState(true);

  // Admin Management State - loaded dynamically from live Fastify backend
  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [timetables, setTimetables] = useState(INITIAL_TIMETABLES);
  const [timetableMode, setTimetableMode] = useState('classroom'); // 'classroom' | 'faculty'
  const [selectedFacultyTimetable, setSelectedFacultyTimetable] = useState('');
  const [accessControls, setAccessControls] = useState(INITIAL_ACCESS_CONTROLS);

  // Admin Actions with Backend Integration
  const addClassroom = async (newClass) => {
    try {
      const targetCourseId = newClass.courseId || courses[0]?.id;
      const matchedTeacher = teachers.find(t => t.name === newClass.leadTeacher);
      if (targetCourseId) {
        await request('/admin/sections', {
          method: 'POST',
          body: JSON.stringify({
            name: newClass.name,
            courseId: targetCourseId,
            teacherIds: matchedTeacher ? [matchedTeacher.id] : []
          })
        });
        await fetchBackendData();
        return;
      }
    } catch (err) {
      console.error('Failed to add classroom on backend:', err);
    }
    const item = { 
      ...newClass, 
      id: `cls-${Date.now().toString().slice(-4)}`,
      studentCount: newClass.studentCount || 0,
      status: 'Active'
    };
    setClassrooms(prev => [...prev, item]);
  };

  const deleteClassroom = async (id) => {
    try {
      await request(`/admin/sections/${id}`, { method: 'DELETE' });
      await fetchBackendData();
      return;
    } catch (err) {
      console.error('Failed to delete section on backend:', err);
    }
    setClassrooms(prev => prev.filter(c => c.id !== id));
  };

  const addStudent = async (newStudent) => {
    try {
      const targetSection = classrooms.find(c => c.name === newStudent.className || c.id === newStudent.sectionId);
      await request('/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          name: newStudent.name,
          rollNumber: newStudent.rollNo || `STU-${Date.now().toString().slice(-4)}`,
          email: newStudent.email || undefined,
          sectionId: targetSection?.id || undefined
        })
      });
      await fetchBackendData();
      return;
    } catch (err) {
      console.error('Failed to add student on backend:', err);
    }
    const item = { ...newStudent, id: `stu-${Date.now().toString().slice(-4)}`, status: 'Active' };
    setStudents(prev => [...prev, item]);
  };

  const addBulkStudents = (newStudents) => {
    setStudents(prev => {
      const existingRolls = new Set(prev.map(s => s.rollNo));
      const filtered = newStudents.filter(s => !existingRolls.has(s.rollNo));
      return [...prev, ...filtered];
    });
  };

  const deleteStudent = async (id) => {
    try {
      await request(`/admin/students/${id}`, { method: 'DELETE' });
      await fetchBackendData();
      return;
    } catch (err) {
      console.error('Failed to delete student on backend:', err);
    }
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const addTeacher = async (newTeacher) => {
    try {
      await request('/admin/teachers', {
        method: 'POST',
        body: JSON.stringify({
          name: newTeacher.name,
          email: newTeacher.email || `${newTeacher.name.toLowerCase().replace(/\s+/g, '.')}@clasepulse.test`
        })
      });
      await fetchBackendData();
      return;
    } catch (err) {
      console.error('Failed to add teacher on backend:', err);
    }
    const item = { 
      ...newTeacher, 
      id: `tch-${Date.now().toString().slice(-4)}`, 
      status: 'Active',
      assignedClasses: typeof newTeacher.assignedClasses === 'string' 
        ? [newTeacher.assignedClasses] 
        : (newTeacher.assignedClasses || [])
    };
    setTeachers(prev => [...prev, item]);
  };

  const addBulkTeachers = (newTeachers) => {
    setTeachers(prev => {
      const existingIds = new Set(prev.map(t => t.staffId));
      const filtered = newTeachers.filter(t => !existingIds.has(t.staffId));
      return [...prev, ...filtered];
    });
  };

  const deleteTeacher = async (id) => {
    try {
      await request(`/admin/teachers/${id}`, { method: 'DELETE' });
      await fetchBackendData();
      return;
    } catch (err) {
      console.error('Failed to delete teacher on backend:', err);
    }
    setTeachers(prev => prev.filter(t => t.id !== id));
  };

  // Assign Teacher to Classroom
  const assignTeacherToClassroom = async (classroomId, teacherId) => {
    try {
      await request(`/admin/sections/${classroomId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          teacherIds: [teacherId]
        })
      });
      await fetchBackendData();
      return;
    } catch (err) {
      console.error('Failed to assign teacher on backend:', err);
    }
    const targetClass = classrooms.find(c => c.id === classroomId);
    const targetTeacher = teachers.find(t => t.id === teacherId);
    if (!targetClass || !targetTeacher) return;

    // Update Classroom Lead Teacher
    setClassrooms(prev => prev.map(c => c.id === classroomId ? { ...c, leadTeacher: targetTeacher.name } : c));

    // Update Teacher assignedClasses list
    setTeachers(prev => prev.map(t => {
      if (t.id === teacherId) {
        const classes = Array.isArray(t.assignedClasses) ? t.assignedClasses : [t.assignedClasses];
        if (!classes.includes(targetClass.name)) {
          return { ...t, assignedClasses: [...classes, targetClass.name] };
        }
      }
      return t;
    }));
  };

  // Assign Student to Classroom
  const assignStudentToClassroom = (studentId, className) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, className } : s));
  };

  const saveTimetables = async (updated) => {
    setTimetables(updated);
    try {
      await request('/admin/timetables', {
        method: 'PUT',
        body: JSON.stringify({ timetables: updated })
      });
    } catch (err) {
      console.error('Failed to persist timetables:', err);
    }
  };

  // Update Timetable slot
  const updateTimetableSlot = (className, day, slotIndex, updatedSlot) => {
    setTimetables(prev => {
      const classTimetable = prev[className] || {};
      const daySlots = classTimetable[day] || [];
      const newDaySlots = [...daySlots];
      newDaySlots[slotIndex] = updatedSlot;

      const updated = {
        ...prev,
        [className]: {
          ...classTimetable,
          [day]: newDaySlots
        }
      };
      saveTimetables(updated);
      return updated;
    });
  };

  // Add new timetable slot
  const addTimetableSlot = (className, day, slot) => {
    setTimetables(prev => {
      const classTimetable = prev[className] || {};
      const daySlots = classTimetable[day] || [];
      const updated = {
        ...prev,
        [className]: {
          ...classTimetable,
          [day]: [...daySlots, slot]
        }
      };
      saveTimetables(updated);
      return updated;
    });
  };

  // Delete Timetable slot
  const deleteTimetableSlot = (className, day, slotIndex) => {
    setTimetables(prev => {
      const classTimetable = prev[className] || {};
      const daySlots = classTimetable[day] || [];
      const newDaySlots = daySlots.filter((_, idx) => idx !== slotIndex);

      const updated = {
        ...prev,
        [className]: {
          ...classTimetable,
          [day]: newDaySlots
        }
      };
      saveTimetables(updated);
      return updated;
    });
  };

  // Toggle user permission
  const toggleUserPermission = (roleName, permKey) => {
    setAccessControls(prev => ({
      ...prev,
      roles: {
        ...prev.roles,
        [roleName]: {
          ...prev.roles[roleName],
          permissions: {
            ...prev.roles[roleName].permissions,
            [permKey]: !prev.roles[roleName].permissions[permKey]
          }
        }
      }
    }));
  };

  // Toggle student or teacher status (Active / Suspended)
  const toggleUserStatus = (id, type) => {
    if (type === 'student') {
      setStudents(prev => prev.map(s => s.id === id ? { ...s, status: s.status === 'Active' ? 'Suspended' : 'Active' } : s));
    } else if (type === 'teacher') {
      setTeachers(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'Active' ? 'Suspended' : 'Active' } : t));
    }
  };

  // Audio level generator simulation
  const [audioLevels, setAudioLevels] = useState([45, 60, 30, 85, 70, 95, 40, 65, 80, 50, 90, 75, 60, 35, 70, 85]);

  useEffect(() => {
    if (!isSimulatingLive || globalMute) return;
    const interval = setInterval(() => {
      setAudioLevels(prev => prev.map(() => Math.floor(Math.random() * 85) + 15));
    }, 800);
    return () => clearInterval(interval);
  }, [isSimulatingLive, globalMute]);

  const toggleNodeMute = (nodeId) => {
    setPiNodes(prev => prev.map(node => node.id === nodeId ? { ...node, isMuted: !node.isMuted } : node));
  };

  const toggleGlobalMute = () => {
    setGlobalMute(prev => !prev);
  };

  const launchQuiz = () => {
    setQuizState(prev => ({ ...prev, status: 'live', timeRemaining: 45 }));
    setPushPrompt(prev => ({ ...prev, active: false }));
    setActiveTab('projector');
  };

  const dismissPushPrompt = () => {
    setPushPrompt(prev => ({ ...prev, active: false }));
  };

  const regenerateQuiz = () => {
    setQuizState(prev => ({ ...prev, status: 'generating' }));
    setTimeout(() => {
      setQuizState(prev => ({
        ...prev,
        status: 'preview',
        currentQuiz: {
          ...prev.currentQuiz,
          id: `qz-${Date.now().toString().slice(-3)}`
        }
      }));
    }, 2000);
  };

  return (
    <ClassPulseContext.Provider
      value={{
        isLoggedIn,
        userRole,
        currentPort,
        currentUser,
        login,
        logout,
        activeTab,
        setActiveTab,
        piNodes,
        toggleNodeMute,
        globalMute,
        toggleGlobalMute,
        transcripts,
        detectedTopics,
        pushPrompt,
        dismissPushPrompt,
        launchQuiz,
        quizState,
        setQuizState,
        regenerateQuiz,
        audioLevels,
        isSimulatingLive,
        setIsSimulatingLive,
        analytics: INITIAL_ANALYTICS,
        overview,
        institution,
        courses,
        lessons,
        loadingData,
        backendConnected,
        refreshData: fetchBackendData,
        classrooms,
        addClassroom,
        deleteClassroom,
        students,
        addStudent,
        addBulkStudents,
        deleteStudent,
        teachers,
        addTeacher,
        addBulkTeachers,
        deleteTeacher,
        timetables,
        updateTimetableSlot,
        addTimetableSlot,
        deleteTimetableSlot,
        saveTimetables,
        timetableMode,
        setTimetableMode,
        selectedFacultyTimetable,
        setSelectedFacultyTimetable,
        assignTeacherToClassroom,
        assignStudentToClassroom,
        accessControls,
        toggleUserPermission,
        toggleUserStatus,
        onboardingStep,
        setOnboardingStep,
        adminSubTab,
        setAdminSubTab
      }}
    >
      {children}
    </ClassPulseContext.Provider>
  );
};

export const useClassPulse = () => {
  const context = useContext(ClassPulseContext);
  if (!context) throw new Error('useClassPulse must be used within ClassPulseProvider');
  return context;
};
