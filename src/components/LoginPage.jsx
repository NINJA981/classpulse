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
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const handleRoleLogin = (e) => {
    e.preventDefault();
    login(selectedRole);
  };

  const setPresetUser = (role) => {
    setSelectedRole(role);
    if (role === 'admin') {
      setEmailInput('admin@classpulse.edu');
    } else if (role === 'teacher') {
      setEmailInput('anitha@classpulse.edu');
    } else {
      setEmailInput('ananya@classpulse.edu');
    }
    login(role);
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Background Zine Doodle Accents */}
      <div className="absolute top-8 left-8 transform -rotate-6 hidden lg:block">
        <div className="zine-card-yellow p-4 w-52 font-handwriting text-xs space-y-1">
          <div className="font-bold text-sm underline decoration-wavy decoration-slate-900">ZINE EXPLAINER!</div>
          <p>Welcome to ClassPulse Admin System!</p>
          <p className="text-[11px] text-slate-700">Pick your role from the dropdown below to enter your workspace.</p>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 transform rotate-3 hidden lg:block">
        <div className="zine-card-sky p-4 w-60 font-handwriting text-xs space-y-1">
          <div className="font-bold text-sm text-slate-900 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-indigo-600" /> 3 Login Roles
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            <li><strong>Admin:</strong> Control access, add classrooms, teachers & timetables.</li>
            <li><strong>Teacher:</strong> Manage active class & quizzes.</li>
            <li><strong>Student:</strong> View timetable & join live quiz.</li>
          </ul>
        </div>
      </div>

      {/* Main Login Zine Card Container */}
      <div className="max-w-md w-full space-y-6">
        {/* Zine Header Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-yellow-200 border-2 border-slate-900 px-3 py-1 rounded-full shadow-zine-sm text-xs font-mono font-bold uppercase tracking-wider">
            <School className="w-4 h-4 text-slate-900" />
            <span>ClassPulse System • Vol. 1</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 font-zine-title tracking-tight flex items-center justify-center gap-2">
            Sign In to ClassPulse
          </h1>
          <p className="text-xs font-semibold text-slate-600 font-handwriting max-w-xs mx-auto">
            Clean & organized smart classroom management system
          </p>
        </div>

        {/* Login Zine Box */}
        <div className="zine-card p-6 sm:p-8 space-y-6 relative z-10 zine-tape-top">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <span className="text-xs font-bold font-mono uppercase tracking-wider bg-slate-900 text-white px-2 py-0.5 rounded">
              STEP 1: SELECT LOGIN ROLE
            </span>
            <span className="text-xs font-handwriting font-bold text-slate-600">Hand-Drawn UI</span>
          </div>

          <form onSubmit={handleRoleLogin} className="space-y-4">
            {/* Role Dropdown Selector */}
            <div>
              <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Select Your Login Role:</span>
                <span className="text-[11px] font-handwriting text-indigo-700 font-normal">Choose 1 of 3</span>
              </label>
              
              <div className="relative">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl font-bold text-sm text-slate-900 outline-none shadow-zine-sm focus:shadow-zine cursor-pointer appearance-none pr-10"
                >
                  <option value="student">🎓 Student Login</option>
                  <option value="teacher">👨‍🏫 Teacher Login</option>
                  <option value="admin">🔐 Admin Login (System Management)</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-900 font-bold text-xs bg-yellow-200 border border-slate-900 px-1.5 py-0.5 rounded">
                  ▼
                </div>
              </div>
            </div>

            {/* Role Preview Card Callout */}
            <div className={`p-3.5 rounded-xl border-2 border-slate-900 shadow-zine-sm text-xs space-y-1 transition-all ${
              selectedRole === 'admin' ? 'bg-yellow-100' : selectedRole === 'teacher' ? 'bg-sky-100' : 'bg-emerald-100'
            }`}>
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span className="flex items-center gap-1.5 uppercase tracking-wider font-mono text-[11px]">
                  {selectedRole === 'admin' && <ShieldCheck className="w-4 h-4 text-amber-700" />}
                  {selectedRole === 'teacher' && <UserCheck className="w-4 h-4 text-sky-700" />}
                  {selectedRole === 'student' && <GraduationCap className="w-4 h-4 text-emerald-700" />}
                  {selectedRole.toUpperCase()} ACCESS PRIVILEGES
                </span>
                <span className="px-1.5 py-0.5 bg-white border border-slate-900 text-[10px] font-bold rounded">
                  SELECTED
                </span>
              </div>
              <p className="text-slate-700 font-medium leading-relaxed">
                {selectedRole === 'admin' && 'Access Control, Add/Manage Classrooms, Teachers, Students, and Assign Timetables & Rosters.'}
                {selectedRole === 'teacher' && 'Manage assigned classes, trigger live AI quizzes, review student rosters, and view class timetables.'}
                {selectedRole === 'student' && 'View weekly classroom timetable, check assigned teachers, and participate in active quizzes.'}
              </p>
            </div>

            {/* Simulated Email / User ID Input */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Email or User ID</label>
                <input
                  type="email"
                  placeholder={
                    selectedRole === 'admin' ? 'admin@classpulse.edu' : selectedRole === 'teacher' ? 'anitha@classpulse.edu' : 'ananya@classpulse.edu'
                  }
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-medium text-slate-900 outline-none shadow-zine-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Password / Security PIN</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-medium text-slate-900 outline-none shadow-zine-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-yellow-300 hover:bg-yellow-400 active:bg-yellow-500 text-slate-900 font-extrabold rounded-xl border-2 border-slate-900 shadow-zine-interactive text-sm flex items-center justify-center gap-2 cursor-pointer transition uppercase tracking-wider"
            >
              <span>Log In as {selectedRole.toUpperCase()}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Preset Account Picker */}
          <div className="pt-4 border-t-2 border-slate-900 space-y-2">
            <span className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider font-mono">
              ⚡ Quick Preset Logins:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPresetUser('admin')}
                className={`p-2 rounded-lg border-2 border-slate-900 text-[11px] font-bold text-left transition cursor-pointer ${
                  selectedRole === 'admin' ? 'bg-yellow-200 shadow-zine-sm' : 'bg-white hover:bg-slate-100'
                }`}
              >
                🔐 Admin
              </button>
              <button
                type="button"
                onClick={() => setPresetUser('teacher')}
                className={`p-2 rounded-lg border-2 border-slate-900 text-[11px] font-bold text-left transition cursor-pointer ${
                  selectedRole === 'teacher' ? 'bg-sky-200 shadow-zine-sm' : 'bg-white hover:bg-slate-100'
                }`}
              >
                👨‍🏫 Teacher
              </button>
              <button
                type="button"
                onClick={() => setPresetUser('student')}
                className={`p-2 rounded-lg border-2 border-slate-900 text-[11px] font-bold text-left transition cursor-pointer ${
                  selectedRole === 'student' ? 'bg-emerald-200 shadow-zine-sm' : 'bg-white hover:bg-slate-100'
                }`}
              >
                🎓 Student
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] font-handwriting text-slate-600 space-y-1">
          <p>© ClassPulse Smart Education • Zine Explainer Edition</p>
        </div>
      </div>
    </div>
  );
};
