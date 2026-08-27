'use client';

import React from 'react';
import { ClassPulseProvider, useClassPulse } from './context/ClassPulseContext';
import { LoginPage } from './components/LoginPage';
import { Topbar, AppFooter } from './components/Topbar';
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
    <main className="cp-content">
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
  const { isLoggedIn } = useClassPulse();

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  return (
    <div className="cp-page font-sans">
      <Topbar />
      <MainContent />
      <AppFooter />
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
