'use client';

import React from 'react';
import { ClassPulseProvider, useClassPulse } from './context/ClassPulseContext';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { ManagementView } from './components/ManagementView';
import { TeacherClassroomView } from './components/TeacherClassroomView';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AnalyticsView } from './components/AnalyticsView';
import { QuizWorkbench } from './components/QuizWorkbench';
import { ProjectorKiosk } from './components/ProjectorKiosk';
import { OnboardingHub } from './components/onboarding/OnboardingHub';

const MainContent = () => {
  const { activeTab, userRole } = useClassPulse();
  const isAdmin = userRole === 'admin';

  return (
    <main className="cp-content">
      {activeTab === 'management' && (isAdmin ? <ManagementView /> : <TeacherClassroomView />)}
      {activeTab === 'onboarding' && (isAdmin ? <OnboardingHub /> : <ManagementView />)}
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
    <div className="cp-layout cp-shell font-sans">
      <Sidebar />
      <div className="cp-main-wrapper cp-main-pane">
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
