'use client';
import { ErrorState } from '@/components/ui';

export default function AreaError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState error={error} onRetry={reset} />;
}
