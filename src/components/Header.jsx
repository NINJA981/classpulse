import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  School,
  LogOut,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Sparkles,
  ChevronDown,
  RefreshCw
} from 'lucide-react';

export const Header = () => {
  const { currentUser, userRole, logout, classrooms, login } = useClassPulse();

  return (
    <header className="bg-white border-b-2 border-slate-900 px-4 sm:px-6 py-3 flex items-center justify-between z-10 shadow-zine-sm">
      {/* Left: Active Classroom Context Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1.5 rounded-xl border-2 border-slate-900 shadow-zine-sm">
          <School className="w-4 h-4 text-slate-900" />
          <select className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer">
            {classrooms.map(cls => (
              <option key={cls.id} value={cls.id} className="bg-white text-slate-900 font-bold">
                {cls.name} ({cls.room})
              </option>
            ))}
          </select>
        </div>

        {/* Zine Role Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-mono font-bold uppercase tracking-wider shadow-zine-sm font-handwriting ${
          userRole === 'admin' ? 'bg-yellow-200' : userRole === 'teacher' ? 'bg-sky-200' : 'bg-emerald-200'
        }">
          {userRole === 'admin' && <ShieldCheck className="w-4 h-4 text-slate-900" />}
          {userRole === 'teacher' && <UserCheck className="w-4 h-4 text-slate-900" />}
          {userRole === 'student' && <GraduationCap className="w-4 h-4 text-slate-900" />}
          <span>ROLE: {userRole.toUpperCase()}</span>
        </div>
      </div>

      {/* Right: Logged-in Profile & Logout */}
      <div className="flex items-center gap-3">
        {/* Role Quick Switcher dropdown button */}
        <div className="relative group hidden md:block">
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-yellow-200 border-2 border-slate-900 rounded-xl text-xs font-extrabold cursor-pointer transition">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Switch Role</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border-2 border-slate-900 rounded-xl shadow-zine p-1 hidden group-hover:block z-50">
            <button
              onClick={() => login('admin')}
              className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-yellow-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              🔐 Admin View
            </button>
            <button
              onClick={() => login('teacher')}
              className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-sky-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              👨‍🏫 Teacher View
            </button>
            <button
              onClick={() => login('student')}
              className="w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              🎓 Student View
            </button>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-2 pl-3 border-l-2 border-slate-900">
          <div className="w-9 h-9 rounded-xl bg-yellow-300 border-2 border-slate-900 flex items-center justify-center font-extrabold text-xs text-slate-900 shadow-zine-sm">
            {currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('') : 'CP'}
          </div>
          <div className="hidden md:block leading-tight">
            <span className="text-xs font-extrabold text-slate-900 block">{currentUser?.name || 'Admin User'}</span>
            <span className="text-[10px] font-handwriting font-bold text-slate-600 capitalize">{userRole} Portal</span>
          </div>

          <button
            onClick={logout}
            className="ml-1 p-2 bg-rose-100 hover:bg-rose-200 text-slate-900 rounded-xl border-2 border-slate-900 shadow-zine-sm transition cursor-pointer"
            title="Log Out to Login Screen"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
