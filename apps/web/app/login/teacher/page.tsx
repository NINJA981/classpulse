import type { Metadata } from 'next';
import { RoleLoginPage } from '@/components/auth/role-login';

// Served at /teacher/login (proxy.ts rewrites it here so the teacher layout never wraps the sign-in page).
export const metadata: Metadata = { title: 'Teacher sign in' };

export default function Page() {
  return <RoleLoginPage role="teacher" />;
}
