import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  School,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  LogOut,
  ChevronDown,
  Sparkles
} from 'lucide-react';

export const Header = () => {
  const { userRole, currentUser, login, logout } = useClassPulse();

  const handleRoleChange = (e) => {
    login(e.target.value);
  };

  return (
    <header className="bg-white border-b-2 border-slate-900 px-6 py-3 flex items-center justify-between z-10 select-none shadow-zine-sm">
      {/* Brand Title & Zine Callout */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-900 border-2 border-slate-900 text-yellow-300 flex items-center justify-center font-extrabold text-sm shadow-zine-sm">
          <School className="w-5 h-5 text-yellow-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-slate-900 font-zine-title tracking-tight">
              ClassPulse Hub
            </h1>
            <span className="px-2 py-0.5 rounded bg-yellow-200 text-slate-900 text-[10px] font-mono font-black uppercase tracking-wider border border-slate-900">
              System Edition
            </span>
          </div>
          <p className="text-[11px] font-handwriting text-slate-600 hidden sm:block">
            Smart Classroom & Administration Workbench
          </p>
        </div>
      </div>

      {/* Right Controls: Role Selector Dropdown & Quick User Status */}
      <div className="flex items-center gap-3">
        {/* Role Selector Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-100 border-2 border-slate-900 px-3 py-1.5 rounded-xl shadow-zine-sm">
          <span className="text-xs font-bold text-slate-900 font-mono uppercase">Role:</span>
          <select
            value={userRole}
            onChange={handleRoleChange}
            className="bg-yellow-200 border-2 border-slate-900 text-xs font-bold text-slate-900 px-2 py-1 rounded-lg cursor-pointer focus:outline-none"
          >
            <option value="admin">🔐 Admin (Control Center)</option>
            <option value="teacher">👨‍🏫 Teacher (Workbench)</option>
            <option value="student">🎓 Student (Portal)</option>
          </select>
        </div>

        {/* User Account Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-2 border-slate-900 rounded-xl shadow-zine-sm">
          <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
            {currentUser?.name ? currentUser.name[0] : 'A'}
          </div>
          <div className="text-left text-xs font-bold leading-none">
            <div className="text-slate-900">{currentUser?.name || 'Administrator'}</div>
            <div className="text-[9px] text-slate-500 font-mono uppercase">{userRole}</div>
          </div>
        </div>

        {/* Quick Logout Button */}
        <button
          onClick={logout}
          className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-900 font-bold border-2 border-slate-900 rounded-xl transition shadow-zine-sm cursor-pointer"
          title="Switch Role / Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
