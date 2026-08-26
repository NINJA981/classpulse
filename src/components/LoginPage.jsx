import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  School,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  ArrowRight,
  Sparkles,
  Lock,
  Layers,
  HardDrive
} from 'lucide-react';

export const LoginPage = () => {
  const { login } = useClassPulse();
  const [selectedRole, setSelectedRole] = useState('admin');

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    login(selectedRole);
  };

  return (
    <div className="min-h-screen bg-[#eae5d9] flex items-center justify-center p-4 font-mono select-none">
      {/* HyperCard Shoebox Stack Window Container */}
      <div className="hypercard-stack max-w-lg w-full overflow-hidden">
        {/* Macintosh Window Title Bar */}
        <div className="bg-[#d5cfbf] border-b-2 border-black px-4 py-2 flex items-center justify-between font-mono text-xs font-bold">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-black bg-white flex items-center justify-center font-bold text-[9px]">■</div>
            <span className="font-hypercard-header uppercase tracking-wider text-black">HYPERCARD v2.0 • SHOEBOX LOGIN STACK</span>
          </div>
          <div className="mac-title-bar h-3.5 w-24 border border-black hidden sm:block"></div>
        </div>

        {/* Card Body */}
        <div className="p-6 bg-[#f7f4ed] space-y-6">
          {/* Header Banner */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-black border-2 border-black text-yellow-300 shadow-[3px_3px_0px_0px_#888] mb-2">
              <Layers className="w-6 h-6 text-yellow-300" />
            </div>
            <h1 className="text-2xl font-black text-black font-hypercard-header uppercase tracking-tight">
              ClassPulse HyperCard
            </h1>
            <p className="text-xs font-bold text-slate-800 max-w-xs mx-auto">
              Smart Classroom Administration Shoebox Stack. Select your account role to open the stack index.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {/* 3-Role Dropdown Selector */}
            <div className="hypercard-card p-4 space-y-2 bg-white">
              <label className="block text-xs font-bold text-black uppercase tracking-wider">
                Select Account Role:
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-3 bg-yellow-200 border-2 border-black text-xs font-bold text-black rounded cursor-pointer shadow-[2px_2px_0px_0px_#000]"
              >
                <option value="admin">🔐 Admin (Control Center)</option>
                <option value="teacher">👨‍🏫 Teacher (Workbench)</option>
                <option value="student">🎓 Student (Portal & Timetable)</option>
              </select>
            </div>

            {/* Role Capabilities Explanation Card */}
            <div className="p-4 rounded border-2 border-black bg-[#fffbeb] text-xs space-y-2 shadow-[3px_3px_0px_0px_#000]">
              <div className="font-hypercard-header font-bold text-black flex items-center gap-1.5 uppercase">
                <HardDrive className="w-4 h-4 text-black" />
                <span>
                  {selectedRole === 'admin' && '🔐 Admin Stack Capabilities'}
                  {selectedRole === 'teacher' && '👨‍🏫 Teacher Stack Capabilities'}
                  {selectedRole === 'student' && '🎓 Student Stack Capabilities'}
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed font-bold">
                {selectedRole === 'admin' && 'Access control permissions, adding classrooms/teachers/students, assigning teacher leads, student rosters, and weekly timetables.'}
                {selectedRole === 'teacher' && 'Manage assigned class sections, view schedule timetable, and trigger classroom live quiz broadcasts.'}
                {selectedRole === 'student' && 'View your individual student ID card, weekly classroom schedule, and join live quiz sessions.'}
              </p>
            </div>

            {/* Quick Login Preset Buttons */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider text-center">
                Instant Quick Logins:
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => login('admin')}
                  className={`py-2 px-2 text-[11px] font-bold border-2 border-black rounded transition cursor-pointer ${
                    selectedRole === 'admin'
                      ? 'bg-black text-yellow-300 shadow-[2px_2px_0px_0px_#888]'
                      : 'bg-white text-black hover:bg-yellow-100 shadow-[2px_2px_0px_0px_#000]'
                  }`}
                >
                  🔐 Admin
                </button>
                <button
                  type="button"
                  onClick={() => login('teacher')}
                  className={`py-2 px-2 text-[11px] font-bold border-2 border-black rounded transition cursor-pointer ${
                    selectedRole === 'teacher'
                      ? 'bg-black text-yellow-300 shadow-[2px_2px_0px_0px_#888]'
                      : 'bg-white text-black hover:bg-sky-100 shadow-[2px_2px_0px_0px_#000]'
                  }`}
                >
                  👨‍🏫 Teacher
                </button>
                <button
                  type="button"
                  onClick={() => login('student')}
                  className={`py-2 px-2 text-[11px] font-bold border-2 border-black rounded transition cursor-pointer ${
                    selectedRole === 'student'
                      ? 'bg-black text-yellow-300 shadow-[2px_2px_0px_0px_#888]'
                      : 'bg-white text-black hover:bg-emerald-100 shadow-[2px_2px_0px_0px_#000]'
                  }`}
                >
                  🎓 Student
                </button>
              </div>
            </div>

            {/* Main Submit Button */}
            <button
              type="submit"
              className="w-full py-3 hypercard-btn-primary text-xs flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer mt-4"
            >
              <span>Open HyperCard Stack</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Card Footer */}
        <div className="bg-[#e8e3d5] border-t-2 border-black px-4 py-2 text-center text-[10px] text-slate-700 font-bold">
          HyperCard Stack UI System v2.0 • Retro Macintosh Desktop Edition
        </div>
      </div>
    </div>
  );
};
