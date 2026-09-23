"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Sparkles,
  XCircle,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import {
  lessonQuizApi,
  LessonQuizDetail,
  LessonQuizResult,
} from "@/lib/lessonQuizApi";

/**
 * Self-paced player for pipeline-generated lesson quizzes.
 * Answers are graded server-side on submit; explanations reveal afterwards.
 */
export default function LessonQuizPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = typeof params.id === "string" ? params.id : "";

  const [quiz, setQuiz] = useState<LessonQuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selectedOption?: number; text?: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LessonQuizResult | null>(null);
  const [useVernacular, setUseVernacular] = useState(false);

  useEffect(() => {
    if (!lessonId) return;
    lessonQuizApi
      .get(lessonId)
      .then(setQuiz)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const hasVernacular = Boolean(
    quiz?.questions.some((q) => Boolean(q.stemLocal)) || (quiz?.language && quiz?.language !== "en")
  );

  if (loading) {
    return (
      <DashboardShell>
        <div className="cp-state-wrap">
          <div className="cp-state">
            <span className="live-dot" aria-hidden="true" />
            <p className="cp-sticker">Loading</p>
            <h3 className="cp-h-card">Loading quiz…</h3>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !quiz) {
    return (
      <DashboardShell>
        <div className="cp-state-wrap">
          <div className="cp-state cp-state--error">
            <p className="cp-sticker">Not available</p>
            <h3 className="cp-h-card">{error || "Quiz not found"}</h3>
            <button className="ui-button ui-button-primary ui-button-sm mt-4" onClick={() => router.push("/quizzes")}>
              <ArrowLeft /> Back to quizzes
            </button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // ---------- Results view ----------
  if (result) {
    return (
      <DashboardShell footerNote="Lecture quiz results">
        <header className="cp-hero cp-hero--sky cp-tape-top">
          <div className="cp-hero__row">
            <div className="cp-hero__body">
              <p className="cp-sticker">Results • {quiz.subject}</p>
              <h2 className="cp-h-hero">{result.scorePct}%</h2>
              <p className="cp-hero__sub">
                {result.correct} of {result.total} correct on <strong>{quiz.title}</strong>
              </p>
            </div>
            {hasVernacular && (
              <div className="cp-hero__pills">
                <button
                  type="button"
                  onClick={() => setUseVernacular(!useVernacular)}
                  className={`ui-pill font-bold transition cursor-pointer ${
                    useVernacular ? "ui-pill-mint" : "ui-pill-dark"
                  }`}
                >
                  🌐 {useVernacular ? "Switch to English" : "Switch to Vernacular"}
                </button>
              </div>
            )}
          </div>
        </header>

        <section className="cp-section">
          <div className="cp-section__list">
            {quiz.questions.map((q) => {
              const r = result.results.find((x) => x.questionId === q.id);
              const given = answers[q.id];
              const stemDisplay = useVernacular && q.stemLocal ? q.stemLocal : q.stem;
              const explanationDisplay =
                useVernacular && r?.explanationLocal ? r.explanationLocal : r?.explanation;

              return (
                <div key={q.id} className="cp-row cp-row--mint">
                  <div className="cp-row__main">
                    <div className="cp-row__tags">
                      <p className="zine-label">
                        {r?.isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-mint">
                            <CheckCircle2 aria-hidden="true" /> Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500">
                            <XCircle aria-hidden="true" /> Incorrect
                          </span>
                        )}
                      </p>
                      {q.sourceCitation && (
                        <span className="ui-pill ui-pill-yellow">
                          <Clock aria-hidden="true" /> {q.sourceCitation}
                        </span>
                      )}
                    </div>
                    <h3 className="cp-row__title">{stemDisplay}</h3>
                    {useVernacular && q.stemLocal && (
                      <p className="text-xs text-ink/50 italic mt-0.5">Original: {q.stem}</p>
                    )}
                    <p className="cp-row__meta">
                      Your answer:{" "}
                      {q.type === "short"
                        ? given?.text || "—"
                        : given?.selectedOption !== undefined
                          ? (useVernacular && q.optionsLocal?.[given.selectedOption]) || q.options[given.selectedOption]
                          : "—"}
                    </p>
                    {!r?.isCorrect && (r?.correctIndex !== undefined || r?.correctText) && (
                      <p className="cp-row__meta">
                        Correct:{" "}
                        {r?.correctIndex !== undefined
                          ? (useVernacular && q.optionsLocal?.[r.correctIndex]) || q.options[r.correctIndex]
                          : r?.correctText}
                      </p>
                    )}
                    {explanationDisplay && <p className="cp-text mt-2">{explanationDisplay}</p>}

                    {/* Targeted Concept Refresher for Missed Questions */}
                    {!r?.isCorrect && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs">
                        <p className="font-bold text-red-800 flex items-center gap-1.5 mb-1">
                          <Sparkles size={14} /> Targeted Concept Refresher
                        </p>
                        <p className="text-ink/90 leading-relaxed">
                          {explanationDisplay || "Review the lecture discussion on this topic to reinforce your understanding."}
                        </p>
                        {q.sourceCitation && (
                          <p className="mt-2 text-ink/60 font-semibold text-[11px]">
                            📍 Grounded in lecture recording: {q.sourceCitation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {quiz.keyTakeaways.length > 0 && (
          <section className="cp-section">
            <div className="cp-section__head">
              <div className="cp-section__heading">
                <p className="zine-label">
                  <Sparkles aria-hidden="true" /> From this lecture
                </p>
                <h3 className="cp-section__title">Key takeaways</h3>
              </div>
            </div>
            <ul className="cp-text space-y-2">
              {quiz.keyTakeaways.map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 flex gap-3">
          <button className="ui-button ui-button-primary" onClick={() => router.push("/quizzes")}>
            <ArrowLeft /> Back to quizzes
          </button>
          <button
            className="ui-button ui-button-sm"
            onClick={() => {
              setResult(null);
              setAnswers({});
              setCurrent(0);
            }}
          >
            Retake
          </button>
        </div>
      </DashboardShell>
    );
  }

  // ---------- Player view ----------
  const q = quiz.questions[current];
  const answer = answers[q.id] || {};
  const isLast = current === quiz.questions.length - 1;

  const selectOption = (idx: number) =>
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], selectedOption: idx } }));
  const setShortText = (text: string) =>
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], text } }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = Object.entries(answers).map(([questionId, a]) => ({
        questionId,
        selectedOption: a.selectedOption,
        text: a.text
      }));
      const res = await lessonQuizApi.submit(lessonId, payload);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell footerNote={`Question ${current + 1} of ${quiz.questions.length}`}>
      <header className="cp-hero cp-hero--sky cp-tape-top">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <p className="cp-sticker">Lecture Quiz • {quiz.subject}</p>
            <h2 className="cp-h-hero">{quiz.title}</h2>
            <p className="cp-hero__sub">Answer at your own pace — explanations appear after you submit.</p>
          </div>
          {hasVernacular && (
            <div className="cp-hero__pills">
              <button
                type="button"
                onClick={() => setUseVernacular(!useVernacular)}
                className={`ui-pill font-bold transition cursor-pointer ${
                  useVernacular ? "ui-pill-mint" : "ui-pill-dark"
                }`}
              >
                🌐 {useVernacular ? "Switch to English" : "Switch to Vernacular"}
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="cp-section">
        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">
              Q{current + 1} • {q.type === "truefalse" ? "True / False" : q.type === "short" ? "Short answer" : "Multiple choice"}
            </p>
            <span className="ui-pill ui-pill-yellow">{q.difficulty}</span>
          </div>
          <h3 className="cp-h-card mt-3 text-balance">
            {useVernacular && q.stemLocal ? q.stemLocal : q.stem}
          </h3>
          {useVernacular && q.stemLocal && (
            <p className="text-xs text-ink/60 mt-1 italic">Original English: {q.stem}</p>
          )}

          {q.type === "short" ? (
            <textarea
              className="mt-4 w-full rounded-xl border border-ink/10 bg-white/70 p-4 text-sm outline-none focus:border-sky-400"
              rows={3}
              placeholder="Write your answer…"
              value={answer.text || ""}
              onChange={(e) => setShortText(e.target.value)}
            />
          ) : (
            <div className="mt-4 space-y-2">
              {q.options.map((opt, idx) => {
                const selected = answer.selectedOption === idx;
                const optText = (useVernacular && q.optionsLocal && q.optionsLocal[idx]) || opt;
                return (
                  <button
                    key={idx}
                    onClick={() => selectOption(idx)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm transition ${
                      selected
                        ? "border-sky-400 bg-sky-50 font-medium"
                        : "border-ink/10 bg-white/70 hover:border-ink/25"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                        selected ? "border-sky-400 bg-sky-400 text-white" : "border-ink/20"
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{optText}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between">
        <button
          className="ui-button ui-button-sm"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
        >
          <ArrowLeft /> Previous
        </button>

        {isLast ? (
          <button
            className="ui-button ui-button-primary"
            disabled={submitting || Object.keys(answers).length === 0}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Submitting…" : "Submit quiz"} <CheckCircle2 />
          </button>
        ) : (
          <button className="ui-button ui-button-primary" onClick={() => setCurrent((c) => c + 1)}>
            Next <ArrowRight />
          </button>
        )}
      </div>

      {/* Question dots */}
      <div className="mt-6 flex justify-center gap-1.5">
        {quiz.questions.map((qq, i) => (
          <button
            key={qq.id}
            aria-label={`Go to question ${i + 1}`}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all ${
              i === current ? "w-6 bg-sky-500" : answers[qq.id] ? "w-2 bg-mint" : "w-2 bg-ink/15"
            }`}
          />
        ))}
      </div>
    </DashboardShell>
  );
}
