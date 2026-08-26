import React from 'react';
import { ClassPulseProvider, useClassPulse } from './context/ClassPulseContext';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ManagementView } from './components/ManagementView';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AnalyticsView } from './components/AnalyticsView';
import { QuizWorkbench } from './components/QuizWorkbench';
import { ProjectorKiosk } from './components/ProjectorKiosk';

const MainContent = () => {
  const { activeTab, userRole } = useClassPulse();

  return (
    <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#faf7f2]">
      {activeTab === 'management' && <ManagementView />}
      {activeTab === 'teacher-dash' && <TeacherDashboard />}
      {activeTab === 'student-dash' && <StudentDashboard />}
      {activeTab === 'analytics' && <AnalyticsView />}
      {activeTab === 'quiz' && <QuizWorkbench />}
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
    <div className="flex h-screen bg-[#faf7f2] text-slate-900 overflow-hidden font-sans">
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
