'use client';

import React, { useState } from 'react';

// Dedicated Admin Login Portal (Port 5171).
// Only administrators can sign in; on submit the browser is redirected to the
// Admin Control Center service on port 5173.
export const LoginPage = () => {
  const [adminEmail, setAdminEmail] = useState('admin@classpulse.edu');
  const [adminPassword, setAdminPassword] = useState('');

  const [isNavigating, setIsNavigating] = useState(false);
  const [navTargetLabel, setNavTargetLabel] = useState('');

  const ADMIN_PORT = '5173';
  const ADMIN_TARGET_LABEL = '🔐 Admin Control Center (Port 5173)';

  const redirectToAdminPortal = () => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    setIsNavigating(true);
    setNavTargetLabel(ADMIN_TARGET_LABEL);

    window.location.replace(`http://${host}:${ADMIN_PORT}/`);
  };

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    redirectToAdminPortal();
  };

  return (
    <div className="cp-page select-none">
      {/* Smooth Navigation Overlay */}
      {isNavigating && (
        <div className="cp-overlay">
          <div className="cp-card w-full max-w-sm text-center space-y-5">
            <div className="cp-icon-box is-xl is-ink mx-auto" aria-hidden="true">✓</div>
            <div className="space-y-2">
              <span className="cp-eyebrow is-tight">
                AUTHORIZING SESSION...
              </span>
              <p className="text-lead font-bold text-ink">
                {navTargetLabel}
              </p>
            </div>
            <div className="cp-progress">
              <span className="cp-progress-fill" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-8">
          {/* Brand Header */}
          <div className="cp-brand-area justify-center">
            <div className="cp-brand-mark">CP</div>
            <div>
              <div className="cp-brand">
                Class<span>Pulse</span> Admin Portal
              </div>
              <div className="cp-brand-subtitle uppercase">
                ClassPulse Executive Gateway • Port 5171
              </div>
            </div>
          </div>
          <p className="cp-lead text-center">
            Authorized Administrator Authentication & Control Gateway
          </p>

          {/* Login Card */}
          <div className="cp-card-static space-y-6">
            <div className="flex items-center justify-between gap-4 pb-5 border-b border-line-soft">
              <div className="flex items-center gap-3">
                <div className="cp-icon-box is-lg">
                  🔐
                </div>
                <div>
                  <span className="cp-eyebrow is-tight">Administrator</span>
                  <h2 className="cp-h4">Administrator Sign In</h2>
                  <p className="cp-caption">Port 5171 Control Authentication</p>
                </div>
              </div>
              <span className="cp-badge is-ink">
                System Active
              </span>
            </div>

            {/* Info Notice Box */}
            <div className="cp-card-sunken p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-caption font-bold text-ink">
                <span aria-hidden="true">→</span>
                <span>Redirects to Admin Control Center (Port 5173)</span>
              </div>
              <p className="cp-caption leading-relaxed">
                Access RBAC access controls, classroom streams, faculty assignments, and analytics.
              </p>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="cp-field">
                <label className="cp-label">
                  <span>Admin Email or Staff ID</span>
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="cp-input"
                  placeholder="admin@classpulse.edu"
                />
              </div>

              <div className="cp-field">
                <label className="cp-label">
                  <span>Security PIN / Password</span>
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="cp-input"
                  placeholder="••••••••••••"
                />
              </div>

              <button
                type="submit"
                className="cp-btn-primary cp-btn-block mt-2 gap-2"
              >
                <span>Sign In & Launch Admin Control</span>
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </div>

          <div className="text-center cp-caption-2 uppercase tracking-label">
            <p>© ClassPulse Executive Education System</p>
          </div>
        </div>
      </main>
    </div>
  );
};
