import type { InstitutionFeature, Role } from '@classpulse/shared';
import {
  Atom,
  ChartColumn,
  Library,
  Sparkles,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  Cpu,
  DoorOpen,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Mic,
  Radio,
  Rocket,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (for area home links). */
  exact?: boolean;
}

export const NAV: Record<Role, { title: string; items: NavItem[] }> = {
  admin: {
    title: 'Admin console',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
      { href: '/admin/onboarding', label: 'Onboarding', icon: Rocket },
      { href: '/admin/sections', label: 'Sections', icon: Users },
      { href: '/admin/teachers', label: 'Teachers', icon: GraduationCap },
      { href: '/admin/students', label: 'Students', icon: UserRound },
      { href: '/admin/rooms', label: 'Rooms', icon: DoorOpen },
      { href: '/admin/timetable', label: 'Timetable', icon: CalendarDays },
      { href: '/admin/devices', label: 'Classroom devices', icon: Cpu },
      { href: '/admin/settings', label: 'AI settings', icon: Settings },
    ],
  },
  teacher: {
    title: 'Teacher studio',
    items: [
      { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/teacher/record', label: 'Record a class', icon: Mic },
      { href: '/teacher/lessons', label: 'Lessons', icon: BookOpen },
      { href: '/teacher/assignments', label: 'Assignments', icon: FileCheck2 },
      { href: '/teacher/exams', label: 'Exams', icon: ShieldCheck },
      { href: '/teacher/resources', label: 'AI teaching tools', icon: Sparkles },
      { href: '/teacher/courses', label: 'Courses & materials', icon: Library },
      { href: '/teacher/simulations', label: 'Simulations', icon: Atom },
      { href: '/teacher/insights', label: 'Class insights', icon: ChartColumn },
      { href: '/teacher/classes', label: 'My classes', icon: Users },
      { href: '/teacher/timetable', label: 'Timetable', icon: CalendarDays },
    ],
  },
  student: {
    title: 'Student portal',
    items: [
      { href: '/student', label: 'Home', icon: LayoutDashboard, exact: true },
      { href: '/student/quizzes', label: 'Quizzes', icon: ListChecks },
      { href: '/student/live', label: 'Live quiz', icon: Radio },
      { href: '/student/exams', label: 'Exams', icon: ShieldCheck },
      { href: '/student/assignments', label: 'Assignments', icon: ClipboardList },
      { href: '/student/join', label: 'Join a class', icon: KeyRound },
      { href: '/student/profile', label: 'Profile', icon: UserRound },
    ],
  },
};

/**
 * Nav items that belong to a platform feature switch: hidden when the platform turns the
 * feature off for the school (features come from /api/auth/me). Keyed by href.
 */
export const NAV_FEATURE: Record<string, InstitutionFeature> = {
  '/admin/devices': 'devices',
  '/teacher/record': 'devices',
  '/teacher/assignments': 'assignments',
  '/teacher/exams': 'exams',
  '/teacher/resources': 'teacherTools',
  '/teacher/courses': 'teacherTools',
  '/teacher/simulations': 'teacherTools',
  '/teacher/insights': 'teacherTools',
  '/student/live': 'liveQuiz',
  '/student/exams': 'exams',
  '/student/assignments': 'assignments',
};
