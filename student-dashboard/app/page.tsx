"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  GraduationCap,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  Zap,
  Compass,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import {
  diagnosticApi,
  JoinEnrollmentResponse,
  CourseContent,
} from "@/lib/diagnosticApi";

export default function Home() {
  const [enrollment, setEnrollment] =
    useState<JoinEnrollmentResponse | null>(() => {
      if (typeof window !== "undefined") {
        return diagnosticApi.getCurrentEnrollment();
      }
      return null;
    });

  const [courseContent, setCourseContent] = useState<CourseContent>(() => {
    return diagnosticApi.getCourseContent();
  });

  const [diagnosticState, setDiagnosticState] = useState(() => {
    if (typeof window !== "undefined") {
      return diagnosticApi.getDiagnosticState();
    }
    return { completed: false, skipped: false, summaryText: "" };
  });

  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    function refreshData() {
      const enr = diagnosticApi.getCurrentEnrollment();
      setEnrollment(enr);
      setDiagnosticState(diagnosticApi.getDiagnosticState());
      setCourseContent(diagnosticApi.getCourseContent());
    }

    refreshData();
    window.addEventListener("storage", refreshData);
    return () => window.removeEventListener("storage", refreshData);
  }, []);

  function handleSkipDiagnostic() {
    diagnosticApi.skipDiagnostic();
    setDiagnosticState((prev) => ({ ...prev, skipped: true }));
    setBannerDismissed(true);
  }

  const showProminentBanner =
    !diagnosticState.completed && !diagnosticState.skipped && !bannerDismissed;
  const showGentleReminder =
    !diagnosticState.completed && (diagnosticState.skipped || bannerDismissed);

  return (
    <DashboardShell footerNote="Minimal academic workspace">
      {/* ========================================================= */}
      {/* 3. BASELINE DIAGNOSTIC BANNER                             */}
      {/* Triggered on first dashboard visit after joining.         */}
      {/* "Skip for now" allowed once, then gentle reminder.        */}
      {/* Never blocks navigation.                                  */}
      {/* ========================================================= */}

      {showProminentBanner && (
        <section
          className="cp-card cp-card--yellow p-5 sm:p-6 relative border-2 border-ink shadow-zine animate-portal-enter"
          aria-label="Baseline Diagnostic Announcement"
        >
          <div className="cp-tape-corner" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="cp-sticker">Phase A Diagnostic</span>
                <span className="ui-pill ui-pill-sky text-xs">
                  Zero Grade Impact
                </span>
              </div>

              <h2 className="cp-h-card-sm text-xl font-extrabold text-ink">
                Take your Baseline Diagnostic
              </h2>

              <p className="cp-hero__sub text-sm">
                4 quick questions to calibrate your upcoming practice and
                recommended problem sets. No score or percentage is recorded.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:self-center shrink-0">
              <button
                type="button"
                onClick={handleSkipDiagnostic}
                className="ui-button ui-button-secondary ui-button-sm text-xs"
                title="Skip for now (allowed once)"
              >
                Skip for now
              </button>

              <Link
                href="/diagnostic"
                className="ui-button ui-button-primary ui-button-sm text-xs"
              >
                <Compass className="w-4 h-4" />
                Start Diagnostic
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Gentle Reminder (shown when skipped, never blocks navigation) */}
      {showGentleReminder && (
        <div className="p-3.5 bg-sky-50 border-2 border-ink rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <p className="text-xs font-bold text-ink">
              <strong className="font-mono uppercase text-sky-800 mr-1.5">
                Diagnostic Pending:
              </strong>
              Calibrate your syllabus when you&apos;re ready. Never expires.
            </p>
          </div>

          <Link
            href="/diagnostic"
            className="text-xs font-bold underline flex items-center gap-1 text-ink hover:text-indigo-900"
          >
            Start Diagnostic <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Completed Diagnostic Badge */}
      {diagnosticState.completed && diagnosticState.summaryText && (
        <div className="p-3.5 bg-emerald-50 border-2 border-ink rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs text-ink font-medium">
              <strong className="font-bold text-emerald-900 mr-1">
                Baseline Calibrated:
              </strong>
              &ldquo;{diagnosticState.summaryText}&rdquo;
            </p>
          </div>

          <Link
            href="/diagnostic"
            className="text-xs font-bold underline text-ink"
          >
            Review summary
          </Link>
        </div>
      )}

      {/* Hero (acts as the page header) */}
      <header className="cp-hero cp-hero--mint cp-tape-top">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <p className="cp-sticker">Overview • {courseContent.code}</p>

            <h1 className="cp-h-hero">Welcome back</h1>

            <p className="cp-hero__sub">
              Enrolled in{" "}
              <strong className="text-ink font-bold">
                {courseContent.courseTitle}
              </strong>{" "}
              with {courseContent.teacherName}.
            </p>
          </div>

          <div className="cp-hero__pills">
            <Link
              href="/join"
              className="ui-button ui-button-secondary ui-button-sm text-xs"
              title="Select section"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Select Section
            </Link>

            <Link
              href="/profile"
              className="ui-pill ui-pill-yellow hover:opacity-90 transition-opacity"
              title="View student profile"
            >
              <GraduationCap aria-hidden="true" />
              {enrollment ? enrollment.rollNumber : "Student"}
            </Link>
          </div>
        </div>
      </header>

      {/* Summary — Live metrics for the currently selected subject */}
      <section className="cp-grid-3" aria-label="Summary">
        <Link href="/assignments" className="hypercard cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Assignments</p>
            <span
              className="cp-stat__icon cp-stat__icon--pink"
              aria-hidden="true"
            >
              <ClipboardList />
            </span>
          </div>

          <p className="cp-stat__value">{courseContent.stats.assignmentsTotal}</p>
          <p className="cp-stat__caption">{courseContent.stats.assignmentsPending} pending</p>

          <div className="cp-stat__foot">
            <span className="cp-link">
              View
              <ArrowRight aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link href="/tests" className="hypercard cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Tests</p>
            <span
              className="cp-stat__icon cp-stat__icon--yellow"
              aria-hidden="true"
            >
              <FileCheck2 />
            </span>
          </div>

          <p className="cp-stat__value">{courseContent.stats.testsTotal}</p>
          <p className="cp-stat__caption">{courseContent.stats.testsUpcoming} upcoming</p>

          <div className="cp-stat__foot">
            <span className="cp-link">
              View
              <ArrowRight aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link href="/quizzes" className="hypercard cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Quizzes</p>
            <span
              className="cp-stat__icon cp-stat__icon--sky"
              aria-hidden="true"
            >
              <Zap />
            </span>
          </div>

          <p className="cp-stat__value">{courseContent.stats.quizzesTotal}</p>
          <p className="cp-stat__caption">{courseContent.stats.quizzesDueSoon} due soon</p>

          <div className="cp-stat__foot">
            <span className="cp-link">
              View
              <ArrowRight aria-hidden="true" />
            </span>
          </div>
        </Link>
      </section>

      {/* Upcoming — Strictly filtered to the selected subject */}
      <section className="cp-section" aria-labelledby="upcoming-title">
        <div className="cp-section__head">
          <div className="cp-section__heading">
            <p className="zine-label">
              <CalendarDays aria-hidden="true" />
              Schedule • {courseContent.subject}
            </p>

            <h2 id="upcoming-title" className="cp-section__title">
              Upcoming in {courseContent.code}
            </h2>
          </div>

          <span className="ui-pill ui-pill-sky">
            {courseContent.upcoming.length} items
          </span>
        </div>

        <div className="cp-section__list">
          {courseContent.upcoming.map((item) => {
            const rowClass =
              item.rowVariant === "yellow"
                ? "cp-row cp-row--yellow"
                : item.rowVariant === "mint"
                ? "cp-row cp-row--mint"
                : "cp-row cp-row--white";

            const pillClass =
              item.statusPillVariant === "yellow"
                ? "ui-pill ui-pill-yellow"
                : item.statusPillVariant === "dark"
                ? "ui-pill ui-pill-dark"
                : "ui-pill ui-pill-sky";

            const btnClass =
              item.type === "Live Quiz"
                ? "ui-button ui-button-primary ui-button-sm"
                : "ui-button ui-button-secondary ui-button-sm";

            return (
              <div key={item.id} className={rowClass}>
                <div className="cp-row__main">
                  <div className="cp-row__tags">
                    <p className="cp-sticker">
                      {item.type === "Live Quiz" && (
                        <span className="live-dot" aria-hidden="true" />
                      )}
                      {item.type}
                    </p>
                    <span className="text-xs font-mono font-bold text-muted ml-1">
                      {courseContent.subject}
                    </span>
                  </div>

                  <h3 className="cp-row__title">{item.title}</h3>

                  <p className="cp-row__meta">
                    <span className="cp-row__meta-item">
                      <CalendarDays aria-hidden="true" />
                      {item.date}
                    </span>
                  </p>
                </div>

                <div className="cp-row__side">
                  <span className={pillClass}>{item.statusPill}</span>

                  <Link href={item.actionHref} className={btnClass}>
                    {item.actionLabel}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </DashboardShell>
  );
}
