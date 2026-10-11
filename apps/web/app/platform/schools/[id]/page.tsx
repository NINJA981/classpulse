'use client';
import { useParams } from 'next/navigation';
import { SchoolDetail } from '@/components/platform/school-detail';

export default function PlatformSchoolPage() {
  const { id } = useParams<{ id: string }>();
  return <SchoolDetail id={id} />;
}
