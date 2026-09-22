import type { Metadata } from 'next';
import './globals.css';
import TeacherShell from '../components/TeacherShell';

export const metadata: Metadata = {
  title: 'ClasePulse — Teacher Terminal',
  description: 'ClasePulse Teacher Curriculum Terminal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TeacherShell>{children}</TeacherShell>
      </body>
    </html>
  );
}
