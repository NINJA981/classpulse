import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display text-3xl font-black">Page not found</h1>
      <p className="text-sm text-muted">The page you were looking for doesn’t exist or has moved.</p>
      <Link href="/" className="mt-2 text-sm font-bold underline underline-offset-4">
        Go to your home page
      </Link>
    </main>
  );
}
