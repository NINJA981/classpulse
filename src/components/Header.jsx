'use client';

import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  School,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  LogOut,
  Sparkles
} from 'lucide-react';

export const Header = () => {
  const { userRole, currentUser, logout } = useClassPulse();
  const isAdmin = userRole === 'admin';

  return (
    <header className={`px-6 py-3.5 flex items-center justify-between z-10 select-none transition-all ${
      isAdmin
        ? 'bg-white border-b border-slate-300 shadow-sm font-sans'
        : 'bg-white border-b-2 border-slate-900 shadow-zine-sm font-sans'
    }`}>
      {/* Original ClassPulse Brand Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-900 text-yellow-300 flex items-center justify-center font-bold text-sm border-2 border-slate-900 shadow-zine-sm">
          <School className="w-5 h-5 text-yellow-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight leading-none text-slate-900 font-sans">
              Class<span className="text-sky-600">Pulse</span> Hub
            </h1>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold leading-none ${
              isAdmin
                ? 'bg-sky-50 text-sky-800 border border-sky-200 font-sans'
                : 'bg-yellow-300 text-slate-900 border border-slate-900 font-mono font-black uppercase'
            }`}>
              {isAdmin ? 'Executive v2.5' : 'System Edition'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-normal hidden sm:block mt-0.5">
            Smart Classroom Administration & Telemetry System
          </p>
        </div>
      </div>

      {/* Right Controls: Role Portal Badge & Account Status */}
      <div className="flex items-center gap-3">
        {/* Active Portal Indicator */}
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition ${
          isAdmin
            ? 'bg-slate-900 text-white shadow-sm border border-slate-800'
            : 'bg-slate-900 text-white border-2 border-slate-900 shadow-zine-sm font-mono'
        }`}>
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className={`text-xs font-semibold uppercase ${isAdmin ? 'text-sky-300' : 'text-yellow-300 font-black'}`}>
            {userRole === 'admin' && '🔐 ADMIN CONTROL (PORT 5173)'}
            {userRole === 'teacher' && '👨‍🏫 TEACHER WORKBENCH'}
            {userRole === 'student' && '🎓 STUDENT PORTAL'}
          </span>
        </div>

        {/* User Account Pill */}
        <div className={`hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl ${
          isAdmin
            ? 'bg-slate-50 border border-slate-300'
            : 'bg-white border-2 border-slate-900 shadow-zine-sm font-mono'
        }`}>
          <div className="w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs bg-slate-900 text-yellow-300 border border-slate-900">
            {currentUser?.name ? currentUser.name[0] : 'A'}
          </div>
          <div className="text-left text-xs leading-tight">
            <div className="text-slate-900 font-bold text-xs">{currentUser?.name || 'Administrator'}</div>
            <div className={`text-[10px] uppercase font-semibold ${isAdmin ? 'text-slate-500' : 'text-slate-700 font-mono'}`}>{userRole}</div>
          </div>
        </div>

        {/* Quick Logout Button */}
        <button
          onClick={logout}
          className={`p-2 rounded-xl transition cursor-pointer ${
            isAdmin
              ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-300 shadow-sm'
              : 'bg-slate-100 hover:bg-rose-200 text-slate-900 font-bold border-2 border-slate-900 shadow-zine-sm'
          }`}
          title="Switch Role / Logout"
        >
          <LogOut className="w-4 h-4 stroke-[2]" />
        </button>
      </div>
    </header>
  );
};
