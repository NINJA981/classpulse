'use client';

import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Sparkles,
  ArrowRight,
  School,
  Lock,
  KeyRound,
  User,
  Activity,
  CheckCircle2,
  Building,
  CloudRain
} from 'lucide-react';

export const LoginPage = () => {
  const roleEnv = process.env.NEXT_PUBLIC_APP_ROLE || 'academic-login';
  const isAdminLoginOnly = roleEnv === 'admin-login' || roleEnv === 'admin';
  
  const [academicRole, setAcademicRole] = useState('teacher'); // 'teacher' | 'student'
  
  const [adminEmail, setAdminEmail] = useState('admin@classpulse.edu');
  const [adminPassword, setAdminPassword] = useState('');

  const [academicEmail, setAcademicEmail] = useState('anitha@classpulse.edu');
  const [academicPassword, setAcademicPassword] = useState('');

  const [isNavigating, setIsNavigating] = useState(false);
  const [navTargetLabel, setNavTargetLabel] = useState('');

  const redirectToRolePort = (role) => {
    const portMap = {
      admin: '5173',
      teacher: '5174',
      student: '5175'
    };
    const roleLabels = {
      admin: '🔐 Admin Control Center (Port 5173)',
      teacher: '👨‍🏫 Teacher Workbench (Port 5174)',
      student: '🎓 Student Portal (Port 5175)'
    };
    const targetPort = portMap[role] || '5173';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    
    setIsNavigating(true);
    setNavTargetLabel(roleLabels[role] || role.toUpperCase());

    window.location.replace(`http://${host}:${targetPort}/`);
  };

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    redirectToRolePort('admin');
  };

  const handleAcademicSubmit = (e) => {
    e.preventDefault();
    redirectToRolePort(academicRole);
  };

  const handleAcademicRoleToggle = (role) => {
    setAcademicRole(role);
    if (role === 'teacher') {
      setAcademicEmail('anitha@classpulse.edu');
    } else {
      setAcademicEmail('ananya@classpulse.edu');
    }
  };

  // ================================================
  // 1. ADMIN LOGIN PORTAL (PORT 5171) - STORMY MORNING UI
  // ================================================
  if (isAdminLoginOnly) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans text-slate-900 relative overflow-hidden animate-portal-enter">
        {/* Smooth Navigation Overlay */}
        {isNavigating && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-portal-enter">
            <div className="bg-white border border-slate-300 shadow-2xl p-8 rounded-2xl max-w-sm w-full text-center space-y-4 font-sans">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center mx-auto shadow-sm animate-bounce">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  AUTHORIZING SESSION...
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {navTargetLabel}
                </p>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full border border-slate-300 overflow-hidden">
                <div className="bg-slate-800 h-full w-full animate-pulse" />
              </div>
            </div>
          </div>
        )}

        <div className="max-w-md w-full space-y-6">
          {/* Stormy Morning Brand Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold">
              <span>ClassPulse Executive Gateway • Port 5171</span>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Class<span className="text-sky-700">Pulse</span> Admin Portal
              </h1>
              <p className="text-xs text-slate-500 font-normal max-w-xs mx-auto">
                Authorized Administrator Authentication & Control Gateway
              </p>
            </div>
          </div>

          {/* Stormy Morning Corporate Login Card */}
          <div className="bg-white border border-slate-300 rounded-2xl p-7 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 border border-slate-300 flex items-center justify-center font-bold text-sm">
                  🔐
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Administrator Sign In</h2>
                  <p className="text-[11px] text-slate-500 font-medium">Port 5171 Control Authentication</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                System Active
              </span>
            </div>

            {/* Info Notice Box */}
            <div className="p-3.5 bg-slate-100/70 rounded-xl border border-slate-300/80 text-xs space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
                <Lock className="w-3.5 h-3.5 text-sky-600" />
                <span>Redirects to Admin Control Center (Port 5173)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
                Access RBAC access controls, classroom streams, faculty assignments, and analytics.
              </p>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Email or Staff ID</span>
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  placeholder="admin@classpulse.edu"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Security PIN / Password</span>
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700"
                  placeholder="••••••••••••"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <span>Sign In & Launch Admin Control</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="text-center text-xs text-slate-500 space-y-1">
            <p>© ClassPulse Executive Education System</p>
          </div>
        </div>
      </div>
    );
  }

  // ================================================
  // 2. ACADEMIC LOGIN PORTAL (PORT 5172) - TACTILE ZINE UI
  // ================================================
  return (
    <div className="min-h-screen bg-[#f7f4ed] flex flex-col items-center justify-center p-4 sm:p-6 select-none font-mono text-slate-900 relative overflow-hidden animate-portal-enter">
      {/* Smooth Navigation Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-portal-enter">
          <div className="bg-[#fffbeb] border-3 border-slate-900 shadow-[8px_8px_0px_0px_#000] p-8 rounded-2xl max-w-sm w-full text-center space-y-4 font-mono">
            <div className="w-12 h-12 rounded-full bg-yellow-300 border-2 border-slate-900 flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_#000] animate-bounce">
              <Sparkles className="w-6 h-6 text-slate-900 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                REDIRECTING TO WORKBENCH...
              </span>
              <p className="text-sm font-black text-slate-900 font-zine-title">
                {navTargetLabel}
              </p>
            </div>
            <div className="w-full bg-slate-200 h-3 rounded-full border-2 border-slate-900 overflow-hidden shadow-[2px_2px_0px_0px_#000]">
              <div className="bg-yellow-400 h-full w-full animate-pulse" />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-xl w-full space-y-6">
        {/* Header Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-yellow-300 border-2 border-slate-900 px-3.5 py-1 rounded-full shadow-[2px_2px_0px_0px_#000] text-xs font-mono font-black uppercase tracking-wider text-slate-900">
            <School className="w-4 h-4 text-slate-900" />
            <span>ClassPulse • Academic Login (Port 5172)</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 font-zine-title tracking-tight flex items-center justify-center gap-2">
            Class<span className="text-indigo-900">Pulse</span> Academic Gateway
          </h1>
          <p className="text-sm font-extrabold text-slate-800 max-w-sm mx-auto">
            Dedicated portal for Classroom Teachers and Students
          </p>
        </div>

        {/* Academic Login Card */}
        <div className="bg-[#f0f9ff] border-2 border-slate-900 rounded-2xl p-6 sm:p-8 space-y-6 relative z-10 shadow-[6px_6px_0px_0px_#000] animate-fadeIn">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <School className="w-5 h-5 text-slate-900 stroke-[2.5]" />
              <span className="text-xs font-black font-mono uppercase tracking-wider bg-slate-900 text-sky-300 px-2.5 py-1 rounded">
                ACADEMIC USER LOGIN
              </span>
            </div>
            <span className="text-xs font-mono font-black bg-sky-200 px-2.5 py-1 rounded border border-slate-900">
              PORT 5172
            </span>
          </div>

          {/* Role Toggle */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
              Select Role:
            </label>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <button
                type="button"
                onClick={() => handleAcademicRoleToggle('teacher')}
                className={`p-3 rounded-xl border-2 border-slate-900 text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                  academicRole === 'teacher'
                    ? 'bg-sky-300 text-slate-900 shadow-[3px_3px_0px_0px_#000] -translate-y-0.5'
                    : 'bg-white text-slate-700 hover:bg-sky-100'
                }`}
              >
                <span className="text-lg">👨‍🏫</span>
                <span>Teacher Login</span>
              </button>

              <button
                type="button"
                onClick={() => handleAcademicRoleToggle('student')}
                className={`p-3 rounded-xl border-2 border-slate-900 text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                  academicRole === 'student'
                    ? 'bg-emerald-300 text-slate-900 shadow-[3px_3px_0px_0px_#000] -translate-y-0.5'
                    : 'bg-white text-slate-700 hover:bg-emerald-100'
                }`}
              >
                <span className="text-lg">🎓</span>
                <span>Student Login</span>
              </button>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border-2 border-slate-900 text-xs space-y-1 transition-all shadow-[2px_2px_0px_0px_#000] ${
            academicRole === 'teacher' ? 'bg-sky-200' : 'bg-emerald-200'
          }`}>
            <div className="flex items-center justify-between font-black text-slate-900">
              <span className="flex items-center gap-1.5 uppercase tracking-wider font-mono text-xs">
                {academicRole === 'teacher' ? <UserCheck className="w-4 h-4 text-slate-900 stroke-[2.5]" /> : <GraduationCap className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
                REDIRECTS TO {academicRole === 'teacher' ? 'TEACHER WORKBENCH (5174)' : 'STUDENT PORTAL (5175)'}
              </span>
            </div>
            <p className="text-slate-900 font-bold leading-relaxed text-xs">
              {academicRole === 'teacher' && 'Access assigned classroom streams, launch live AI quizzes, and review class timetables.'}
              {academicRole === 'student' && 'View classroom timetables, check assigned instructors, and join live quizzes.'}
            </p>
          </div>

          <form onSubmit={handleAcademicSubmit} className="space-y-4 font-mono">
            <div>
              <label className="block text-xs font-black text-slate-900 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>{academicRole === 'teacher' ? 'Teacher Email / Staff ID' : 'Student Email / Roll No'}</span>
              </label>
              <input
                type="email"
                value={academicEmail}
                onChange={(e) => setAcademicEmail(e.target.value)}
                className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 outline-none shadow-[2px_2px_0px_0px_#000]"
                placeholder={academicRole === 'teacher' ? 'anitha@classpulse.edu' : 'ananya@classpulse.edu'}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-900 mb-1 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Password</span>
              </label>
              <input
                type="password"
                value={academicPassword}
                onChange={(e) => setAcademicPassword(e.target.value)}
                className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 outline-none shadow-[2px_2px_0px_0px_#000]"
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              className={`w-full py-3.5 px-4 font-black text-slate-900 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_#000] text-sm flex items-center justify-center gap-2 cursor-pointer transition uppercase tracking-wider mt-2 ${
                academicRole === 'teacher' ? 'bg-sky-300 hover:bg-sky-400' : 'bg-emerald-300 hover:bg-emerald-400'
              }`}
            >
              <span>Log In & Proceed to {academicRole === 'teacher' ? 'Teacher Workbench (5174)' : 'Student Portal (5175)'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </form>
        </div>

        <div className="text-center text-xs font-mono font-black text-slate-700 space-y-1">
          <p>© ClassPulse Smart Education System</p>
        </div>
      </div>
    </div>
  );
};
