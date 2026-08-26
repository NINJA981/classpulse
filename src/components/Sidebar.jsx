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
  BookOpen,
  Calendar,
  Lock,
  Layers
} from 'lucide-react';

export const Sidebar = () => {
  const { activeTab, setActiveTab, userRole } = useClassPulse();

  // Navigation items based on logged in role
  // Notice: AI Quiz Workbench is REMOVED from Admin navigation!
  const adminNavItems = [
    { id: 'management', label: 'Admin Control', icon: Layers, badge: 'CORE' },
    { id: 'analytics', label: 'Class Analytics', icon: BarChart3 }
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

  const navItems = userRole === 'admin' ? adminNavItems : userRole === 'teacher' ? teacherNavItems : studentNavItems;

  return (
    <aside className="w-64 bg-white border-r-2 border-slate-900 flex flex-col justify-between p-4 z-20 select-none shadow-zine-sm">
      <div>
        {/* Logo & Zine Brand Header */}
        <div className="zine-card-yellow p-3 mb-6 relative zine-tape-top space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center border-2 border-slate-900 shadow-zine-sm">
              <School className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight text-slate-900 font-zine-title leading-tight">
                Class<span className="text-indigo-900">Pulse</span>
              </h1>
              <p className="text-[10px] font-mono font-extrabold text-slate-900 uppercase tracking-wider">SMART SYSTEM</p>
            </div>
          </div>
        </div>

        {/* Role Indicator Callout */}
        <div className="mb-4 p-2.5 rounded-xl bg-slate-100 border-2 border-slate-900 text-xs font-mono font-bold space-y-0.5 shadow-zine-sm">
          <span className="font-black text-slate-900 block font-mono text-[10px] uppercase tracking-wider">Logged In Mode:</span>
          <span className="font-extrabold text-slate-900 flex items-center gap-1">
            {userRole === 'admin' && '🔐 System Administrator'}
            {userRole === 'teacher' && '👨‍🏫 Classroom Teacher'}
            {userRole === 'student' && '🎓 Enrolled Student'}
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-mono font-black transition border-2 border-slate-900 cursor-pointer ${
                  isActive
                    ? 'bg-yellow-300 text-slate-900 shadow-zine-sm translate-x-1'
                    : 'bg-white text-slate-900 hover:bg-yellow-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-slate-900 stroke-[2.5]" />
                  <span className="font-mono font-black text-xs">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-black rounded bg-slate-900 text-yellow-300 border border-slate-900 uppercase leading-none">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Info Card */}
      <div className="pt-4 border-t-2 border-slate-900 space-y-2">
        <div className="zine-card-pink p-3 text-xs space-y-1">
          <div className="font-bold text-slate-900 flex items-center gap-1 font-mono text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-slate-900" /> ClassPulse v2.5
          </div>
          <p className="text-[11px] font-mono font-bold text-slate-800 leading-tight">
            ClassPulse Administration System & Learning Workbench.
          </p>
        </div>
      </div>
    </aside>
  );
};
