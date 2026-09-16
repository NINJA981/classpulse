import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="app-container">
      <header className="top-nav">
        <Link to="/lessons" className="nav-brand">
          <span className="brand-mark">CLASEPULSE</span>
          <span className="brand-sub">TEACHER TERMINAL</span>
        </Link>

        <nav className="nav-links">
          <Link
            to="/lessons"
            className={`nav-link ${location.pathname === '/lessons' ? 'active' : ''}`}
          >
            Lessons
          </Link>
          <Link
            to="/lessons/new"
            className={`nav-link ${location.pathname === '/lessons/new' ? 'active' : ''}`}
          >
            New Lesson
          </Link>
        </nav>
      </header>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
