'use client';

import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  School,
  BrainCircuit,
  BarChart3,
  Tv2,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Sparkles,
  Layers,
  Activity
} from 'lucide-react';

export const Sidebar = () => {
  const { activeTab, setActiveTab, userRole } = useClassPulse();
  const isAdmin = userRole === 'admin';

  const adminNavItems = [
    { id: 'management', label: 'Admin Control Center', icon: Layers, badge: 'CORE' },
    { id: 'analytics', label: 'Classroom Analytics', icon: BarChart3 }
  ];

  const teacherNavItems = [
    { id: 'teacher-dash', label: 'Teacher Dashboard', icon: UserCheck, badge: 'MY CLASS' },
    { id: 'management', label: 'Class & Timetables', icon: School },
    { id: 'quiz', label: 'AI Quiz Workbench', icon: BrainCircuit },
    { id: 'projector', label: 'Projector Kiosk', icon: Tv2 }
  ];

  const studentNavItems = [
    { id: 'student-dash', label: 'Student Portal', icon: GraduationCap, badge: 'TIMETABLE' },
    { id: 'projector', label: 'Live Quiz Screen', icon: Tv2 }
  ];

  const navItems = isAdmin ? adminNavItems : userRole === 'teacher' ? teacherNavItems : studentNavItems;

  return (
    <aside className={`w-64 bg-white flex flex-col justify-between p-4 z-20 select-none transition-all ${
      isAdmin
        ? 'border-r border-slate-300 shadow-sm font-sans'
        : 'border-r-2 border-slate-900 shadow-zine-sm font-sans'
    }`}>
      <div>
        {/* Original ClassPulse Brand Logo */}
        <div className="p-3.5 mb-6 bg-slate-900 rounded-2xl text-white space-y-1 border border-slate-800 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center border-2 border-slate-700 shadow-sm shrink-0">
              <School className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white font-sans leading-tight">
                Class<span className="text-sky-400">Pulse</span>
              </h1>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {isAdmin ? 'EXECUTIVE ADMIN' : 'SMART SYSTEM'}
              </p>
            </div>
          </div>
        </div>

        {/* Role Indicator Callout */}
        <div className={`mb-4 p-3 rounded-xl text-xs space-y-0.5 ${
          isAdmin
            ? 'bg-slate-50 border border-slate-300 font-medium text-slate-700'
            : 'bg-slate-100 border-2 border-slate-900 text-slate-900 font-mono font-bold shadow-zine-sm'
        }`}>
          <span className={`block text-[10px] uppercase font-semibold tracking-wider ${
            isAdmin ? 'text-slate-500' : 'text-slate-900 font-mono font-black'
          }`}>
            Active Mode:
          </span>
          <span className="flex items-center gap-1 font-semibold text-slate-900">
            {userRole === 'admin' && '🔐 System Administrator'}
            {userRole === 'teacher' && '👨‍🏫 Classroom Teacher'}
            {userRole === 'student' && '🎓 Enrolled Student'}
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs transition cursor-pointer ${
                  isAdmin
                    ? isActive
                      ? 'bg-slate-800 text-white font-semibold shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-50 font-medium'
                    : isActive
                      ? 'bg-yellow-300 text-slate-900 shadow-zine-sm translate-x-1 font-mono font-black border-2 border-slate-900'
                      : 'bg-white text-slate-900 hover:bg-yellow-100 font-mono font-black border-2 border-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${
                    isAdmin
                      ? isActive ? 'text-sky-300' : 'text-slate-400'
                      : 'text-slate-900 stroke-[2.5]'
                  }`} />
                  <span className={isAdmin ? 'font-semibold text-xs' : 'font-mono font-black text-xs'}>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-2 py-0.5 text-[10px] rounded uppercase font-semibold leading-none ${
                    isAdmin
                      ? 'bg-sky-50 text-sky-800 border border-sky-200'
                      : 'bg-slate-900 text-yellow-300 border border-slate-900 font-mono font-black'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Info Card */}
      <div className={`pt-4 space-y-2 ${isAdmin ? 'border-t border-slate-100' : 'border-t-2 border-slate-900'}`}>
        {isAdmin ? (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
              <Activity className="w-3.5 h-3.5 text-sky-600" /> Executive System
            </div>
            <p className="text-[11px] font-normal text-slate-500 leading-tight">
              ClassPulse Executive Administration & Telemetry System.
            </p>
          </div>
        ) : (
          <div className="zine-card-pink p-3 text-xs space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1 font-mono text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-slate-900" /> ClassPulse v2.5
            </div>
            <p className="text-[11px] font-mono font-bold text-slate-800 leading-tight">
              ClassPulse Administration System & Learning Workbench.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
