'use client';
import { Button } from '@/components/ui';

export function OfflineRetry() {
  return <Button onClick={() => window.location.reload()}>Try again</Button>;
}
