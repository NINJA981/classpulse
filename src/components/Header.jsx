import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  School,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  LogOut,
  ChevronDown,
  Sparkles,
  Layers,
  HardDrive
} from 'lucide-react';

export const Header = () => {
  const { userRole, currentUser, login, logout } = useClassPulse();

  const handleRoleChange = (e) => {
    login(e.target.value);
  };

  return (
    <header className="bg-[#f4f0e6] border-b-3 border-black px-6 py-3 flex items-center justify-between z-10 select-none shadow-[0px_4px_0px_0px_#000]">
      {/* Brand Title & HyperCard Stack Indicator */}
      <div className="flex items-center gap-3 font-mono">
        <div className="w-9 h-9 rounded bg-black border-2 border-black text-yellow-300 flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_0px_#888]">
          <Layers className="w-5 h-5 text-yellow-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-black font-hypercard-header uppercase tracking-tight">
              ClassPulse
            </h1>
            <span className="px-2 py-0.5 rounded bg-black text-yellow-300 text-[10px] font-bold uppercase tracking-wider border border-black shadow-[1px_1px_0px_0px_#888]">
              HyperCard Stack
            </span>
          </div>
          <p className="text-[10px] font-mono font-bold text-slate-800 hidden sm:block">
            Shoebox Index • Smart Classroom Administration System
          </p>
        </div>
      </div>

      {/* Right Controls: Role Selector Dropdown & Quick User Status */}
      <div className="flex items-center gap-3 font-mono">
        {/* Role Selector Dropdown */}
        <div className="flex items-center gap-1.5 bg-white border-2 border-black px-3 py-1.5 rounded shadow-[2px_2px_0px_0px_#000]">
          <span className="text-xs font-bold text-black uppercase">Stack Role:</span>
          <select
            value={userRole}
            onChange={handleRoleChange}
            className="bg-yellow-200 border-2 border-black text-xs font-bold text-black px-2 py-1 rounded cursor-pointer focus:outline-none"
          >
            <option value="admin">🔐 Admin (Control Center)</option>
            <option value="teacher">👨‍🏫 Teacher (Workbench)</option>
            <option value="student">🎓 Student (Portal)</option>
          </select>
        </div>

        {/* User Account Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_#000]">
          <div className="w-6 h-6 rounded bg-black border border-black text-white font-bold flex items-center justify-center text-xs">
            {currentUser?.name ? currentUser.name[0] : 'A'}
          </div>
          <div className="text-left text-xs font-bold leading-none">
            <div className="text-black">{currentUser?.name || 'Administrator'}</div>
            <div className="text-[9px] text-slate-700 font-mono uppercase">{userRole}</div>
          </div>
        </div>

        {/* Quick Logout Button */}
        <button
          onClick={logout}
          className="p-2 hypercard-btn text-black hover:bg-rose-100 transition rounded cursor-pointer"
          title="Switch Role / Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
