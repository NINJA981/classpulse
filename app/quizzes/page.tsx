"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  HelpCircle,
  Timer,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardShell from "@/components/DashboardShell";
import {
  diagnosticApi,
  CourseQuiz,
  CourseContent,
} from "@/lib/diagnosticApi";
import {
  lessonQuizApi,
  LessonQuizSummary,
} from "@/lib/lessonQuizApi";

export default function QuizzesPage() {
  const [courseContent, setCourseContent] = useState<CourseContent>(() => {
    return diagnosticApi.getCourseContent();
  });
  const [quizzes, setQuizzes] = useState<CourseQuiz[]>(() => {
    return diagnosticApi.getCourseContent().quizzes;
  });
  const [lessonQuizzes, setLessonQuizzes] = useState<LessonQuizSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadQuizzes() {
      const content = diagnosticApi.getCourseContent();
      if (!active) return;
      setCourseContent(content);

      try {
        const { data, error } = await supabase
          .from("quizzes")
          .select("id, title, subject, created_by")
          .eq("subject", content.subject)
          .order("id", { ascending: true });

        if (!active) return;

        if (error || !data || data.length === 0) {
          setQuizzes(content.quizzes);
          setErrorMessage("");
        } else {
          setQuizzes(data);
          setErrorMessage("");
        }
      } catch {
        if (!active) return;
        setQuizzes(content.quizzes);
        setErrorMessage("");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadQuizzes();

    // Pipeline-generated lesson quizzes (published by teachers)
    lessonQuizApi
      .list()
      .then((res) => setLessonQuizzes(res.quizzes))
      .catch(() => setLessonQuizzes([])); // section hides when empty

    function onStorage() {
      const content = diagnosticApi.getCourseContent();
      setCourseContent(content);
      setQuizzes(content.quizzes);
    }
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const ready = !loading && !errorMessage;

  return (
    <DashboardShell footerNote="Live quiz workspace">

      {/* Hero (acts as the page header) */}
      <header className="cp-hero cp-hero--sky cp-tape-top">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <p className="cp-sticker">
              Live Assessments • {courseContent.code}
            </p>

            <h2 className="cp-h-hero">
              Quizzes
            </h2>

            <p className="cp-hero__sub">
              Live quizzes for <strong className="text-ink font-bold">{courseContent.courseTitle}</strong> with {courseContent.teacherName}.
            </p>
          </div>

          <div className="cp-hero__pills">
            {ready ? (
              <span className="ui-pill ui-pill-dark">
                <Zap aria-hidden="true" />
                {quizzes.length}{" "}
                {quizzes.length === 1
                  ? "Live Quiz"
                  : "Live Quizzes"}
              </span>
            ) : (
              <span className="cp-skeleton h-7 w-28" aria-hidden="true" />
            )}
          </div>
        </div>
      </header>

      {/* Summary (always mounted so the frame is stable while loading) */}
      <section className="cp-grid-3" aria-label="Summary">

          <div className="hypercard-static cp-stat">
            <div className="cp-stat__head">
              <p className="cp-sticker">Available</p>
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
              Quiz sessions
            </p>
          </div>

          <div className="hypercard-static cp-stat">
            <div className="cp-stat__head">
              <p className="cp-sticker">Question Time</p>
              <span className="cp-stat__icon cp-stat__icon--yellow" aria-hidden="true">
                <Timer />
              </span>
            </div>

            <p className="cp-stat__value">
              20s
            </p>
            <p className="cp-stat__caption">
              Per question
            </p>
          </div>

          <div className="hypercard-static cp-stat">
            <div className="cp-stat__head">
              <p className="cp-sticker">Scoring</p>
              <span className="cp-stat__icon cp-stat__icon--mint" aria-hidden="true">
                <TrendingUp />
              </span>
            </div>

            <p className="cp-stat__value">
              Fast
            </p>
            <p className="cp-stat__caption">
              Faster answers earn more
            </p>
          </div>

        </section>

      {/* Lecture quizzes (pipeline-generated, self-paced) */}
      {lessonQuizzes.length > 0 && (
        <section className="cp-section" aria-labelledby="lesson-quizzes-title">
          <div className="cp-section__head">
            <div className="cp-section__heading">
              <p className="zine-label">
                <BookOpen aria-hidden="true" />
                Lecture Quizzes
              </p>
              <h3 id="lesson-quizzes-title" className="cp-section__title">
                From recent lectures
              </h3>
            </div>
            <span className="ui-pill ui-pill-mint">Self-paced</span>
          </div>

          <div className="cp-section__list">
            {lessonQuizzes.map((lq) => (
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
                  <span className="ui-pill ui-pill-mint">Available</span>
                  <Link
                    href={`/quizzes/lesson/${lq.id}`}
                    className="ui-button ui-button-primary ui-button-sm"
                  >
                    Start Quiz
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quiz list */}
      <section className="cp-section" aria-labelledby="quizzes-title">

        <div className="cp-section__head">
          <div className="cp-section__heading">
            <p className="zine-label">
              <Zap aria-hidden="true" />
              Quiz Sessions
            </p>

            <h3 id="quizzes-title" className="cp-section__title">
              Available Quizzes
            </h3>
          </div>

          {ready ? (
            <span className="ui-pill ui-pill-sky">
              {quizzes.length}{" "}
              {quizzes.length === 1
                ? "quiz"
                : "quizzes"}
            </span>
          ) : (
            <span className="cp-skeleton h-7 w-20" aria-hidden="true" />
          )}
        </div>

        <div className="cp-section__list">

          {/* Loading */}
          {loading && (
            <div className="cp-state-wrap">
              <div className="cp-state">
                <span className="live-dot" aria-hidden="true" />

                <p className="cp-sticker">
                  Loading
                </p>

                <h3 className="cp-h-card">
                  Loading quizzes...
                </h3>
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && errorMessage && (
            <div className="cp-state-wrap">
              <div className="cp-state cp-state--error">
                <p className="cp-sticker">
                  Database Error
                </p>

                <h3 className="cp-h-card">
                  Could not load quizzes
                </h3>

                <p className="cp-state__msg">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Quiz rows */}
          {ready &&
            quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="cp-row cp-row--mint"
              >
                <div className="cp-row__main">
                  <div className="cp-row__tags">
                    <p className="zine-label">
                      <span className="live-dot" aria-hidden="true" />
                      Live Quiz
                    </p>

                    <span className="ui-pill ui-pill-yellow">
                      {quiz.subject}
                    </span>
                  </div>

                  <h3 className="cp-row__title">
                    {quiz.title}
                  </h3>

                  <p className="cp-row__meta">
                    <span className="cp-row__meta-item">
                      <HelpCircle aria-hidden="true" />
                      10 questions
                    </span>
                    <span className="cp-row__meta-item">
                      <Timer aria-hidden="true" />
                      20 seconds each
                    </span>
                    {quiz.created_by && (
                      <span className="cp-row__meta-item">
                        <User aria-hidden="true" />
                        Created by {quiz.created_by}
                      </span>
                    )}
                  </p>

                  <p className="cp-text mt-2">
                    Faster correct answers earn more points.
                  </p>
                </div>

                <div className="cp-row__side">
                  <span className="ui-pill ui-pill-mint">
                    Available
                  </span>

                  <Link
                    href={`/quizzes/${quiz.id}/lobby`}
                    className="ui-button ui-button-primary ui-button-sm"
                  >
                    Join Live Quiz
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}

          {/* Empty */}
          {ready && quizzes.length === 0 && (
            <div className="cp-empty">
              <p className="cp-sticker">
                No Sessions
              </p>

              <h3 className="cp-h-card mt-3">
                No quizzes available
              </h3>

              <p className="cp-empty__hand mt-2">
                Quizzes will appear here when faculty creates
                a live session.
              </p>
            </div>
          )}

        </div>
      </section>

    </DashboardShell>
  );
}
