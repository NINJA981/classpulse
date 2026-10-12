import Link from 'next/link';
import clsx from 'clsx';

/** Links to the public privacy notice and terms of use (app shells, console and legal pages). */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={clsx('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-muted', className)}>
      <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
        Privacy notice
      </Link>
      <Link href="/terms" className="underline-offset-4 hover:text-ink hover:underline">
        Terms of use
      </Link>
    </nav>
  );
}
