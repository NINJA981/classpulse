'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const ClassPulseProvider = ({ children }) => {
  // Authentication & Role State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('admin'); // only 'admin' can sign in to this app
  const [currentPort, setCurrentPort] = useState('5173');
  const [currentUser, setCurrentUser] = useState({
    id: 'usr-admin-01',
    name: 'Head Administrator',
    email: 'admin@classpulse.edu',
    role: 'admin',
    staffId: 'ADM-101'
  });

  const [activeTab, setActiveTab] = useState('management');
  const [onboardingStep, setOnboardingStep] = useState('institution');

  // Login handler — only administrators can sign in to this application.
  const ADMIN_USER = {
    id: 'usr-admin-01',
    name: 'Principal Administrator',
    email: 'admin@classpulse.edu',
    role: 'admin',
    staffId: 'ADM-101'
  };

  const login = (customUser = null) => {
    setUserRole('admin');
    setIsLoggedIn(true);
    setCurrentUser(customUser || ADMIN_USER);
    setActiveTab('management');
  };

  // Port-based & URL-based Auto Detection for the Admin services
  // Port 5171 -> Admin Dedicated Login Portal (logged out, shows LoginPage)
  // Port 5174 (or 5173 / any non-5171 port) -> Admin Control Center (ManagementView, auto-logged-in admin)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const port = window.location.port || '5171';
    const search = window.location.search;
    const envRole = typeof process !== 'undefined' && process.env
      ? (process.env.NEXT_PUBLIC_APP_ROLE || process.env.APP_ROLE)
      : undefined;
    setCurrentPort(port);

    if (port === '5174' || port === '5173' || (port !== '5171' && port !== '') || search.includes('role=admin') || envRole === 'admin') {
      login();
    } else {
      // Dedicated Admin Login Portal (Port 5171 / admin-login) or any other entry point
      setUserRole('admin');
      setIsLoggedIn(false);
    }
  }, []);

  const logout = () => {
    setIsLoggedIn(false);
    if (typeof window !== 'undefined' && window.location.port !== '5171') {
      const host = window.location.hostname || 'localhost';
      window.location.replace(`http://${host}:5171/`);
    }
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

  // Admin Management State
  const [classrooms, setClassrooms] = useState([
    { 
      id: '10A', 
      name: 'Grade 10-A', 
      room: 'Science Lab 2', 
      gradeLevel: 'Grade 10',
      leadTeacher: 'Dr. Anitha', 
      studentCount: 38, 
      status: 'Active',
      description: 'Science & Biology specialization stream'
    },
    { 
      id: '9B', 
      name: 'Grade 9-B', 
      room: 'Physics Lab 1', 
      gradeLevel: 'Grade 9',
      leadTeacher: 'Prof. Rajesh Kumar', 
      studentCount: 35, 
      status: 'Active',
      description: 'General Science & Physical studies'
    },
    { 
      id: '11C', 
      name: 'Grade 11-C', 
      room: 'Chemistry Lab 3', 
      gradeLevel: 'Grade 11',
      leadTeacher: 'Dr. Meena Sundaram', 
      studentCount: 40, 
      status: 'Standby',
      description: 'Advanced Physical Sciences & Organic Chemistry'
    }
  ]);

  const [students, setStudents] = useState([
    { id: 's1', name: 'Siddharth Verma', rollNo: 'STU-1001', className: 'Grade 10-A', nickname: 'Siddharth', email: 'siddharth@classpulse.edu', status: 'Active' },
    { id: 's2', name: 'Rahul Sharma', rollNo: 'STU-1002', className: 'Grade 10-A', nickname: 'RahulS', email: 'rahul@classpulse.edu', status: 'Active' },
    { id: 's3', name: 'Maya Patel', rollNo: 'STU-1003', className: 'Grade 9-B', nickname: 'MayaP', email: 'maya@classpulse.edu', status: 'Active' },
    { id: 's4', name: 'Karthik Raja', rollNo: 'STU-1004', className: 'Grade 11-C', nickname: 'Karthik', email: 'karthik@classpulse.edu', status: 'Active' },
    { id: 's5', name: 'Priya Mohan', rollNo: 'STU-1005', className: 'Grade 10-A', nickname: 'PriyaM', email: 'priya@classpulse.edu', status: 'Active' },
    { id: 's6', name: 'Vikram Singh', rollNo: 'STU-1006', className: 'Grade 9-B', nickname: 'Vikram', email: 'vikram@classpulse.edu', status: 'Active' }
  ]);

  const [teachers, setTeachers] = useState([
    { id: 't1', name: 'Dr. Anitha', staffId: 'TCH-501', email: 'anitha@classpulse.edu', department: 'Science & Biology', assignedClasses: ['Grade 10-A', 'Grade 11-C'], status: 'Active' },
    { id: 't2', name: 'Prof. Rajesh Kumar', staffId: 'TCH-502', email: 'rajesh@classpulse.edu', department: 'Physics', assignedClasses: ['Grade 9-B'], status: 'Active' },
    { id: 't3', name: 'Dr. Meena Sundaram', staffId: 'TCH-503', email: 'meena@classpulse.edu', department: 'Chemistry', assignedClasses: ['Grade 11-C'], status: 'Active' },
    { id: 't4', name: 'Prof. Vikram Seth', staffId: 'TCH-504', email: 'vikram@classpulse.edu', department: 'Mathematics', assignedClasses: ['Grade 10-A'], status: 'Active' }
  ]);

  const [timetables, setTimetables] = useState(INITIAL_TIMETABLES);
  const [accessControls, setAccessControls] = useState(INITIAL_ACCESS_CONTROLS);

  // Admin Actions
  const addClassroom = (newClass) => {
    const item = { 
      ...newClass, 
      id: `cls-${Date.now().toString().slice(-4)}`,
      studentCount: newClass.studentCount || 30,
      status: 'Active'
    };
    setClassrooms(prev => [...prev, item]);
    // Initialize empty timetable if not existing
    if (!timetables[newClass.name]) {
      setTimetables(prev => ({
        ...prev,
        [newClass.name]: {
          Monday: [
            { time: '09:00 - 10:00 AM', subject: 'General Science', teacher: newClass.leadTeacher || 'Dr. Anitha', room: newClass.room }
          ]
        }
      }));
    }
  };

  const deleteClassroom = (id) => {
    setClassrooms(prev => prev.filter(c => c.id !== id));
  };

  const addStudent = (newStudent) => {
    const item = { ...newStudent, id: `stu-${Date.now().toString().slice(-4)}`, status: 'Active' };
    setStudents(prev => [...prev, item]);
  };

  const deleteStudent = (id) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const addTeacher = (newTeacher) => {
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

  const deleteTeacher = (id) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
  };

  // Assign Teacher to Classroom
  const assignTeacherToClassroom = (classroomId, teacherId) => {
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

  // Update Timetable slot
  const updateTimetableSlot = (className, day, slotIndex, updatedSlot) => {
    setTimetables(prev => {
      const classTimetable = prev[className] || {};
      const daySlots = classTimetable[day] || [];
      const newDaySlots = [...daySlots];
      newDaySlots[slotIndex] = updatedSlot;

      return {
        ...prev,
        [className]: {
          ...classTimetable,
          [day]: newDaySlots
        }
      };
    });
  };

  // Add new timetable slot
  const addTimetableSlot = (className, day, slot) => {
    setTimetables(prev => {
      const classTimetable = prev[className] || {};
      const daySlots = classTimetable[day] || [];

      return {
        ...prev,
        [className]: {
          ...classTimetable,
          [day]: [...daySlots, slot]
        }
      };
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
        toggleUserStatus,
        onboardingStep,
        setOnboardingStep
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
