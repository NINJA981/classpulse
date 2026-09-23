"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  School,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Check,
  X,
  RotateCw,
  Compass,
} from "lucide-react";
import {
  diagnosticApi,
  DiagnosticQuestion,
} from "@/lib/diagnosticApi";

const CONFIDENCE_LEVELS = [
  {
    id: "guessing",
    label: "Just guessing",
    description: "Uncertain or hunch",
    badge: "Low",
    color: "bg-slate-100 border-slate-300 text-slate-700",
    activeColor: "bg-slate-200 border-ink shadow-sm",
  },
  {
    id: "somewhat",
    label: "Somewhat confident",
    description: "Good idea, not 100%",
    badge: "Medium",
    color: "bg-sky-50 border-sky-300 text-sky-900",
    activeColor: "bg-sky-200 border-ink shadow-sm",
  },
  {
    id: "sure",
    label: "100% sure",
    description: "Confident in working",
    badge: "High",
    color: "bg-yellow-50 border-yellow-300 text-yellow-950",
    activeColor: "bg-yellow-300 border-ink shadow-zine-sm",
  },
];

export default function DiagnosticPage() {
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<DiagnosticQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<string>("somewhat");
  const [submitting, setSubmitting] = useState(false);

  // Completion State
  const [isCompleted, setIsCompleted] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const q = await diagnosticApi.getCourseDiagnostic("MATH10");
        if (!active) return;
        if (!q) {
          const res = await diagnosticApi.completeDiagnostic("MATH10");
          if (!active) return;
          setSummaryText(res.summaryText);
          setIsCompleted(true);
        } else {
          setQuestion(q);
          setSelectedOption(null);
          setSelectedConfidence("somewhat");
        }
      } catch (err) {
        console.error("Diagnostic load error", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, []);

  async function handleAnswerSubmit() {
    if (!question || !selectedOption) return;
    setSubmitting(true);

    try {
      const res = await diagnosticApi.submitDiagnosticAnswer("MATH10", {
        questionId: question.questionId,
        answer: selectedOption,
        confidence: selectedConfidence,
      });

      if (res.completed || !res.nextQuestion) {
        const finishRes = await diagnosticApi.completeDiagnostic("MATH10");
        setSummaryText(finishRes.summaryText);
        setIsCompleted(true);
      } else {
        setQuestion(res.nextQuestion);
        setSelectedOption(null);
        setSelectedConfidence("somewhat");
      }
    } catch (err) {
      console.error("Answer submission failed", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cp-focus dashboard-page min-h-screen flex flex-col">
      {/* Sticky Focus Top Bar */}
      <header className="cp-focus__bar">
        <div className="flex items-center gap-3">
          <div className="cp-brand">
            <div className="cp-brand__icon" aria-hidden="true">
              <School />
            </div>
            <div className="min-w-0">
              <p className="cp-brand__name">
                Student <em>Portal</em>
              </p>
            </div>
          </div>

          <div className="cp-focus__title">
            <h1 className="text-sm font-bold text-ink">Baseline Diagnostic</h1>
            <p className="cp-caption text-xs hidden sm:block">
              Course Calibration • Zero Grade Impact
            </p>
          </div>
        </div>

        <div className="cp-focus__right">
          <Link
            href="/"
            className="ui-button ui-button-secondary ui-button-sm text-xs"
          >
            <X className="w-3.5 h-3.5" />
            Exit to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="cp-focus__main flex-1 flex flex-col justify-center py-8">
        {loading ? (
          <div className="p-12 text-center max-w-lg mx-auto bg-white border-2 border-ink rounded-xl shadow-zine">
            <RotateCw className="w-8 h-8 animate-spin mx-auto text-ink mb-3" />
            <p className="font-bold text-ink text-base">Loading diagnostic...</p>
            <p className="cp-caption mt-1">Preparing your calibration questions.</p>
          </div>
        ) : isCompleted ? (
          /* ========================================================= */
          /* COMPLETION SCREEN: Qualitative summary ONLY. NEVER numeric */
          /* ========================================================= */
          <div className="cp-card cp-card--mint p-8 sm:p-12 max-w-2xl mx-auto w-full relative animate-portal-enter text-center">
            <div className="w-16 h-16 bg-white border-2 border-ink rounded-full flex items-center justify-center mx-auto mb-4 shadow-zine">
              <Sparkles className="w-8 h-8 text-emerald-600" />
            </div>

            <span className="cp-sticker mx-auto mb-3">Calibration Complete</span>
            <h2 className="cp-h-hero mb-3">Baseline Diagnostic Finished</h2>

            {/* Qualitative summary sentence prominent box */}
            <div className="p-6 bg-white border-2 border-ink rounded-xl shadow-zine my-6 text-left space-y-3">
              <p className="zine-label flex items-center gap-1.5 text-xs">
                <Compass className="w-4 h-4 text-emerald-700" />
                Diagnostic Summary
              </p>
              <p className="font-sans font-bold text-ink text-lg sm:text-xl leading-relaxed">
                &ldquo;{summaryText}&rdquo;
              </p>
              <p className="cp-caption text-xs border-t border-slate-200 pt-3">
                This qualitative assessment personalizes your upcoming practice recommendations.
                No numeric score, percentage, or ranking is ever assigned.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/"
                className="ui-button ui-button-primary ui-button-lg px-8 justify-center"
              >
                Go to Student Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        ) : question ? (
          /* ========================================================= */
          /* QUESTION FLOW: One question at a time, progress dots      */
          /* ========================================================= */
          <div className="cp-card cp-card--yellow p-6 sm:p-10 max-w-2xl mx-auto w-full relative animate-portal-enter">
            {/* Header: Question Badge + PROGRESS DOTS (Strictly NO percentage or score) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-ink/20">
              <div className="flex items-center gap-2">
                <span className="cp-sticker">Question {question.index}</span>
                <span className="text-xs font-mono font-bold text-muted">
                  Concept Check
                </span>
              </div>

              {/* Progress Dots: o o o o (never score or %) */}
              <div
                className="flex items-center gap-2"
                aria-label={`Question ${question.index} of ${question.total}`}
              >
                {Array.from({ length: question.total }).map((_, i) => {
                  const isCurrent = i + 1 === question.index;
                  const isPast = i + 1 < question.index;

                  return (
                    <div
                      key={i}
                      className={`w-3.5 h-3.5 rounded-full border-2 border-ink transition-all ${
                        isCurrent
                          ? "bg-ink scale-125 shadow-sm"
                          : isPast
                          ? "bg-emerald-400"
                          : "bg-white"
                      }`}
                      title={`Step ${i + 1}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Question Prompt */}
            <h2 className="cp-h-card text-xl sm:text-2xl font-extrabold text-ink mb-6">
              {question.prompt}
            </h2>

            {/* Multiple Choice Options */}
            <div className="space-y-3 mb-8">
              <label className="zine-label mb-1 block">Choose the best answer:</label>
              {question.options.map((opt, idx) => {
                const isSelected = selectedOption === opt;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedOption(opt)}
                    className={`w-full text-left p-4 rounded-xl border-2 border-ink transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-white shadow-zine border-ink scale-[1.01]"
                        : "bg-white/80 hover:bg-white shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg border-2 border-ink flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          isSelected
                            ? "bg-yellow-300 text-ink"
                            : "bg-slate-100 text-muted"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="font-bold text-ink text-base">
                        {opt}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-ink text-yellow-300 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Confidence Selector ("How sure are you?") */}
            <div className="mb-8 pt-6 border-t-2 border-ink/20">
              <label className="zine-label mb-2 flex items-center gap-1.5 text-xs">
                <HelpCircle className="w-3.5 h-3.5" />
                How sure are you?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {CONFIDENCE_LEVELS.map((lvl) => {
                  const isChosen = selectedConfidence === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setSelectedConfidence(lvl.id)}
                      className={`p-3 rounded-xl border-2 border-ink text-left transition-all ${
                        isChosen
                          ? `${lvl.activeColor} scale-[1.02] font-bold`
                          : "bg-white/70 hover:bg-white text-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink text-xs">
                          {lvl.label}
                        </span>
                        <span className="text-[10px] font-mono uppercase font-bold opacity-60">
                          {lvl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        {lvl.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Link
                href="/"
                className="ui-button ui-button-secondary text-xs"
              >
                Skip for now
              </Link>

              <button
                type="button"
                onClick={handleAnswerSubmit}
                disabled={submitting || !selectedOption}
                className="ui-button ui-button-primary ui-button-lg px-6 justify-center"
              >
                {submitting ? (
                  <>
                    <RotateCw className="w-5 h-5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    Next Question
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
