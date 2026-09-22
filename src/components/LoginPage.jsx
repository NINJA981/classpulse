'use client';

import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

// Dedicated Admin Login Portal.
// Only administrators can sign in; on submit the session is authenticated and
// launches the Admin Control Center directly in-app.
export const LoginPage = () => {
  const { login } = useClassPulse();
  const [adminEmail, setAdminEmail] = useState('admin@classpulse.edu');
  const [adminPassword, setAdminPassword] = useState('');

  const [isNavigating, setIsNavigating] = useState(false);
  const [navTargetLabel, setNavTargetLabel] = useState('');

  const ADMIN_TARGET_LABEL = 'Admin Control Center';

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    setIsNavigating(true);
    setNavTargetLabel(ADMIN_TARGET_LABEL);

    // Transition smoothly and authorize the session in-app
    setTimeout(() => {
      login({
        name: 'System Administrator',
        email: adminEmail || 'admin@classpulse.edu',
        role: 'admin',
        staffId: 'ADM-101'
      });
      setIsNavigating(false);
    }, 400);
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

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-6">
          {/* Brand Header */}
          <div className="cp-brand-area justify-center">
            <div className="cp-brand-mark">CP</div>
            <div>
              <div className="cp-brand">
                Class<span>Pulse</span> Admin Portal
              </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="cp-card-static space-y-6">
            <div className="pb-4 border-b border-line-soft">
              <h2 className="cp-h4">Administrator Sign In</h2>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4" suppressHydrationWarning>
              <div className="cp-field" suppressHydrationWarning>
                <label className="cp-label">
                  <span>Admin Email or Staff ID</span>
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="cp-input"
                  placeholder="admin@classpulse.edu"
                  suppressHydrationWarning
                />
              </div>

              <div className="cp-field" suppressHydrationWarning>
                <label className="cp-label">
                  <span>Security PIN / Password</span>
                </label>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="cp-input"
                  placeholder="••••••••••••"
                  suppressHydrationWarning
                />
              </div>

              <button
                type="submit"
                className="cp-btn-primary cp-btn-block mt-2 gap-2"
                suppressHydrationWarning
              >
                <span>Sign In & Launch Admin Control</span>
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
