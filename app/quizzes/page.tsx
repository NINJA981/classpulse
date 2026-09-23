"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  HelpCircle,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { request, isSignedIn, getToken } from "@/lib/apiClient";
import { diagnosticApi } from "@/lib/diagnosticApi";
import {
  lessonQuizApi,
  LessonQuizSummary,
  getDemoQuizSummaries,
} from "@/lib/lessonQuizApi";

interface Enrollment {
  id: string;
  courseTitle: string;
  sectionName: string;
  rollNumber?: string;
}

export default function QuizzesPage() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(() => {
    if (typeof window === "undefined") return null;
    const localEnr = diagnosticApi.getCurrentEnrollment();
    return localEnr
      ? {
          id: localEnr.enrollmentId,
          courseTitle: localEnr.courseTitle,
          sectionName: localEnr.sectionCode || "Section",
          rollNumber: localEnr.rollNumber,
        }
      : null;
  });

  const [quizzes, setQuizzes] = useState<LessonQuizSummary[]>(() => {
    return typeof window !== "undefined" ? getDemoQuizSummaries() : [];
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const localEnr = diagnosticApi.getCurrentEnrollment();
        let enr: Enrollment | null = localEnr
          ? {
              id: localEnr.enrollmentId,
              courseTitle: localEnr.courseTitle,
              sectionName: localEnr.sectionCode || "Section",
              rollNumber: localEnr.rollNumber,
            }
          : null;

        const token = getToken();
        if (token && !token.startsWith("demo_token_")) {
          try {
            const enrollments = await request<{ items: Enrollment[] }>("/student/enrollments");
            if (enrollments?.items?.[0]) enr = enrollments.items[0];
          } catch {
            // keep localEnr
          }
        }

        const quizList = await lessonQuizApi.list();
        if (!active) return;

        setEnrollment(enr);
        setQuizzes(quizList.quizzes);
        setErrorMessage("");
      } catch (err) {
        if (!active) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Could not load your quizzes."
        );
      }
    }

    void load();

    function refreshScores() {
      setQuizzes(getDemoQuizSummaries());
      const localEnr = diagnosticApi.getCurrentEnrollment();
      if (localEnr) {
        setEnrollment({
          id: localEnr.enrollmentId,
          courseTitle: localEnr.courseTitle,
          sectionName: localEnr.sectionCode || "Section",
          rollNumber: localEnr.rollNumber,
        });
      }
    }

    window.addEventListener("storage", refreshScores);
    return () => {
      active = false;
      window.removeEventListener("storage", refreshScores);
    };
  }, []);

  const ready = !loading && !errorMessage;
  const completed = quizzes.filter((q) => q.bestScorePct != null);
  const bestScore = completed.length
    ? Math.max(...completed.map((q) => q.bestScorePct ?? 0))
    : null;

  return (
    <DashboardShell footerNote="Live quiz workspace">

      {/* Hero (acts as the page header) */}
      <header className="cp-hero cp-hero--sky">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <h2 className="cp-h-hero">
              Quizzes
            </h2>

            <p className="cp-hero__sub">
              {enrollment ? (
                <>
                  Quizzes published for{" "}
                  <strong className="text-ink font-bold">{enrollment.courseTitle}</strong>{" "}
                  — {enrollment.sectionName}.
                </>
              ) : (
                <>Quizzes your teachers publish appear here the moment they go live.</>
              )}
            </p>
          </div>

          <div className="cp-hero__pills">
            {ready ? (
              <span className="ui-pill ui-pill-dark">
                <Zap aria-hidden="true" />
                {quizzes.length}{" "}
                {quizzes.length === 1 ? "Quiz" : "Quizzes"}
              </span>
            ) : (
              <span className="cp-skeleton h-7 w-28" aria-hidden="true" />
            )}
          </div>
        </div>
      </header>

      {/* Live PIN Join Banner */}
      <section className="mt-4 mb-2">
        <div className="hypercard-static p-4 sm:p-6 bg-gradient-to-r from-sky-50 via-white to-emerald-50 border-2 border-ink">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500 text-white font-black text-xl shadow">
                ⚡
              </div>
              <div>
                <span className="cp-sticker">Kahoot / Quizizz In-Class Mode</span>
                <h3 className="cp-h-card text-lg sm:text-xl font-black mt-0.5">
                  Have a 6-digit Game PIN?
                </h3>
                <p className="text-xs text-ink/70">
                  Join your teacher's real-time in-class arena and compete on the podium!
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const pinInput = (form.elements.namedItem("pin") as HTMLInputElement)?.value;
                if (pinInput && pinInput.trim()) {
                  window.location.href = `/quizzes/live?pin=${pinInput.trim()}`;
                }
              }}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <input
                name="pin"
                type="text"
                maxLength={6}
                placeholder="PIN"
                className="w-36 rounded-xl border-2 border-ink/20 bg-white px-3 py-2 text-center font-mono font-black tracking-widest text-lg outline-none focus:border-sky-500"
                required
              />
              <button
                type="submit"
                className="ui-button ui-button-primary ui-button-sm whitespace-nowrap px-4 py-2 font-black cursor-pointer"
              >
                Join Live →
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Summary (always mounted so the frame is stable while loading) */}
      <section className="cp-grid-3" aria-label="Summary">

          <div className="hypercard-static cp-stat">
            <div className="cp-stat__head">
              <span className="font-bold text-sm text-ink">Available</span>
              <span className="cp-stat__icon cp-stat__icon--sky" aria-hidden="true">
                <Zap />
              </span>
            </div>

            {ready ? (
              <p className="cp-stat__value">
                {quizzes.length}
              </p>
            ) : (
              <span className="cp-skeleton block h-11 w-16" aria-hidden="true" />
            )}
            <p className="cp-stat__caption">
              Published for your section
            </p>
          </div>

          <div className="hypercard-static cp-stat">
            <div className="cp-stat__head">
              <span className="font-bold text-sm text-ink">Attempted</span>
              <span className="cp-stat__icon cp-stat__icon--yellow" aria-hidden="true">
                <HelpCircle />
              </span>
            </div>

            {ready ? (
              <p className="cp-stat__value">
                {completed.length}
              </p>
            ) : (
              <span className="cp-skeleton block h-11 w-16" aria-hidden="true" />
            )}
            <p className="cp-stat__caption">
              Quizzes you have taken
            </p>
          </div>

          <div className="hypercard-static cp-stat">
            <div className="cp-stat__head">
              <span className="font-bold text-sm text-ink">Best Score</span>
              <span className="cp-stat__icon cp-stat__icon--mint" aria-hidden="true">
                <TrendingUp />
              </span>
            </div>

            {ready ? (
              <p className="cp-stat__value">
                {bestScore != null ? `${bestScore}%` : "—"}
              </p>
            ) : (
              <span className="cp-skeleton block h-11 w-16" aria-hidden="true" />
            )}
            <p className="cp-stat__caption">
              Across attempted quizzes
            </p>
          </div>

        </section>

      {/* Quiz list — everything a teacher has published for this student's section */}
      <section className="cp-section" aria-labelledby="lesson-quizzes-title">
        <div className="cp-section__head">
          <div className="cp-section__heading">
            <p className="zine-label">
              <BookOpen aria-hidden="true" />
              Lecture Quizzes
            </p>
            <h3 id="lesson-quizzes-title" className="cp-section__title">
              From your lectures
            </h3>
          </div>
          <span className="ui-pill ui-pill-mint">Self-paced</span>
        </div>

        <div className="cp-section__list">

          {/* Loading */}
          {loading && quizzes.length === 0 && (
            <div className="cp-state-wrap">
              <div className="cp-state">
                <span className="live-dot" aria-hidden="true" />
                <p className="cp-sticker">Loading</p>
                <h3 className="cp-h-card">Loading quizzes...</h3>
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && errorMessage && quizzes.length === 0 && (
            <div className="cp-state-wrap">
              <div className="cp-state cp-state--error">
                <p className="cp-sticker">Connection Error</p>
                <h3 className="cp-h-card">Could not load quizzes</h3>
                <p className="cp-state__msg">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Quiz rows */}
          {ready &&
            quizzes.map((lq) => (
              <div key={lq.id} className="cp-row cp-row--mint">
                <div className="cp-row__main">
                  <div className="cp-row__tags">
                    <p className="zine-label">
                      <BookOpen aria-hidden="true" />
                      Lecture Quiz
                    </p>
                    <span className="ui-pill ui-pill-yellow">{lq.subject}</span>
                  </div>
                  <h3 className="cp-row__title">{lq.title}</h3>
                  <p className="cp-row__meta">
                    <span className="cp-row__meta-item">
                      <HelpCircle aria-hidden="true" />
                      {lq.questionCount} questions
                    </span>
                    <span className="cp-row__meta-item">
                      <User aria-hidden="true" />
                      {lq.className}
                    </span>
                  </p>
                  {lq.summary && <p className="cp-text mt-2 line-clamp-2 opacity-70">{lq.summary}</p>}
                </div>
                <div className="cp-row__side">
                  {lq.bestScorePct != null ? (
                    <span className="ui-pill ui-pill-yellow">Best {lq.bestScorePct}%</span>
                  ) : (
                    <span className="ui-pill ui-pill-mint">New</span>
                  )}
                  <Link
                    href={`/quizzes/lesson/${lq.id}`}
                    className="ui-button ui-button-primary ui-button-sm"
                  >
                    {lq.bestScorePct != null ? "Retake Quiz" : "Start Quiz"}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}

          {/* Empty */}
          {ready && quizzes.length === 0 && (
            <div className="cp-empty">
              <p className="cp-sticker">Nothing Yet</p>
              <h3 className="cp-h-card mt-3">No quizzes published</h3>
              <p className="cp-empty__hand mt-2">
                When your teacher publishes a quiz from a lecture, it lands here automatically.
              </p>
            </div>
          )}

        </div>
      </section>

    </DashboardShell>
  );
}
