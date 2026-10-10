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
import { getDemoQuizSummaries, lessonQuizApi } from "@/lib/lessonQuizApi";

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

  // Published quizzes for this student's section
  const [publishedQuizCount, setPublishedQuizCount] = useState<number>(0);

  useEffect(() => {
    function refreshData() {
      const enr = diagnosticApi.getCurrentEnrollment();
      setEnrollment(enr);
      setDiagnosticState(diagnosticApi.getDiagnosticState());
      setCourseContent(diagnosticApi.getCourseContent());
    }

    refreshData();

    // Fetch fresh live data from backend
    Promise.all([
      diagnosticApi.fetchCourseContent(),
      lessonQuizApi.list(),
    ])
      .then(([content, qList]) => {
        setCourseContent(content);
        setPublishedQuizCount(qList.quizzes.length);
        setEnrollment(diagnosticApi.getCurrentEnrollment());
      })
      .catch((e) => console.error("Error loading live dashboard data", e));

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

      {/* Hero (acts as the page header) */}
      <header className="cp-hero cp-hero--yellow">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
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
            <span className="font-bold text-sm text-ink">Assignments</span>
            <span
              className="cp-stat__icon cp-stat__icon--pink"
              aria-hidden="true"
            >
              <ClipboardList />
            </span>
          </div>

          <p className="cp-stat__value">{courseContent.stats.assignmentsTotal}</p>
          <p className="cp-stat__caption">{courseContent.stats.assignmentsPending} pending</p>
        </Link>

        <Link href="/tests" className="hypercard cp-stat">
          <div className="cp-stat__head">
            <span className="font-bold text-sm text-ink">Tests</span>
            <span
              className="cp-stat__icon cp-stat__icon--yellow"
              aria-hidden="true"
            >
              <FileCheck2 />
            </span>
          </div>

          <p className="cp-stat__value">{courseContent.stats.testsTotal}</p>
          <p className="cp-stat__caption">{courseContent.stats.testsUpcoming} upcoming</p>
        </Link>

        <Link href="/quizzes" className="hypercard cp-stat">
          <div className="cp-stat__head">
            <span className="font-bold text-sm text-ink">Quizzes</span>
            <span
              className="cp-stat__icon cp-stat__icon--sky"
              aria-hidden="true"
            >
              <Zap />
            </span>
          </div>

          <p className="cp-stat__value">{publishedQuizCount}</p>
          <p className="cp-stat__caption">published for your section</p>
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
          {courseContent.upcoming.length === 0 ? (
            <div className="p-8 text-center bg-white border-2 border-ink rounded-xl shadow-sm">
              <p className="font-bold text-ink text-base">No pending coursework</p>
              <p className="text-xs text-muted mt-1">All current class assignments and quizzes are up to date.</p>
            </div>
          ) : (
            courseContent.upcoming.map((item) => {
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
          })
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
