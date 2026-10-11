import type { Metadata } from 'next';
import { PlatformSettingsView } from '@/components/platform/settings';

export const metadata: Metadata = { title: 'Settings' };

export default function PlatformSettingsPage() {
  return <PlatformSettingsView />;
}
