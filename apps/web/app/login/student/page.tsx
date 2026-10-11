import type { Metadata } from 'next';
import { RoleLoginPage } from '@/components/auth/role-login';

// Served at /student/login (proxy.ts rewrites it here so the student layout never wraps the sign-in page).
export const metadata: Metadata = { title: 'Student sign in' };

export default function Page() {
  return <RoleLoginPage role="student" />;
}
