"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ListChecks,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardShell from "@/components/DashboardShell";

type Participant = {
  id: number;
  session_id: number;
  student_name: string;
  score: number;
};

type QuizAnswer = {
  id: number;
  participant_id: number;
  question_id: number;
  is_correct: boolean;
  points: number;
};

type Quiz = {
  id: number;
  title: string;
  subject: string;
};

export default function QuizResultsPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const quizId = Number(params.id);

  const sessionId = Number(
    searchParams.get("session")
  );

  const participantId = Number(
    searchParams.get("participant")
  );

  const [quiz, setQuiz] =
    useState<Quiz | null>(null);

  const [participants, setParticipants] =
    useState<Participant[]>([]);

  const [answers, setAnswers] =
    useState<QuizAnswer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function loadResults() {
      setLoading(true);
      setErrorMessage("");

      if (
        !quizId ||
        !sessionId ||
        !participantId
      ) {
        setErrorMessage(
          "Invalid quiz results link."
        );

        setLoading(false);
        return;
      }

      const [
        quizResult,
        participantsResult,
        answersResult,
      ] = await Promise.all([
        supabase
          .from("quizzes")
          .select(
            "id, title, subject"
          )
          .eq("id", quizId)
          .single(),

        supabase
          .from("quiz_participants")
          .select(
            "id, session_id, student_name, score"
          )
          .eq(
            "session_id",
            sessionId
          ),

        supabase
          .from("quiz_answers")
          .select(
            "id, participant_id, question_id, is_correct, points"
          )
          .eq(
            "participant_id",
            participantId
          ),
      ]);

      if (
        quizResult.error ||
        !quizResult.data
      ) {
        setErrorMessage(
          "Could not load quiz details."
        );

        setLoading(false);
        return;
      }

      if (
        participantsResult.error
      ) {
        setErrorMessage(
          participantsResult.error.message
        );

        setLoading(false);
        return;
      }

      if (answersResult.error) {
        setErrorMessage(
          answersResult.error.message
        );

        setLoading(false);
        return;
      }

      setQuiz(
        quizResult.data
      );

      setParticipants(
        participantsResult.data ||
          []
      );

      setAnswers(
        answersResult.data || []
      );

      setLoading(false);
    }

    loadResults();
  }, [
    quizId,
    sessionId,
    participantId,
  ]);

  const sortedParticipants =
    useMemo(() => {
      return [...participants].sort(
        (a, b) => {
          if (
            b.score !== a.score
          ) {
            return (
              b.score - a.score
            );
          }

          return a.student_name.localeCompare(
            b.student_name
          );
        }
      );
    }, [participants]);

  const currentStudent =
    participants.find(
      (participant) =>
        participant.id ===
        participantId
    );

  const finalRank =
    sortedParticipants.findIndex(
      (participant) =>
        participant.id ===
        participantId
    ) + 1;

  const correctAnswers =
    answers.filter(
      (answer) =>
        answer.is_correct
    ).length;

  const totalAnswered =
    answers.length;

  const totalPointsFromAnswers =
    answers.reduce(
      (total, answer) =>
        total +
        (answer.points || 0),
      0
    );

  if (loading) {
    return (
      <DashboardShell footerNote="Live quiz workspace">
        <div className="cp-state-wrap">
          <div className="cp-state">
            <span className="live-dot" aria-hidden="true" />

            <p className="cp-sticker">
              Quiz Results
            </p>

            <h1 className="cp-h-card">
              Preparing results...
            </h1>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (
    errorMessage ||
    !quiz ||
    !currentStudent
  ) {
    return (
      <DashboardShell footerNote="Live quiz workspace">
        <div className="cp-state-wrap">
          <div className="cp-state cp-state--error">
            <p className="cp-sticker">
              Quiz Results
            </p>

            <h1 className="cp-h-card">
              Results unavailable
            </h1>

            <p className="cp-state__msg">
              {errorMessage ||
                "Could not find your quiz result."}
            </p>

            <div className="cp-state__actions">
              <Link
                href="/quizzes"
                className="ui-button ui-button-primary"
              >
                <ArrowLeft aria-hidden="true" />
                Back to Quizzes
              </Link>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell footerNote="Live quiz workspace">

      {/* Hero (acts as the page header) */}
      <header className="cp-hero cp-hero--mint cp-tape-top">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <div className="flex items-start gap-4">
              <span className="result-icon result-icon-filled shrink-0" aria-hidden="true">
                <Check />
              </span>

              <div className="min-w-0 flex-1">
                <p className="cp-sticker">
                  Quiz Complete
                </p>

                <h2 className="cp-h-hero">
                  {quiz.title}
                </h2>

                <p className="cp-hero__sub">
                  Well done,{" "}
                  {currentStudent.student_name}
                </p>

                <p className="cp-text mt-1">
                  Your live quiz session is complete.
                </p>
              </div>
            </div>
          </div>

          <div className="cp-hero__pills">
            <span className="ui-pill ui-pill-sky">
              <BookOpen aria-hidden="true" />
              {quiz.subject}
            </span>

            <span className="ui-pill ui-pill-dark">
              <Trophy aria-hidden="true" />
              Final Result
            </span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="cp-grid-4" aria-label="Your result">

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Final Rank</p>
            <span className="cp-stat__icon cp-stat__icon--yellow" aria-hidden="true">
              <Trophy />
            </span>
          </div>

          <p className="cp-stat__value">
            {finalRank > 0
              ? `#${finalRank}`
              : "—"}
          </p>

          <p className="cp-stat__caption">
            of {participants.length}{" "}
            {participants.length === 1
              ? "student"
              : "students"}
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Total Score</p>
            <span className="cp-stat__icon cp-stat__icon--mint" aria-hidden="true">
              <Star />
            </span>
          </div>

          <p className="cp-stat__value">
            {currentStudent.score}
          </p>

          <p className="cp-stat__caption">
            Final score
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Correct</p>
            <span className="cp-stat__icon cp-stat__icon--sky" aria-hidden="true">
              <CheckCircle2 />
            </span>
          </div>

          <p className="cp-stat__value">
            {correctAnswers}
          </p>

          <p className="cp-stat__caption">
            Correct answers
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Answered</p>
            <span className="cp-stat__icon cp-stat__icon--pink" aria-hidden="true">
              <ListChecks />
            </span>
          </div>

          <p className="cp-stat__value">
            {totalAnswered}
          </p>

          <p className="cp-stat__caption">
            Total answers
          </p>
        </div>

      </section>

      {/* Score Breakdown */}
      <section className="cp-section" aria-labelledby="performance-title">
        <div className="cp-section__head">
          <div className="cp-section__heading">
            <p className="zine-label">
              <Star aria-hidden="true" />
              Score Summary
            </p>

            <h2 id="performance-title" className="cp-section__title">
              Performance
            </h2>
          </div>

          <span className="ui-pill ui-pill-dark">
            {totalPointsFromAnswers} pts
          </span>
        </div>

        <div className="cp-section__list">

          <div className="cp-row cp-row--correct">
            <div className="cp-row__main">
              <div className="cp-row__tags">
                <span className="ui-pill ui-pill-mint">
                  <Check aria-hidden="true" />
                  Correct
                </span>
              </div>

              <h3 className="cp-row__title">
                Correct answers
              </h3>
            </div>

            <div className="cp-row__side">
              <span className="leaderboard-score text-base">
                {correctAnswers}
              </span>
            </div>
          </div>

          <div className="cp-row cp-row--white">
            <div className="cp-row__main">
              <div className="cp-row__tags">
                <span className="ui-pill ui-pill-muted">
                  <ListChecks aria-hidden="true" />
                  Answered
                </span>
              </div>

              <h3 className="cp-row__title">
                Total answers
              </h3>
            </div>

            <div className="cp-row__side">
              <span className="leaderboard-score text-base">
                {totalAnswered}
              </span>
            </div>
          </div>

          <div className="cp-row cp-row--yellow">
            <div className="cp-row__main">
              <div className="cp-row__tags">
                <span className="ui-pill ui-pill-yellow">
                  <Trophy aria-hidden="true" />
                  Score
                </span>
              </div>

              <h3 className="cp-row__title">
                Final score
              </h3>
            </div>

            <div className="cp-row__side">
              <span className="leaderboard-score text-base">
                {currentStudent.score}
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* Final Leaderboard */}
      <section className="cp-section" aria-labelledby="leaderboard-title">
        <div className="cp-section__head">
          <div className="cp-section__heading">
            <p className="zine-label">
              <Trophy aria-hidden="true" />
              Final Standings
            </p>

            <h2 id="leaderboard-title" className="cp-section__title">
              Leaderboard
            </h2>
          </div>

          <span className="ui-pill ui-pill-sky">
            <Users aria-hidden="true" />
            {participants.length}{" "}
            {participants.length === 1
              ? "student"
              : "students"}
          </span>
        </div>

        <div className="cp-section__list">

          {sortedParticipants.map(
            (
              participant,
              index
            ) => {
              const isYou =
                participant.id ===
                participantId;

              return (
                <div
                  key={
                    participant.id
                  }
                  className={
                    isYou
                      ? "leaderboard-row leaderboard-row-you"
                      : "leaderboard-row"
                  }
                >
                  <span
                    className={`leaderboard-rank${
                      index === 0
                        ? " leaderboard-rank-1"
                        : index === 1
                        ? " leaderboard-rank-2"
                        : index === 2
                        ? " leaderboard-rank-3"
                        : ""
                    }`}
                  >
                    {index + 1}
                  </span>

                  <span className="leaderboard-name">
                    {
                      participant.student_name
                    }
                  </span>

                  {isYou && (
                    <span className="ui-pill ui-pill-dark">
                      You
                    </span>
                  )}

                  <span className="leaderboard-score">
                    {participant.score} pts
                  </span>
                </div>
              );
            }
          )}

        </div>
      </section>

      {/* Bottom */}
      <div className="flex justify-center">
        <Link
          href="/quizzes"
          className="ui-button ui-button-primary"
        >
          <ArrowLeft aria-hidden="true" />
          Back to Quizzes
        </Link>
      </div>

    </DashboardShell>
  );
}
