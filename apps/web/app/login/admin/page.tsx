import type { Metadata } from 'next';
import { RoleLoginPage } from '@/components/auth/role-login';

// Served at /admin/login (proxy.ts rewrites it here so the admin layout never wraps the sign-in page).
export const metadata: Metadata = { title: 'School admin sign in' };

export default function Page() {
  return <RoleLoginPage role="admin" />;
}
