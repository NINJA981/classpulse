import type { Metadata } from 'next';
import { PlatformLogin } from '@/components/platform/login';

export const metadata: Metadata = { title: 'Platform sign in' };

export default function PlatformLoginPage() {
  return <PlatformLogin />;
}
