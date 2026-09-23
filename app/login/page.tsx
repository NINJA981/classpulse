'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginTeacher } from '../../lib/auth';
import { LogIn, Shield, Sparkles, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your institutional email or faculty ID.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    try {
      setIsLoading(true);
      await loginTeacher(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // The account `npm run seed` creates in SIH-backend. Override with SEED_EMAIL/SEED_PASSWORD.
  const handleAutofillDemo = () => {
    setEmail('demo@clasepulse.test');
    setPassword('demo-password-123');
    setErrorMessage('');
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem'
      }}
    >
      <div style={{ maxWidth: '460px', width: '100%' }}>
        {/* Terminal Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="eyebrow" style={{ letterSpacing: '0.2em' }}>
            CLASEPULSE / FACULTY WORKSPACE
          </span>
          <h1 style={{ fontSize: '2rem', marginTop: '4px' }}>Teacher Terminal</h1>
          <p className="text-secondary" style={{ marginTop: '6px', fontSize: '13px' }}>
            Secure curriculum management, live classroom interaction & transcription console.
          </p>
        </div>

        {/* Login Card */}
        <div className="card card-solid" style={{ padding: '2.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              borderBottom: '1px solid var(--hairline)',
              paddingBottom: '1rem'
            }}
          >
            <div>
              <span className="eyebrow">AUTHENTICATION GATEWAY</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Faculty Sign In</h2>
            </div>
            <div
              style={{
                width: '38px',
                height: '38px',
                background: 'var(--ink)',
                color: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Shield size={20} />
            </div>
          </div>

          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '1.25rem',
                border: '2px solid #111',
                background: '#faf4f4',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              <span className="eyebrow" style={{ color: '#111', marginBottom: '2px' }}>
                ACCESS DENIED
              </span>
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="faculty-email">
                Institutional Email or Faculty ID
              </label>
              <input
                id="faculty-email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. priya.sharma@apex.edu"
                disabled={isLoading}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}
              >
                <label className="form-label" htmlFor="faculty-password" style={{ margin: 0 }}>
                  Security Passphrase
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ink-secondary)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '2px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="faculty-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter faculty password"
                disabled={isLoading}
                autoComplete="current-password"
                required
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.75rem',
                fontSize: '12px'
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked />
                <span>Keep session active</span>
              </label>
              <span className="text-secondary" style={{ fontSize: '11px' }}>
                Apex ID SSO Ready
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={isLoading}
            >
              <LogIn size={16} />
              {isLoading ? 'Verifying Faculty Credentials…' : 'Authenticate & Enter Dashboard'}
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--hairline)',
              textAlign: 'center'
            }}
          >
            <button
              type="button"
              onClick={handleAutofillDemo}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%' }}
            >
              <Sparkles size={13} />
              Autofill Seeded Account
            </button>
            <p className="text-secondary" style={{ fontSize: '11px', marginTop: '8px' }}>
              Test account pre-linked to Department of Natural Sciences
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p className="text-secondary text-mono" style={{ fontSize: '11px' }}>
            CLASEPULSE TERMINAL v2.4 • INSTITUTIONAL SESSION ENCRYPTED
          </p>
        </div>
      </div>
    </div>
  );
}
