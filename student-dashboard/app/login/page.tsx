"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  School,
  Lock,
  GraduationCap,
  ArrowRight,
  RotateCw,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { diagnosticApi } from "@/lib/diagnosticApi";

export default function LoginPage() {
  const router = useRouter();

  const [registerNumber, setRegisterNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!registerNumber.trim()) {
      setError("Please enter your Register Number.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await diagnosticApi.login(registerNumber.trim(), password.trim());
      // Always show all options of sections upon login as requested:
      // "when i login show me all the options of sections and then i can click the section and then i see the dashboard"
      router.push("/join");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickDemoFill() {
    setRegisterNumber("2024-CS-042");
    setPassword("password123");
    setError("");
  }

  return (
    <div className="dashboard-page min-h-screen flex flex-col justify-between p-4 md:p-8">
      {/* Top Bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b-2 border-ink">
        <div className="cp-brand">
          <div className="cp-brand__icon" aria-hidden="true">
            <School />
          </div>
          <div className="min-w-0">
            <p className="cp-brand__name">
              Student <em>Dashboard</em>
            </p>
            <p className="cp-brand__tag">Academic Portal</p>
          </div>
        </div>

        <span className="ui-pill ui-pill-yellow">Student Authentication</span>
      </header>

      {/* Main Card */}
      <main className="max-w-md w-full mx-auto my-8 flex-1 flex flex-col justify-center">
        <div className="cp-card cp-card--yellow p-6 sm:p-10 relative">
          <div className="cp-tape-top" />

          <div className="mb-6">
            <span className="cp-sticker mb-2">Student Access</span>
            <h1 className="cp-h-hero mt-2">Log in to Portal</h1>
            <p className="cp-hero__sub mt-2">
              Sign in with your institutional register number and password to access your sections and coursework.
            </p>
          </div>

          {error && (
            <div className="p-4 mb-6 bg-pink-100 border-2 border-ink rounded-lg flex items-center gap-3 text-red-900">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-regnum"
                className="ui-label ui-label--upper mb-1.5"
              >
                <GraduationCap className="w-4 h-4" /> Register Number / Roll No.
              </label>
              <input
                id="login-regnum"
                type="text"
                value={registerNumber}
                onChange={(e) => {
                  setRegisterNumber(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="e.g. 2024-CS-042"
                className="ui-input font-mono font-bold"
                autoFocus
                required
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="ui-label ui-label--upper mb-1.5"
              >
                <Lock className="w-4 h-4" /> Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="••••••••"
                className="ui-input font-mono"
                required
              />
            </div>

            {/* Quick Demo Helper */}
            <div className="p-3 bg-white/80 border-2 border-ink rounded-lg flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-ink">
                <Sparkles className="w-4 h-4 text-yellow-600" />
                Demo Credentials:
              </span>
              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="cp-chip cp-chip--hot text-xs cursor-pointer font-bold"
              >
                Auto-fill Demo
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !registerNumber.trim() || !password.trim()}
                className="ui-button ui-button-primary ui-button-lg w-full justify-center"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Log in & Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-ink/20 text-center">
            <p className="cp-caption text-xs">
              Need assistance? Contact your institution&apos;s academic registrar.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center pt-6 border-t border-ink/20 text-xs font-mono text-faint">
        ClassPulse Student Portal • Student Authentication
      </footer>
    </div>
  );
}
