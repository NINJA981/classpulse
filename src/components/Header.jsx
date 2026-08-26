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
        <div className="w-10 h-10 rounded-xl bg-slate-900 border-2 border-slate-900 text-yellow-300 flex items-center justify-center font-extrabold text-sm shadow-zine-sm">
          <School className="w-5 h-5 text-yellow-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 font-zine-title tracking-tight leading-none">
              ClassPulse Hub
            </h1>
            <span className="px-2 py-0.5 rounded bg-yellow-300 text-slate-900 text-xs font-mono font-black uppercase tracking-wider border border-slate-900 leading-none">
              System Edition
            </span>
          </div>
          <p className="text-xs font-mono font-bold text-slate-700 hidden sm:block mt-0.5">
            Smart Classroom & Administration Workbench
          </p>
        </div>
      </div>

      {/* Right Controls: Role Selector Dropdown & Quick User Status */}
      <div className="flex items-center gap-3">
        {/* Role Selector Dropdown */}
        <div className="flex items-center gap-2 bg-slate-100 border-2 border-slate-900 px-3 py-1.5 rounded-xl shadow-zine-sm">
          <span className="text-xs font-mono font-black text-slate-900 uppercase">Role:</span>
          <select
            value={userRole}
            onChange={handleRoleChange}
            className="bg-yellow-300 border-2 border-slate-900 text-xs font-mono font-black text-slate-900 px-2.5 py-1 rounded-lg cursor-pointer focus:outline-none shadow-[1px_1px_0px_0px_#000]"
          >
            <option value="admin">🔐 Admin (Control Center)</option>
            <option value="teacher">👨‍🏫 Teacher (Workbench)</option>
            <option value="student">🎓 Student (Portal)</option>
          </select>
        </div>

        {/* User Account Pill */}
        <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 bg-white border-2 border-slate-900 rounded-xl shadow-zine-sm">
          <div className="w-7 h-7 rounded-full bg-slate-900 text-yellow-300 font-black flex items-center justify-center text-xs border border-slate-900">
            {currentUser?.name ? currentUser.name[0] : 'A'}
          </div>
          <div className="text-left text-xs font-bold leading-tight">
            <div className="text-slate-900 font-black text-xs">{currentUser?.name || 'Administrator'}</div>
            <div className="text-[10px] text-slate-700 font-mono font-black uppercase">{userRole}</div>
          </div>
        </div>

        {/* Quick Logout Button */}
        <button
          onClick={logout}
          className="p-2 bg-slate-100 hover:bg-rose-200 text-slate-900 font-bold border-2 border-slate-900 rounded-xl transition shadow-zine-sm cursor-pointer"
          title="Switch Role / Logout"
        >
          <LogOut className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </header>
  );
};
