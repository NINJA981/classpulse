"use client";

import { useEffect, useRef, useState } from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ArrowLeft,
  Check,
  ListChecks,
  MousePointerClick,
  Timer,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { BrandMark } from "@/components/DashboardShell";

type QuizQuestion = {
  id: number;
  quiz_id: number;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
};

type QuizSession = {
  id: number;
  quiz_id: number;
  session_code: string;
  status: string;
  current_question: number;
};

const QUESTION_TIME = 20;
const MAX_POINTS = 1000;
const MIN_POINTS = 500;
const TOTAL_QUESTIONS = 10;

export default function LiveQuizPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const quizId = Number(params.id);
  const sessionId = Number(
    searchParams.get("session")
  );
  const participantId = Number(
    searchParams.get("participant")
  );

  const [session, setSession] =
    useState<QuizSession | null>(null);

  const [question, setQuestion] =
    useState<QuizQuestion | null>(null);

  const [timeLeft, setTimeLeft] =
    useState(QUESTION_TIME);

  const [selectedAnswer, setSelectedAnswer] =
    useState<string | null>(null);

  const [answerLocked, setAnswerLocked] =
    useState(false);

  const [revealed, setRevealed] =
    useState(false);

  const [pointsEarned, setPointsEarned] =
    useState(0);

  const [totalScore, setTotalScore] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const timerRef =
    useRef<NodeJS.Timeout | null>(null);

  const questionStartedAt =
    useRef<number>(Date.now());

  const revealStarted =
    useRef(false);

  // ============================================================
  // LOAD SESSION
  // ============================================================

  useEffect(() => {
    async function loadSession() {
      if (!sessionId) {
        setErrorMessage(
          "Invalid quiz session."
        );
        setLoading(false);
        return;
      }

      const { data, error } =
        await supabase
          .from("quiz_sessions")
          .select(
            `
            id,
            quiz_id,
            session_code,
            status,
            current_question
            `
          )
          .eq("id", sessionId)
          .single();

      if (error || !data) {
        setErrorMessage(
          "Could not load live quiz session."
        );
        setLoading(false);
        return;
      }

      setSession(data);

      if (data.current_question > 0) {
        await loadQuestion(
          data.current_question
        );
      }

      setLoading(false);
    }

    loadSession();
  }, [sessionId]);

  // ============================================================
  // LOAD QUESTION
  // ============================================================

  async function loadQuestion(
    questionNumber: number
  ) {
    setLoading(true);
    setErrorMessage("");

    const { data, error } =
      await supabase
        .from("quiz_questions")
        .select(
          `
          id,
          quiz_id,
          question_number,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer
          `
        )
        .eq("quiz_id", quizId)
        .eq(
          "question_number",
          questionNumber
        )
        .single();

    if (error || !data) {
      setErrorMessage(
        `Could not load question ${questionNumber}.`
      );
      setLoading(false);
      return;
    }

    setQuestion(data);

    setTimeLeft(QUESTION_TIME);
    setSelectedAnswer(null);
    setAnswerLocked(false);
    setRevealed(false);
    setPointsEarned(0);

    revealStarted.current = false;
    questionStartedAt.current =
      Date.now();

    setLoading(false);
  }

  // ============================================================
  // LOAD STUDENT SCORE
  // ============================================================

  useEffect(() => {
    async function loadScore() {
      if (!participantId) return;

      const { data } =
        await supabase
          .from("quiz_participants")
          .select("score")
          .eq("id", participantId)
          .single();

      if (data) {
        setTotalScore(
          data.score ?? 0
        );
      }
    }

    loadScore();
  }, [participantId]);

  // ============================================================
  // QUESTION TIMER
  // ============================================================

  useEffect(() => {
    if (!question || revealed) {
      return;
    }

    if (timerRef.current) {
      clearInterval(
        timerRef.current
      );
    }

    timerRef.current =
      setInterval(() => {
        setTimeLeft((previous) => {
          if (previous <= 1) {
            if (timerRef.current) {
              clearInterval(
                timerRef.current
              );
            }

            return 0;
          }

          return previous - 1;
        });
      }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }
    };
  }, [question, revealed]);

  // ============================================================
  // AUTOMATIC ANSWER REVEAL
  // ============================================================

  useEffect(() => {
    if (timeLeft !== 0) return;
    if (!question) return;
    if (revealStarted.current) return;

    revealStarted.current = true;

    revealAnswer();
  }, [timeLeft, question]);

  // ============================================================
  // SELECT ANSWER
  // ============================================================

  function selectAnswer(answer: string) {
    if (!question) return;
    if (answerLocked) return;
    if (timeLeft <= 0) return;

    setSelectedAnswer(answer);
    setAnswerLocked(true);
  }

  // ============================================================
  // SPEED-BASED SCORING
  // ============================================================

  function calculatePoints(
    secondsUsed: number
  ) {
    if (
      secondsUsed >=
      QUESTION_TIME
    ) {
      return MIN_POINTS;
    }

    const speedRatio =
      (QUESTION_TIME -
        secondsUsed) /
      QUESTION_TIME;

    const bonus =
      (MAX_POINTS -
        MIN_POINTS) *
      speedRatio;

    return Math.round(
      MIN_POINTS + bonus
    );
  }

  // ============================================================
  // REVEAL + SAVE ANSWER + UPDATE SCORE
  // ============================================================

  async function revealAnswer() {
    if (!question) return;

    setRevealed(true);

    const isCorrect =
      selectedAnswer ===
      question.correct_answer;

    let earned = 0;

    if (
      selectedAnswer &&
      isCorrect
    ) {
      const millisecondsUsed =
        Date.now() -
        questionStartedAt.current;

      const secondsUsed =
        millisecondsUsed / 1000;

      earned =
        calculatePoints(
          secondsUsed
        );
    }

    setPointsEarned(earned);

    if (
      !selectedAnswer ||
      !participantId
    ) {
      return;
    }

    // Save student's answer
    const { error: answerError } =
      await supabase
        .from("quiz_answers")
        .insert({
          session_id: sessionId,
          participant_id:
            participantId,
          question_id:
            question.id,
          selected_answer:
            selectedAnswer,
          is_correct:
            isCorrect,

          // IMPORTANT:
          // your Supabase table column
          // is named "points"
          points: earned,
        });

    if (answerError) {
      console.error(
        "Could not save answer:",
        answerError.message
      );
    }

    // Update total score
    if (earned > 0) {
      const newScore =
        totalScore + earned;

      const {
        error: scoreError,
      } = await supabase
        .from(
          "quiz_participants"
        )
        .update({
          score: newScore,
        })
        .eq(
          "id",
          participantId
        );

      if (scoreError) {
        console.error(
          "Could not update score:",
          scoreError.message
        );
      } else {
        setTotalScore(
          newScore
        );
      }
    }
  }

  // ============================================================
  // REALTIME FACULTY CONTROL
  // ============================================================

  useEffect(() => {
    if (!sessionId) return;

    const channel =
      supabase
        .channel(
          `live-session-${sessionId}`
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table:
              "quiz_sessions",
            filter:
              `id=eq.${sessionId}`,
          },
          async (payload) => {
            const updated =
              payload.new as QuizSession;

            const previousQuestion =
              session?.current_question;

            setSession(updated);

            // NEXT QUESTION
            if (
              updated.status ===
                "question" &&
              updated.current_question >
                0 &&
              updated.current_question !==
                previousQuestion
            ) {
              await loadQuestion(
                updated.current_question
              );
            }

            // LEADERBOARD
            if (
              updated.status ===
              "leaderboard"
            ) {
              router.push(
                `/quizzes/${quizId}/leaderboard?session=${sessionId}&participant=${participantId}`
              );
            }

            // FINISHED
            if (
              updated.status ===
              "completed"
            ) {
              router.push(
                `/quizzes/${quizId}/results?session=${sessionId}&participant=${participantId}`
              );
            }
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    sessionId,
    quizId,
    participantId,
    router,
    session?.current_question,
  ]);

  // ============================================================
  // OPTIONS
  // ============================================================

  const options = question
    ? [
        {
          key: "A",
          value:
            question.option_a,
        },
        {
          key: "B",
          value:
            question.option_b,
        },
        {
          key: "C",
          value:
            question.option_c,
        },
        {
          key: "D",
          value:
            question.option_d,
        },
      ]
    : [];

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="cp-focus">
        <header className="cp-focus__bar">
          <BrandMark />
          <div className="cp-focus__title">
            <p className="cp-focus__name">Live Quiz</p>
          </div>
          <div className="cp-focus__right">
            <Link href="/quizzes" className="ui-button ui-button-secondary">
              <ArrowLeft aria-hidden="true" />
              Quizzes
            </Link>
          </div>
        </header>
        <main className="cp-focus__main">
        <div className="cp-state-wrap">
          <div className="cp-state">
            <span className="live-dot" aria-hidden="true" />

            <p className="cp-sticker">
              Live Quiz
            </p>

            <h1 className="cp-h-card">
              Loading question...
            </h1>

            <p className="cp-state__msg">
              Preparing your live
              quiz session.
            </p>
          </div>
        </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (
    errorMessage ||
    !question
  ) {
    return (
      <div className="cp-focus">
        <header className="cp-focus__bar">
          <BrandMark />
          <div className="cp-focus__title">
            <p className="cp-focus__name">Live Quiz</p>
          </div>
          <div className="cp-focus__right">
            <Link href="/quizzes" className="ui-button ui-button-secondary">
              <ArrowLeft aria-hidden="true" />
              Quizzes
            </Link>
          </div>
        </header>
        <main className="cp-focus__main">
        <div className="cp-state-wrap">
          <div
            className={
              errorMessage
                ? "cp-state cp-state--error"
                : "cp-state cp-state--notice"
            }
          >
            {!errorMessage && (
              <span className="live-dot" aria-hidden="true" />
            )}

            <p className="cp-sticker">
              Live Quiz
            </p>

            <h1 className="cp-h-card">
              Question unavailable
            </h1>

            <p className="cp-state__msg">
              {errorMessage ||
                "Waiting for faculty to select a question."}
            </p>

            {!errorMessage && (
              <p className="cp-body mt-4">
                Waiting for faculty...
              </p>
            )}
          </div>
        </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // QUESTION UI
  // ============================================================

  const isAnswerCorrect =
    revealed &&
    selectedAnswer ===
      question.correct_answer;

  const isAnswerWrong =
    revealed &&
    !!selectedAnswer &&
    selectedAnswer !==
      question.correct_answer;

  const isTimedOut =
    revealed && !selectedAnswer;

  return (
    <div className="cp-focus">

      {/* ======================================================
          TOP STRIP (brand + quiz name + timer)
      ====================================================== */}

      <header className="cp-focus__bar">
        <BrandMark />

        <div className="cp-focus__title">
          <p className="cp-focus__name">
            Java Basics Quiz
          </p>
        </div>

        <div className="cp-focus__right">
          <span className="ui-pill ui-pill-dark hidden md:inline-flex">
            <span className="live-dot live-dot--mint" aria-hidden="true" />
            Live Quiz
          </span>

          <span
            className={
              timeLeft <= 5
                ? "quiz-timer quiz-timer-warning"
                : "quiz-timer"
            }
            role="timer"
            aria-live="off"
          >
            <Timer aria-hidden="true" />
            {timeLeft}s
          </span>
        </div>
      </header>

      <main className="cp-focus__main">

        {/* ======================================================
            PROGRESS
        ====================================================== */}

        <section className="cp-inset" aria-label="Quiz progress">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="zine-label">
                <ListChecks aria-hidden="true" />
                Live Assessment
              </p>

              <p className="cp-h-card-sm mt-1">
                Question{" "}
                {
                  question.question_number
                }{" "}
                of {TOTAL_QUESTIONS}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="ui-pill ui-pill-yellow">
                <Zap aria-hidden="true" />
                Score{" "}
                <strong className="cp-datum">
                  {totalScore}
                </strong>
              </span>

              <span className="cp-chip cp-chip--yellow">
                {
                  question.question_number
                }
                /{TOTAL_QUESTIONS}
              </span>
            </div>
          </div>

          <div className="quiz-progress-track">
            <span
              className="quiz-progress-bar"
              style={{
                width: `${
                  (question.question_number /
                    TOTAL_QUESTIONS) *
                  100
                }%`,
              }}
            />
          </div>
        </section>

        {/* ======================================================
            QUESTION
        ====================================================== */}

        <section className="cp-card cp-card--sky p-6 md:p-8" aria-labelledby="live-question">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="cp-sticker">
                Question{" "}
                {
                  question.question_number
                }
              </p>

              <h1 id="live-question" className="cp-question mt-3">
                {
                  question.question_text
                }
              </h1>

              {!answerLocked &&
                !revealed && (
                  <p className="cp-text mt-3">
                    Choose an answer
                    before the timer
                    reaches zero.
                  </p>
                )}
            </div>
          </div>
        </section>

        {/* ======================================================
            ANSWERS
        ====================================================== */}

        <section className="cp-section" aria-labelledby="answers-title">
          <div className="cp-section__head border-b-0 pb-0">
            <div className="cp-section__heading flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="zine-label">
                <MousePointerClick aria-hidden="true" />
                Choose Answer
              </p>

              <p id="answers-title" className="cp-caption">
                Answer faster to
                earn more points.
              </p>
            </div>

            {!answerLocked &&
              !revealed && (
                <span className="ui-pill ui-pill-sky">
                  Choose one
                </span>
              )}
          </div>

          <div className="cp-grid-2">
            {options.map(
              (option) => {

                const isSelected =
                  selectedAnswer ===
                  option.key;

                const isCorrect =
                  revealed &&
                  option.key ===
                    question.correct_answer;

                const isWrong =
                  revealed &&
                  isSelected &&
                  option.key !==
                    question.correct_answer;

                let optionStyle =
                  "quiz-option";

                if (
                  !revealed &&
                  isSelected
                ) {
                  optionStyle +=
                    " quiz-option-selected";
                }

                if (isCorrect) {
                  optionStyle +=
                    " quiz-option-correct";
                }

                if (isWrong) {
                  optionStyle +=
                    " quiz-option-wrong";
                }

                if (
                  revealed &&
                  !isCorrect &&
                  !isWrong
                ) {
                  optionStyle +=
                    " quiz-option-muted";
                }

                return (
                  <button
                    key={option.key}
                    onClick={() =>
                      selectAnswer(
                        option.key
                      )
                    }
                    aria-pressed={isSelected}
                    disabled={
                      answerLocked ||
                      revealed ||
                      timeLeft === 0
                    }
                    className={optionStyle}
                  >
                    <span className="quiz-option-key">
                      {option.key}
                    </span>

                    <span className="min-w-0 flex-1">
                      {option.value}
                    </span>

                    {revealed &&
                      isCorrect && (
                        <>
                          <Check className="ml-auto h-5 w-5 shrink-0" aria-hidden="true" />
                          <span className="sr-only">Correct</span>
                        </>
                      )}

                    {revealed &&
                      isWrong && (
                        <>
                          <X className="ml-auto h-5 w-5 shrink-0" aria-hidden="true" />
                          <span className="sr-only">Incorrect</span>
                        </>
                      )}
                  </button>
                );
              }
            )}
          </div>
        </section>

        {/* ======================================================
            ANSWER LOCKED
        ====================================================== */}

        {answerLocked &&
          !revealed && (
            <section className="cp-state-wrap" aria-live="polite">
              <div className="cp-state cp-state--notice">
                <div className="result-icon result-icon-filled mx-auto">
                  <Check aria-hidden="true" />
                </div>

                <p className="cp-sticker mt-4">
                  Response Recorded
                </p>

                <h2 className="cp-h-card">
                  Answer locked
                </h2>

                <p className="cp-state__msg">
                  Your answer cannot
                  be changed.
                </p>

                <p className="cp-caption mt-4 justify-center">
                  <span className="live-dot" aria-hidden="true" />
                  Waiting for the
                  timer...
                </p>
              </div>
            </section>
          )}

        {/* ======================================================
            CORRECT
        ====================================================== */}

        {isAnswerCorrect && (
          <section className="cp-state-wrap" aria-live="polite">
            <div className="cp-state cp-state--success">
              <div className="result-icon result-icon-mint mx-auto">
                <Check aria-hidden="true" />
              </div>

              <p className="cp-sticker mt-4">
                Correct Answer
              </p>

              <h2 className="cp-h-card">
                Correct!
              </h2>

              <p className="cp-stat__value mt-4">
                +{pointsEarned}
              </p>

              <p className="cp-caption mt-2 justify-center">
                points earned
              </p>

              <p className="cp-state__msg">
                Faster answers earn
                more points.
              </p>

              <hr className="ui-divider mx-auto my-5 max-w-sm" />

              <div className="flex flex-wrap justify-center gap-2">
                <span className="ui-pill">
                  Total Score
                </span>

                <span className="ui-pill ui-pill-dark">
                  {totalScore}
                </span>
              </div>

              <p className="cp-caption mt-4 justify-center">
                <span className="live-dot" aria-hidden="true" />
                Waiting for faculty...
              </p>
            </div>
          </section>
        )}

        {/* ======================================================
            INCORRECT
        ====================================================== */}

        {isAnswerWrong && (
          <section className="cp-state-wrap" aria-live="polite">
            <div className="cp-state cp-state--error">
              <div className="result-icon result-icon-danger mx-auto">
                <X aria-hidden="true" />
              </div>

              <p className="cp-sticker mt-4">
                Answer Result
              </p>

              <h2 className="cp-h-card">
                Incorrect
              </h2>

              <p className="cp-stat__value mt-4">
                +0
              </p>

              <p className="cp-caption mt-2 justify-center">
                points earned
              </p>

              <hr className="ui-divider mx-auto my-5 max-w-sm" />

              <p className="zine-label justify-center">
                Correct option
              </p>

              <div className="mt-3 flex justify-center">
                <span className="ui-pill ui-pill-mint">
                  {
                    question.correct_answer
                  }
                </span>
              </div>

              <p className="cp-text mt-4">
                Total score:{" "}
                <strong className="cp-datum text-ink">
                  {totalScore}
                </strong>
              </p>

              <p className="cp-caption mt-4 justify-center">
                <span className="live-dot live-dot--danger" aria-hidden="true" />
                Waiting for faculty...
              </p>
            </div>
          </section>
        )}

        {/* ======================================================
            TIME OUT
        ====================================================== */}

        {isTimedOut && (
          <section className="cp-state-wrap" aria-live="polite">
            <div className="cp-state cp-state--notice">
              <div className="result-icon result-icon-ink mx-auto">
                <Timer aria-hidden="true" />
              </div>

              <p className="cp-sticker mt-4">
                Timer Finished
              </p>

              <h2 className="cp-h-card">
                Time&apos;s up
              </h2>

              <p className="cp-state__msg">
                You didn&apos;t
                submit an answer.
              </p>

              <p className="cp-stat__value mt-4">
                +0
              </p>

              <p className="cp-caption mt-2 justify-center">
                points earned
              </p>

              <hr className="ui-divider mx-auto my-5 max-w-sm" />

              <p className="zine-label justify-center">
                Correct option
              </p>

              <div className="mt-3 flex justify-center">
                <span className="ui-pill ui-pill-mint">
                  {
                    question.correct_answer
                  }
                </span>
              </div>

              <p className="cp-caption mt-4 justify-center">
                <span className="live-dot" aria-hidden="true" />
                Waiting for faculty...
              </p>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
