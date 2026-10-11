import type { Metadata } from 'next';
import { SchoolsList } from '@/components/platform/schools-list';

export const metadata: Metadata = { title: 'Schools' };

export default function PlatformSchoolsPage() {
  return <SchoolsList />;
}
