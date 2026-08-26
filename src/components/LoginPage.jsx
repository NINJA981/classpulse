import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Sparkles,
  ArrowRight,
  School,
  CheckCircle2,
  Lock,
  Zap,
  BookOpen
} from 'lucide-react';

export const LoginPage = () => {
  const { login } = useClassPulse();
  const [selectedRole, setSelectedRole] = useState('admin');
  const [emailInput, setEmailInput] = useState('admin@classpulse.edu');
  const [passwordInput, setPasswordInput] = useState('');

  const handleRoleLogin = (e) => {
    e.preventDefault();
    login(selectedRole);
  };

  const selectRoleAndFill = (role) => {
    setSelectedRole(role);
    if (role === 'admin') {
      setEmailInput('admin@classpulse.edu');
    } else if (role === 'teacher') {
      setEmailInput('anitha@classpulse.edu');
    } else {
      setEmailInput('ananya@classpulse.edu');
    }
  };

  const quickLoginRole = (role) => {
    selectRoleAndFill(role);
    login(role);
  };

  return (
    <div className="min-h-screen bg-[#f7f4ed] flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Background Decorative Cards */}
      <div className="absolute top-8 left-8 transform -rotate-3 hidden lg:block">
        <div className="bg-yellow-200 border-2 border-slate-900 shadow-[3px_3px_0px_0px_#000] p-4 w-56 rounded-xl font-mono text-xs space-y-1 text-slate-900">
          <div className="font-extrabold text-sm underline text-slate-900">ACCESSIBLE PORTAL</div>
          <p className="font-bold">Welcome to ClassPulse System!</p>
          <p className="text-[11px] text-slate-800 font-medium">Select your role card below to enter your workspace.</p>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 transform rotate-3 hidden lg:block">
        <div className="bg-sky-200 border-2 border-slate-900 shadow-[3px_3px_0px_0px_#000] p-4 w-60 rounded-xl font-mono text-xs space-y-1 text-slate-900">
          <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-slate-900" /> 3 System Roles
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-bold">
            <li><strong>Admin:</strong> Control access, add classrooms & timetables.</li>
            <li><strong>Teacher:</strong> Manage active class & quizzes.</li>
            <li><strong>Student:</strong> View timetable & join live quiz.</li>
          </ul>
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="max-w-md w-full space-y-6">
        {/* Header Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-yellow-300 border-2 border-slate-900 px-3.5 py-1 rounded-full shadow-[2px_2px_0px_0px_#000] text-xs font-mono font-black uppercase tracking-wider text-slate-900">
            <School className="w-4 h-4 text-slate-900" />
            <span>ClassPulse Portal • System Access</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 font-zine-title tracking-tight flex items-center justify-center gap-2">
            Sign In to ClassPulse
          </h1>
          <p className="text-sm font-extrabold text-slate-800 max-w-xs mx-auto">
            Clean & organized smart classroom management system
          </p>
        </div>

        {/* Login Box with Soft Light Background */}
        <div className="bg-[#fefce8] border-2 border-slate-900 rounded-2xl p-6 sm:p-8 space-y-6 relative z-10 shadow-[6px_6px_0px_0px_#000]">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <span className="text-xs font-black font-mono uppercase tracking-wider bg-slate-900 text-yellow-300 px-2.5 py-1 rounded">
              SELECT YOUR LOGIN ROLE
            </span>
          </div>

          <form onSubmit={handleRoleLogin} className="space-y-5">
            {/* Button-based Preset Role Selector (No Dropdown!) */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                <span>Choose Role to Sign In:</span>
                <span className="text-[11px] font-mono text-slate-700 font-bold">1-Click Select</span>
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                {/* Student Role Card */}
                <button
                  type="button"
                  onClick={() => selectRoleAndFill('student')}
                  className={`p-3 rounded-xl border-2 border-slate-900 font-mono text-xs font-black flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                    selectedRole === 'student'
                      ? 'bg-emerald-300 text-slate-900 shadow-[3px_3px_0px_0px_#000] -translate-y-0.5'
                      : 'bg-white text-slate-800 hover:bg-emerald-50'
                  }`}
                >
                  <span className="text-xl">🎓</span>
                  <span>Student</span>
                </button>

                {/* Teacher Role Card */}
                <button
                  type="button"
                  onClick={() => selectRoleAndFill('teacher')}
                  className={`p-3 rounded-xl border-2 border-slate-900 font-mono text-xs font-black flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                    selectedRole === 'teacher'
                      ? 'bg-sky-300 text-slate-900 shadow-[3px_3px_0px_0px_#000] -translate-y-0.5'
                      : 'bg-white text-slate-800 hover:bg-sky-50'
                  }`}
                >
                  <span className="text-xl">👨‍🏫</span>
                  <span>Teacher</span>
                </button>

                {/* Admin Role Card */}
                <button
                  type="button"
                  onClick={() => selectRoleAndFill('admin')}
                  className={`p-3 rounded-xl border-2 border-slate-900 font-mono text-xs font-black flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                    selectedRole === 'admin'
                      ? 'bg-yellow-300 text-slate-900 shadow-[3px_3px_0px_0px_#000] -translate-y-0.5'
                      : 'bg-white text-slate-800 hover:bg-yellow-50'
                  }`}
                >
                  <span className="text-xl">🔐</span>
                  <span>Admin</span>
                </button>
              </div>
            </div>

            {/* Role Privilege Summary Box */}
            <div className={`p-3.5 rounded-xl border-2 border-slate-900 text-xs space-y-1 transition-all shadow-[2px_2px_0px_0px_#000] ${
              selectedRole === 'admin' ? 'bg-yellow-200' : selectedRole === 'teacher' ? 'bg-sky-200' : 'bg-emerald-200'
            }`}>
              <div className="flex items-center justify-between font-black text-slate-900">
                <span className="flex items-center gap-1.5 uppercase tracking-wider font-mono text-xs">
                  {selectedRole === 'admin' && <ShieldCheck className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
                  {selectedRole === 'teacher' && <UserCheck className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
                  {selectedRole === 'student' && <GraduationCap className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
                  {selectedRole.toUpperCase()} ACCESS PRIVILEGES
                </span>
                <span className="px-1.5 py-0.5 bg-white border border-slate-900 text-[10px] font-black rounded uppercase">
                  SELECTED
                </span>
              </div>
              <p className="text-slate-900 font-bold leading-relaxed text-xs">
                {selectedRole === 'admin' && 'Access Control, Add/Manage Classrooms, Teachers, Students, and Assign Timetables & Rosters.'}
                {selectedRole === 'teacher' && 'Manage assigned classes, trigger live AI quizzes, review student rosters, and view class timetables.'}
                {selectedRole === 'student' && 'View weekly classroom timetable, check assigned teachers, and participate in active quizzes.'}
              </p>
            </div>

            {/* Simulated Email & Password Inputs */}
            <div className="space-y-3 font-mono">
              <div>
                <label className="block text-xs font-black text-slate-900 mb-1">Email or User ID</label>
                <input
                  type="email"
                  placeholder={
                    selectedRole === 'admin' ? 'admin@classpulse.edu' : selectedRole === 'teacher' ? 'anitha@classpulse.edu' : 'ananya@classpulse.edu'
                  }
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-900 mb-1">Password / Security PIN</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-yellow-300 hover:bg-yellow-400 active:bg-yellow-500 text-slate-900 font-black rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_#000] text-sm flex items-center justify-center gap-2 cursor-pointer transition uppercase tracking-wider"
            >
              <span>Log In as {selectedRole.toUpperCase()}</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </form>

          {/* Quick 1-Click Direct Role Login Buttons */}
          <div className="pt-4 border-t-2 border-slate-900 space-y-2">
            <span className="text-[11px] font-black text-slate-800 block uppercase tracking-wider font-mono">
              ⚡ Quick 1-Click Direct Logins:
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono">
              <button
                type="button"
                onClick={() => quickLoginRole('admin')}
                className={`p-2 rounded-lg border-2 border-slate-900 text-xs font-black text-center transition cursor-pointer shadow-[2px_2px_0px_0px_#000] ${
                  selectedRole === 'admin' ? 'bg-yellow-300' : 'bg-white hover:bg-yellow-100'
                }`}
              >
                🔐 Admin
              </button>
              <button
                type="button"
                onClick={() => quickLoginRole('teacher')}
                className={`p-2 rounded-lg border-2 border-slate-900 text-xs font-black text-center transition cursor-pointer shadow-[2px_2px_0px_0px_#000] ${
                  selectedRole === 'teacher' ? 'bg-sky-300' : 'bg-white hover:bg-sky-100'
                }`}
              >
                👨‍🏫 Teacher
              </button>
              <button
                type="button"
                onClick={() => quickLoginRole('student')}
                className={`p-2 rounded-lg border-2 border-slate-900 text-xs font-black text-center transition cursor-pointer shadow-[2px_2px_0px_0px_#000] ${
                  selectedRole === 'student' ? 'bg-emerald-300' : 'bg-white hover:bg-emerald-100'
                }`}
              >
                🎓 Student
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs font-mono font-black text-slate-700 space-y-1">
          <p>© ClassPulse Smart Education System</p>
        </div>
      </div>
    </div>
  );
};
