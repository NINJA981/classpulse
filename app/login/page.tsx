"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  School,
  Lock,
  Smartphone,
  ArrowRight,
  RotateCw,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { diagnosticApi } from "@/lib/diagnosticApi";

/**
 * Two steps, because that is how the backend signs a student in: a mobile number gets a
 * one-time passcode, and the passcode is exchanged for a token. There is no password.
 */
type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** Outside production the server hands the passcode back so the flow is testable. */
  const [devOtp, setDevOtp] = useState("");

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Please enter your mobile number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await diagnosticApi.requestOtp(phone.trim());
      setDevOtp(res.demoOtp || "");
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send the passcode.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) {
      setError("Please enter the passcode we sent you.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await diagnosticApi.verifyOtp(otp.trim(), name.trim() || undefined);
      if (!res.success) {
        setError(res.message || "That passcode is wrong or has expired.");
        return;
      }
      router.push("/join");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not sign you in.");
    } finally {
      setLoading(false);
    }
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
            <h1 className="cp-h-hero mt-2">
              {step === "phone" ? "Log in to Portal" : "Enter your passcode"}
            </h1>
            <p className="cp-hero__sub mt-2">
              {step === "phone"
                ? "Enter your mobile number and we will send you a one-time passcode."
                : `We sent a 6-digit passcode to ${phone}. It expires in five minutes.`}
            </p>
          </div>

          {error && (
            <div className="p-4 mb-6 bg-pink-100 border-2 border-ink rounded-lg flex items-center gap-3 text-red-900">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {step === "phone" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label htmlFor="login-phone" className="ui-label ui-label--upper mb-1.5">
                  <Smartphone className="w-4 h-4" /> Mobile Number
                </label>
                <input
                  id="login-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError("");
                  }}
                  placeholder="+91 90000 00001"
                  className="ui-input font-mono font-bold"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label htmlFor="login-name" className="ui-label ui-label--upper mb-1.5">
                  Your Name <span className="normal-case font-normal">(first time only)</span>
                </label>
                <input
                  id="login-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="ui-input"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !phone.trim()}
                  className="ui-button ui-button-primary ui-button-lg w-full justify-center"
                >
                  {loading ? (
                    <>
                      <RotateCw className="w-5 h-5 animate-spin" />
                      Sending passcode...
                    </>
                  ) : (
                    <>
                      Send Passcode
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label htmlFor="login-otp" className="ui-label ui-label--upper mb-1.5">
                  <Lock className="w-4 h-4" /> 6-Digit Passcode
                </label>
                <input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  placeholder="000000"
                  className="ui-input font-mono font-bold tracking-[0.4em] text-center"
                  autoFocus
                  required
                />
              </div>

              {devOtp && (
                <div className="p-3 bg-white/80 border-2 border-ink rounded-lg flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-ink">
                    <Sparkles className="w-4 h-4 text-yellow-600" />
                    Dev passcode:
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtp(devOtp)}
                    className="cp-chip cp-chip--hot text-xs cursor-pointer font-bold font-mono"
                  >
                    {devOtp}
                  </button>
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading || otp.trim().length < 4}
                  className="ui-button ui-button-primary ui-button-lg w-full justify-center"
                >
                  {loading ? (
                    <>
                      <RotateCw className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Log in &amp; Continue
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError("");
                  }}
                  className="ui-button w-full justify-center text-sm"
                >
                  Use a different number
                </button>
              </div>
            </form>
          )}

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
