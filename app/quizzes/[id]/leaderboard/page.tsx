"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ArrowLeft,
  Medal,
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

type QuizSession = {
  id: number;
  quiz_id: number;
  session_code: string;
  status:
    | "waiting"
    | "question"
    | "result"
    | "leaderboard"
    | "completed";
  current_question: number;
};

export default function LeaderboardPage() {
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

  const [participants, setParticipants] =
    useState<Participant[]>([]);

  const [session, setSession] =
    useState<QuizSession | null>(null);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  // =========================================================
  // LOAD PARTICIPANTS
  // =========================================================

  async function loadParticipants() {
    if (!sessionId) {
      setErrorMessage("Invalid quiz session.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("quiz_participants")
      .select(
        "id, session_id, student_name, score"
      )
      .eq("session_id", sessionId);

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setParticipants(data || []);
  }

  // =========================================================
  // LOAD SESSION
  // =========================================================

  async function loadSession() {
    if (!sessionId) {
      return;
    }

    const { data, error } = await supabase
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

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data) {
      setSession(data);
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    async function initialize() {
      setLoading(true);

      await Promise.all([
        loadParticipants(),
        loadSession(),
      ]);

      setLoading(false);
    }

    initialize();
  }, [sessionId]);

  // =========================================================
  // REALTIME PARTICIPANT / SCORE UPDATES
  // =========================================================

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const participantChannel = supabase
      .channel(
        `leaderboard-participants-${sessionId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        participantChannel
      );
    };
  }, [sessionId]);

  // =========================================================
  // REALTIME SESSION CONTROL
  //
  // leaderboard -> question
  // leaderboard -> completed
  // =========================================================

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const sessionChannel = supabase
      .channel(
        `leaderboard-session-${sessionId}`
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quiz_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const updatedSession =
            payload.new as QuizSession;

          setSession(updatedSession);

          // Faculty starts / continues question
          if (
            updatedSession.status ===
              "question" &&
            updatedSession.current_question > 0
          ) {
            router.push(
              `/quizzes/${quizId}/live?session=${sessionId}&participant=${participantId}`
            );

            return;
          }

          // Quiz has finished
          if (
            updatedSession.status ===
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
      supabase.removeChannel(sessionChannel);
    };
  }, [
    sessionId,
    quizId,
    participantId,
    router,
  ]);

  // =========================================================
  // SORT LEADERBOARD
  // =========================================================

  const sortedParticipants = useMemo(() => {
    return [...participants].sort(
      (a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.student_name.localeCompare(
          b.student_name
        );
      }
    );
  }, [participants]);

  // =========================================================
  // CURRENT STUDENT
  // =========================================================

  const yourPosition =
    sortedParticipants.findIndex(
      (participant) =>
        participant.id === participantId
    ) + 1;

  const yourScore =
    sortedParticipants.find(
      (participant) =>
        participant.id === participantId
    )?.score ?? 0;

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <DashboardShell footerNote="Live quiz workspace">
        <div className="cp-state-wrap">
          <div className="cp-state">
            <span className="live-dot" aria-hidden="true" />
            <p className="cp-sticker">Live standings</p>
            <h1 className="cp-h-card">Loading leaderboard...</h1>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (errorMessage) {
    return (
      <DashboardShell footerNote="Live quiz workspace">
        <div className="cp-state-wrap">
          <div className="cp-state cp-state--error">
            <p className="cp-sticker">Leaderboard unavailable</p>
            <h1 className="cp-h-card">Could not load leaderboard</h1>
            <p className="cp-state__msg">{errorMessage}</p>
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

  // =========================================================
  // UI
  // =========================================================

  return (
    <DashboardShell footerNote="Live quiz workspace">

      {/* Hero (acts as the page header) */}
      <header className="cp-hero cp-hero--sky">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <p className="cp-sticker">Live standings</p>

            <h2 className="cp-h-hero">Leaderboard</h2>

            <p className="cp-hero__sub">
              The next question will appear
              automatically.
            </p>
          </div>

          <div className="cp-hero__pills">
            {session && (
              <span className="ui-pill ui-pill-sky">
                Q{session.current_question}
              </span>
            )}

            <span className="ui-pill ui-pill-dark">
              <span className="live-dot" aria-hidden="true" />
              Live Quiz
            </span>
          </div>
        </div>
      </header>

      {/* Your standing */}
      <section className="cp-grid-3" aria-label="Your standing">

        <div className="hypercard-static cp-stat cp-card--yellow">
          <div className="cp-stat__head">
            <p className="cp-sticker">Your position</p>
            <span className="cp-stat__icon cp-stat__icon--ink" aria-hidden="true">
              <Medal />
            </span>
          </div>

          <p className="cp-stat__value">
            {yourPosition > 0
              ? `#${yourPosition}`
              : "—"}
          </p>

          <p className="cp-stat__caption">
            Current rank
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Your score</p>
            <span className="cp-stat__icon cp-stat__icon--yellow" aria-hidden="true">
              <Star />
            </span>
          </div>

          <p className="cp-stat__value">
            {yourScore.toLocaleString()}
          </p>

          <p className="cp-stat__caption">points</p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Players</p>
            <span className="cp-stat__icon cp-stat__icon--sky" aria-hidden="true">
              <Users />
            </span>
          </div>

          <p className="cp-stat__value">
            {participants.length}
          </p>

          <p className="cp-stat__caption">
            {participants.length === 1
              ? "student"
              : "students"}
          </p>
        </div>

      </section>

      {/* Rankings */}
      <section className="cp-section" aria-labelledby="rankings-title">

        <div className="cp-section__head">
          <div className="cp-section__heading">
            <p className="zine-label">
              <Trophy aria-hidden="true" />
              Rankings
            </p>

            <h2 id="rankings-title" className="cp-section__title">
              Live participants
            </h2>
          </div>

          <div className="cp-section__tools">
            <span className="ui-pill ui-pill-sky">
              <Users aria-hidden="true" />
              {participants.length}{" "}
              {participants.length === 1
                ? "student"
                : "students"}
            </span>

            <p className="cp-caption">
              <span className="live-dot live-dot--ink" aria-hidden="true" />
              Waiting for faculty to continue
              the quiz...
            </p>
          </div>
        </div>

        <div className="cp-section__list">

          {sortedParticipants.map(
            (participant, index) => {
              const isYou =
                participant.id ===
                participantId;

              return (
                <div
                  key={participant.id}
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
                    {participant.score.toLocaleString()} pts
                  </span>
                </div>
              );
            }
          )}

          {/* EMPTY */}

          {sortedParticipants.length ===
            0 && (
            <div className="cp-empty">
              <p className="cp-sticker">Rankings</p>
              <p className="cp-empty__hand mt-3">
                No students have joined this
                session yet.
              </p>
            </div>
          )}

        </div>

      </section>

    </DashboardShell>
  );
}
