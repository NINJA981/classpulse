export interface TeacherProfile {
  id: string;
  name: string;
  title: string;
  email: string;
  department: string;
  institution: string;
  initials: string;
  avatarUrl?: string;
  assignedClasses: string[];
}

export const DEMO_TEACHER: TeacherProfile = {
  id: 'tch_001',
  name: 'Prof. Priya Sharma',
  title: 'Associate Professor of Life Sciences',
  email: 'priya.sharma@apex.edu',
  department: 'Department of Natural Sciences',
  institution: 'Apex Institute of Technology & Higher Learning',
  initials: 'PS',
  assignedClasses: [
    'Grade 10 - Section B',
    'Grade 11 - Section A',
    'Grade 9 - Section C',
    'Grade 11 - Advanced Physics'
  ]
};

const AUTH_STORAGE_KEY = 'clasepulse_teacher_auth_v1';

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getAuthTeacher(): TeacherProfile | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      // Default to demo teacher for friction-free first-time experience
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEMO_TEACHER));
      return DEMO_TEACHER;
    }
    return JSON.parse(raw);
  } catch {
    return DEMO_TEACHER;
  }
}

export function loginTeacher(email: string, _password?: string): TeacherProfile {
  if (!isBrowser()) return DEMO_TEACHER;
  const profile: TeacherProfile = {
    ...DEMO_TEACHER,
    email: email.trim() || DEMO_TEACHER.email
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function logoutTeacher(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isTeacherAuthenticated(): boolean {
  if (!isBrowser()) return false;
  return !!localStorage.getItem(AUTH_STORAGE_KEY);
}
