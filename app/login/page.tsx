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
      setError("Please enter your Register or Roll Number.");
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
      router.push("/join");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickDemoFill() {
    setRegisterNumber("12A-01");
    setPassword("student123");
    setError("");
  }

  return (
    <div className="dashboard-page min-h-screen flex flex-col justify-between p-4 md:p-6">
      {/* Top Bar */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between pb-4 border-b-2 border-ink">
        <div className="cp-brand">
          <div className="cp-brand__icon font-mono font-black text-sm" aria-hidden="true">
            CP
          </div>
          <div className="min-w-0">
            <p className="cp-brand__name">
              Clase<em>Pulse</em>
            </p>
            <p className="cp-brand__tag">Student Portal</p>
          </div>
        </div>

        <span className="ui-pill ui-pill-yellow text-xs">Student Portal</span>
      </header>

      {/* Main Card */}
      <main className="max-w-md w-full mx-auto my-4 flex-1 flex flex-col justify-center">
        <div className="cp-card cp-card--yellow p-6 sm:p-8 relative border-2 border-ink shadow-sm">
          <div className="mb-5">
            <h1 className="cp-h-hero">Login Portal</h1>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-pink-100 border-2 border-ink rounded-lg flex items-center gap-2.5 text-red-900 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <p className="font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label
                htmlFor="login-regnum"
                className="ui-label ui-label--upper mb-1 text-xs"
              >
                <GraduationCap className="w-3.5 h-3.5" /> Register / Roll Number
              </label>
              <input
                id="login-regnum"
                type="text"
                value={registerNumber}
                onChange={(e) => {
                  setRegisterNumber(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="e.g. 12A-01"
                className="ui-input font-mono font-bold text-sm py-2"
                autoFocus
                required
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="ui-label ui-label--upper mb-1 text-xs"
              >
                <Lock className="w-3.5 h-3.5" /> Password
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
                className="ui-input font-mono text-sm py-2"
                required
              />
            </div>

            {/* Quick Demo Credentials Helper */}
            <div className="p-2.5 bg-white/90 border-2 border-ink rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-600" />
                <span className="font-bold text-ink">Demo:</span>
                <span className="font-mono text-muted text-[11px]">12A-01</span>
              </div>
              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="cp-chip cp-chip--hot text-[11px] py-0.5 px-2 cursor-pointer font-bold hover:opacity-90"
              >
                Auto-fill Demo
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !registerNumber.trim() || !password.trim()}
                className="ui-button ui-button-primary ui-button-sm text-xs w-full justify-center py-2.5 font-bold"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Log in & Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
