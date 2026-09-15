'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <header className="top-nav">
      <Link href="/lessons" className="nav-brand">
        <span className="brand-mark">CLASEPULSE</span>
        <span className="brand-sub">TEACHER TERMINAL</span>
      </Link>

      <nav className="nav-links">
        <Link
          href="/lessons"
          className={`nav-link ${pathname === '/lessons' ? 'active' : ''}`}
        >
          Lessons
        </Link>
        <Link
          href="/lessons/new"
          className={`nav-link ${pathname === '/lessons/new' ? 'active' : ''}`}
        >
          New Lesson
        </Link>
      </nav>
    </header>
  );
}
