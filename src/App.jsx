'use client';

import React from 'react';
import { ClassPulseProvider, useClassPulse } from './context/ClassPulseContext';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ManagementView } from './components/ManagementView';
import { TeacherClassroomView } from './components/TeacherClassroomView';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AnalyticsView } from './components/AnalyticsView';
import { QuizWorkbench } from './components/QuizWorkbench';
import { ProjectorKiosk } from './components/ProjectorKiosk';

const MainContent = () => {
  const { activeTab, userRole } = useClassPulse();
  const isAdmin = userRole === 'admin';

  return (
    <main className={`flex-1 p-4 sm:p-6 overflow-y-auto animate-portal-enter ${
      isAdmin ? 'bg-[#f4f0e6]' : 'bg-[#faf7f2]'
    }`}>
      {activeTab === 'management' && (isAdmin ? <ManagementView /> : <TeacherClassroomView />)}
      {activeTab === 'teacher-dash' && <TeacherDashboard />}
      {activeTab === 'student-dash' && <StudentDashboard />}
      {activeTab === 'analytics' && <AnalyticsView />}
      {activeTab === 'quiz' && (userRole === 'admin' ? <ManagementView /> : <QuizWorkbench />)}
      {activeTab === 'projector' && <ProjectorKiosk />}
    </main>
  );
};

const AppInner = () => {
  const { isLoggedIn, userRole } = useClassPulse();
  const isAdmin = userRole === 'admin';

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  return (
    <div className={`flex h-screen text-slate-900 overflow-hidden font-mono ${
      isAdmin ? 'bg-[#f4f0e6]' : 'bg-[#faf7f2]'
    }`}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <MainContent />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ClassPulseProvider>
      <AppInner />
    </ClassPulseProvider>
  );
}
