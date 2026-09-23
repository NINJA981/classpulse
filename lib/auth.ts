import { api } from './api';

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

const AUTH_STORAGE_KEY = 'clasepulse_teacher_auth_v1';
const JWT_STORAGE_KEY = 'clasepulse_jwt_token';

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * The API returns an account, not the richer profile this UI shows. The fields it has no
 * column for are left blank rather than filled in with something plausible.
 */
function toProfile(teacher: { id: string; name: string; email: string }): TeacherProfile {
  return {
    id: teacher.id,
    name: teacher.name,
    title: '',
    email: teacher.email,
    department: '',
    institution: '',
    initials: initialsOf(teacher.name),
    assignedClasses: []
  };
}

/** The signed-in teacher, or null. Never invents a session. */
export function getAuthTeacher(): TeacherProfile | null {
  if (!isBrowser()) return null;
  try {
    // The profile is only meaningful alongside the token every API call needs.
    if (!localStorage.getItem(JWT_STORAGE_KEY)) return null;
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TeacherProfile) : null;
  } catch {
    return null;
  }
}

/** Signs in against the backend. Throws when the credentials do not match. */
export async function loginTeacher(email: string, password: string): Promise<TeacherProfile> {
  const result = await api.login(email, password);
  const profile = toProfile(result.teacher);
  if (isBrowser()) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function logoutTeacher(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(JWT_STORAGE_KEY);
}

export function isTeacherAuthenticated(): boolean {
  if (!isBrowser()) return false;
  return !!localStorage.getItem(JWT_STORAGE_KEY);
}
