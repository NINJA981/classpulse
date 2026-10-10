import { redirect } from 'next/navigation';
import { ROLE_HOME } from '@classpulse/shared';
import { getSession } from '@/lib/server-session';

export default async function Home() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (user.mustChangePassword) redirect('/change-password');
  redirect(ROLE_HOME[user.role]);
}
