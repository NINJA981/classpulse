import type { Metadata } from 'next';
import { UserSearch } from '@/components/platform/user-search';

export const metadata: Metadata = { title: 'Users' };

export default function PlatformUsersPage() {
  return <UserSearch />;
}
