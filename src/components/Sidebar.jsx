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
  Layers,
  HardDrive
} from 'lucide-react';

export const Sidebar = () => {
  const { activeTab, setActiveTab, userRole } = useClassPulse();

  // Navigation items based on logged in role
  // Notice: AI Quiz Workbench is REMOVED from Admin navigation!
  const adminNavItems = [
    { id: 'management', label: 'HyperCard Admin Stack', icon: Layers, badge: 'STACK v2' },
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
    <aside className="w-64 bg-[#f4f0e6] border-r-3 border-black flex flex-col justify-between p-4 z-20 select-none shadow-[4px_0px_0px_0px_#000]">
      <div>
        {/* Logo & HyperCard Stack Header */}
        <div className="hypercard-card-yellow p-3 mb-5 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded bg-black flex items-center justify-center border-2 border-black text-yellow-300 shadow-[2px_2px_0px_0px_#888]">
              <Layers className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight text-black font-hypercard-header leading-tight uppercase">
                Hyper<span className="text-slate-800">Card</span>
              </h1>
              <p className="text-[10px] font-mono font-bold text-slate-800 uppercase tracking-wider">SHOEBOX INDEX</p>
            </div>
          </div>
        </div>

        {/* HyperCard Role Indicator Callout */}
        <div className="mb-4 p-2.5 rounded bg-white border-2 border-black text-xs font-mono space-y-0.5 shadow-[2px_2px_0px_0px_#000]">
          <span className="font-bold text-black block text-[10px] uppercase tracking-wider">Current Stack Mode:</span>
          <span className="font-bold text-black flex items-center gap-1">
            {userRole === 'admin' && '🔐 Admin Shoebox Stack'}
            {userRole === 'teacher' && '👨‍🏫 Teacher Workbench'}
            {userRole === 'student' && '🎓 Student Learning Stack'}
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
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded text-xs font-mono font-bold transition border-2 border-black cursor-pointer ${
                  isActive
                    ? 'bg-black text-yellow-300 shadow-[3px_3px_0px_0px_#888] translate-x-1'
                    : 'bg-white text-black hover:bg-yellow-50 shadow-[2px_2px_0px_0px_#000]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-yellow-300' : 'text-black'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded uppercase border ${
                    isActive ? 'bg-yellow-300 text-black border-black' : 'bg-black text-white border-black'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer HyperCard Stack System Card */}
      <div className="pt-4 border-t-2 border-black space-y-2 font-mono">
        <div className="hypercard-card-sky p-3 text-xs space-y-1">
          <div className="font-bold text-black flex items-center gap-1 font-mono text-[11px]">
            <HardDrive className="w-3.5 h-3.5 text-black" /> HyperCard 2.0
          </div>
          <p className="text-[10px] text-slate-800 leading-tight">
            Classic Apple HyperCard Shoebox Stack UI for Smart Classroom Management.
          </p>
        </div>
      </div>
    </aside>
  );
};
