"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  QrCode,
  ArrowRight,
  School,
  User,
  GraduationCap,
  KeyRound,
  RotateCw,
  X,
  Camera,
  AlertCircle,
} from "lucide-react";
import {
  diagnosticApi,
  SectionPreview,
  ApiError,
  UserProfile,
} from "@/lib/diagnosticApi";

export default function JoinSectionPage() {
  const router = useRouter();

  // User state (defaults to current user so it opens section picker directly)
  const [user, setUser] = useState<UserProfile | null>(null);

  // Available sections
  const [availableSections, setAvailableSections] = useState<SectionPreview[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);

  // Manual code entry
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrollingCode, setEnrollingCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadSections() {
      try {
        const u = await diagnosticApi.getMe();
        if (!active) return;
        setUser(u);

        const list = await diagnosticApi.getAvailableSections();
        if (!active) return;
        setAvailableSections(list);
      } catch (err) {
        console.error("Failed to load sections", err);
      } finally {
        if (active) setSectionsLoading(false);
      }
    }

    loadSections();
    return () => {
      active = false;
    };
  }, []);

  // Quick enroll by clicking a section card -> immediately enrolls and navigates to dashboard!
  async function handleSelectSection(section: SectionPreview) {
    setEnrollingCode(section.code);
    setErrorMessage("");

    try {
      const roll = user?.registerNumber || "2024-CS-042";
      await diagnosticApi.joinEnrollment({
        code: section.code,
        rollNumber: roll,
      });

      // Navigate immediately to dashboard as requested:
      // "then i can click the section and then i see the dashboard"
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to join section.";
      setErrorMessage(msg);
      setEnrollingCode(null);
    }
  }

  // Handle manual code verification
  async function handleManualCodeSubmit(
    e?: React.FormEvent,
    overrideCode?: string
  ) {
    if (e) e.preventDefault();
    const clean = (overrideCode || manualCode).trim().toUpperCase();
    if (!clean) {
      setErrorMessage("Please enter a 6-character code.");
      return;
    }
    if (clean.length !== 6) {
      setErrorMessage("Section join codes are exactly 6 characters.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      // First preview the code
      const section = await diagnosticApi.getSectionPreview(clean);
      const roll = user?.registerNumber || "2024-CS-042";

      // Join and go straight to dashboard
      await diagnosticApi.joinEnrollment({
        code: section.code,
        rollNumber: roll,
      });

      router.push("/");
    } catch (err: unknown) {
      if (
        err instanceof ApiError &&
        (err.code === "CODE_EXPIRED" || err.status === 410)
      ) {
        setErrorMessage(
          "This code has expired, ask your teacher for a new one."
        );
      } else if (err instanceof Error) {
        setErrorMessage(
          err.message || "Invalid join code. Please check with your teacher."
        );
      } else {
        setErrorMessage("Invalid join code. Please check with your teacher.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-page min-h-screen flex flex-col justify-between p-3 md:p-5">
      {/* Top Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between pb-3 border-b-2 border-ink">
        <Link href="/" className="cp-brand">
          <div className="cp-brand__icon" aria-hidden="true">
            <School />
          </div>
          <div className="min-w-0">
            <p className="cp-brand__name">
              Student <em>Dashboard</em>
            </p>
            <p className="cp-brand__tag">Section Selection</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <span className="ui-pill ui-pill-yellow font-mono text-xs">
            <GraduationCap className="w-3.5 h-3.5" />
            {user?.registerNumber || "2024-CS-042"}
          </span>

          <Link
            href="/"
            className="ui-button ui-button-secondary ui-button-sm text-xs"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto my-3 flex-1 flex flex-col justify-start">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <span className="cp-sticker text-xs py-0.5 px-2">Available Classes</span>
            <h1 className="text-xl md:text-2xl font-extrabold text-ink tracking-tight">Choose your Class Section</h1>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 mb-3 bg-pink-100 border-2 border-ink rounded-lg flex items-start gap-2.5 text-ink">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-red-900">Notice</p>
              <p className="text-xs font-medium text-red-800 mt-0.5">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {/* Section Cards Grid (Click to Join & See Dashboard) */}
        <div className="mb-3">
          {sectionsLoading ? (
            <div className="p-8 text-center bg-white border-2 border-ink rounded-xl shadow-sm">
              <RotateCw className="w-5 h-5 animate-spin mx-auto text-faint mb-1.5" />
              <p className="cp-caption text-xs">Loading available sections...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {availableSections.map((section) => {
                const isEnrolling = enrollingCode === section.code;
                return (
                  <button
                    key={section.code}
                    type="button"
                    onClick={() => handleSelectSection(section)}
                    disabled={Boolean(enrollingCode) || loading}
                    className="hypercard p-3 sm:p-3.5 text-left border-2 border-ink rounded-lg transition-all hover:bg-yellow-50 bg-white flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="cp-chip cp-chip--hot font-mono font-bold text-xs py-0.5 px-2">
                          {section.code}
                        </span>
                        <span className="text-xs font-bold text-sky-800 group-hover:underline flex items-center gap-1">
                          Select Section <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-ink group-hover:text-indigo-900 transition-colors leading-snug">
                        {section.courseTitle}
                      </h3>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-muted gap-2">
                      <span className="truncate">
                        <strong className="text-ink">{section.teacherName}</strong>
                      </span>
                      <span className="truncate text-faint">
                        {section.institutionName}
                      </span>
                    </div>

                    {isEnrolling && (
                      <div className="mt-2 py-1 px-2.5 bg-yellow-300 border border-ink rounded text-xs font-bold flex items-center justify-center gap-1.5">
                        <RotateCw className="w-3 h-3 animate-spin" />
                        Enrolling...
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Manual Code / Scan QR Card */}
        <div className="cp-card cp-hero--white p-3 sm:p-3.5 relative border-2 border-ink shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="cp-sticker text-xs py-0.5 px-2">Custom Code</span>
              <h2 className="text-sm font-bold text-ink">
                Enter Custom Class Code
              </h2>
            </div>
            <KeyRound className="w-4 h-4 text-ink" />
          </div>

          <form
            onSubmit={handleManualCodeSubmit}
            className="flex flex-col sm:flex-row items-stretch gap-2"
          >
            <div className="flex-1">
              <input
                type="text"
                maxLength={6}
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value.toUpperCase());
                  setErrorMessage("");
                }}
                placeholder="e.g. MATH10 or EXP100"
                className="ui-input font-mono font-bold text-sm uppercase tracking-wider py-1.5 px-3 w-full"
              />
            </div>

            <button
              type="submit"
              disabled={loading || manualCode.trim().length < 6}
              className="ui-button ui-button-primary ui-button-sm text-xs justify-center sm:w-auto py-1.5"
            >
              {loading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Join Section
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="ui-button ui-button-secondary ui-button-sm text-xs justify-center sm:w-auto py-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              Scan QR
            </button>
          </form>

          {/* Quick Demo Test Chips */}
          <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-faint text-[11px]">Test edge codes:</span>
            <button
              type="button"
              onClick={() => {
                setManualCode("EXP100");
                handleManualCodeSubmit(undefined, "EXP100");
              }}
              className="cp-chip cp-chip--pink text-[11px] py-0.5 px-1.5 hover:opacity-80 cursor-pointer"
            >
              EXP100 (Expired)
            </button>
            <button
              type="button"
              onClick={() => {
                setManualCode("MATH10");
                handleManualCodeSubmit(undefined, "MATH10");
              }}
              className="cp-chip cp-chip--yellow text-[11px] py-0.5 px-1.5 hover:opacity-80 cursor-pointer"
            >
              MATH10 (Calculus)
            </button>
          </div>
        </div>
      </main>

      {/* QR Code Scanner Placeholder Modal */}
      {isQrModalOpen && (
        <div className="ui-modal-overlay">
          <div className="ui-modal max-w-md">
            <div className="cp-modal__head">
              <div>
                <p className="cp-sticker">Scan Class QR</p>
                <h3 className="cp-h-card-sm mt-1">Classroom QR Scanner</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="ui-button ui-button-icon"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-6 flex flex-col items-center justify-center text-center">
              <div className="w-56 h-56 border-2 border-dashed border-ink bg-slate-100 rounded-xl relative flex flex-col items-center justify-center p-4">
                <Camera className="w-12 h-12 text-muted mb-2 animate-pulse" />
                <p className="text-xs font-mono font-bold text-muted uppercase">
                  Align QR Code within camera frame
                </p>
                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500 shadow-sm animate-bounce" />
              </div>

              <p className="text-xs text-muted mt-4 max-w-xs">
                Camera access simulated. Click below to simulate scanning section <strong>MATH10</strong>.
              </p>
            </div>

            <div className="cp-modal__foot">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="ui-button ui-button-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsQrModalOpen(false);
                  setManualCode("MATH10");
                  handleManualCodeSubmit(undefined, "MATH10");
                }}
                className="ui-button ui-button-primary"
              >
                Simulate QR Scan (MATH10)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
