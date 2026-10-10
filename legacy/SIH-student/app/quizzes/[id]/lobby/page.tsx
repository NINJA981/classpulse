"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  KeyRound,
  Radio,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardShell from "@/components/DashboardShell";

type Quiz = {
  id: number;
  title: string;
  subject: string;
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

export default function QuizLobbyPage() {
  const params = useParams();
  const router = useRouter();

  const quizId = Number(params.id);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [session, setSession] =
    useState<QuizSession | null>(null);

  const [studentName, setStudentName] =
    useState("");

  const [joined, setJoined] =
    useState(false);

  const [participantCount, setParticipantCount] =
    useState(0);

  const [participantId, setParticipantId] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [joining, setJoining] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  // ============================================================
  // LOAD QUIZ + SESSION
  // ============================================================

  useEffect(() => {
    async function loadLobby() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: quizData,
        error: quizError,
      } = await supabase
        .from("quizzes")
        .select("id, title, subject")
        .eq("id", quizId)
        .single();

      if (quizError || !quizData) {
        setErrorMessage(
          "Could not load quiz."
        );

        setLoading(false);
        return;
      }

      setQuiz(quizData);

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase
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
        .eq("quiz_id", quizId)
        .order("id", {
          ascending: false,
        })
        .limit(1)
        .single();

      if (
        sessionError ||
        !sessionData
      ) {
        setErrorMessage(
          "No live session is available for this quiz."
        );

        setLoading(false);
        return;
      }

      setSession(sessionData);

      await refreshParticipantCount(
        sessionData.id
      );

      setLoading(false);
    }

    if (!Number.isNaN(quizId)) {
      loadLobby();
    }
  }, [quizId]);

  // ============================================================
  // PARTICIPANT COUNT
  // ============================================================

  async function refreshParticipantCount(
    currentSessionId: number
  ) {
    const { count } =
      await supabase
        .from("quiz_participants")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq(
          "session_id",
          currentSessionId
        );

    setParticipantCount(
      count ?? 0
    );
  }

  // ============================================================
  // REALTIME PARTICIPANTS
  // ============================================================

  useEffect(() => {
    if (!session) return;

    const channel =
      supabase
        .channel(
          `participants-${session.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "quiz_participants",
            filter:
              `session_id=eq.${session.id}`,
          },
          () => {
            refreshParticipantCount(
              session.id
            );
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [session]);

  // ============================================================
  // REALTIME SESSION CONTROL
  // ============================================================

  useEffect(() => {
    if (!session) return;

    const channel =
      supabase
        .channel(
          `session-${session.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table:
              "quiz_sessions",
            filter:
              `id=eq.${session.id}`,
          },
          (payload) => {
            const updatedSession =
              payload.new as QuizSession;

            setSession(
              updatedSession
            );

            if (
              updatedSession.status ===
                "question" &&
              joined &&
              participantId
            ) {
              router.push(
                `/quizzes/${quizId}/live?session=${session.id}&participant=${participantId}`
              );

              return;
            }

            if (
              updatedSession.status ===
                "leaderboard" &&
              joined &&
              participantId
            ) {
              router.push(
                `/quizzes/${quizId}/leaderboard?session=${session.id}&participant=${participantId}`
              );
            }

            if (
              updatedSession.status ===
                "completed" &&
              joined &&
              participantId
            ) {
              router.push(
                `/quizzes/${quizId}/results?session=${session.id}&participant=${participantId}`
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
    session,
    joined,
    participantId,
    quizId,
    router,
  ]);

  // ============================================================
  // JOIN QUIZ
  // ============================================================

  async function joinQuiz() {
    const cleanName =
      studentName.trim();

    if (
      !cleanName ||
      !session
    ) {
      return;
    }

    setJoining(true);
    setErrorMessage("");

    const {
      data: existingParticipant,
      error: existingError,
    } = await supabase
      .from("quiz_participants")
      .select(
        "id, student_name, score"
      )
      .eq(
        "session_id",
        session.id
      )
      .ilike(
        "student_name",
        cleanName
      )
      .maybeSingle();

    if (existingError) {
      setErrorMessage(
        `Could not check participant: ${existingError.message}`
      );

      setJoining(false);
      return;
    }

    if (existingParticipant) {
      setParticipantId(
        existingParticipant.id
      );

      setStudentName(
        existingParticipant.student_name
      );

      setJoined(true);

      await refreshParticipantCount(
        session.id
      );

      setJoining(false);

      if (
        session.status ===
        "question"
      ) {
        router.push(
          `/quizzes/${quizId}/live?session=${session.id}&participant=${existingParticipant.id}`
        );

        return;
      }

      if (
        session.status ===
        "leaderboard"
      ) {
        router.push(
          `/quizzes/${quizId}/leaderboard?session=${session.id}&participant=${existingParticipant.id}`
        );

        return;
      }

      if (
        session.status ===
        "completed"
      ) {
        router.push(
          `/quizzes/${quizId}/results?session=${session.id}&participant=${existingParticipant.id}`
        );

        return;
      }

      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("quiz_participants")
      .insert({
        session_id:
          session.id,
        student_name:
          cleanName,
        score: 0,
      })
      .select(
        "id, student_name"
      )
      .single();

    if (error) {
      setErrorMessage(
        `Could not join quiz: ${error.message}`
      );

      setJoining(false);
      return;
    }

    setParticipantId(data.id);
    setStudentName(
      data.student_name
    );
    setJoined(true);

    await refreshParticipantCount(
      session.id
    );

    setJoining(false);

    if (
      session.status ===
      "question"
    ) {
      router.push(
        `/quizzes/${quizId}/live?session=${session.id}&participant=${data.id}`
      );

      return;
    }

    if (
      session.status ===
      "leaderboard"
    ) {
      router.push(
        `/quizzes/${quizId}/leaderboard?session=${session.id}&participant=${data.id}`
      );

      return;
    }

    if (
      session.status ===
      "completed"
    ) {
      router.push(
        `/quizzes/${quizId}/results?session=${session.id}&participant=${data.id}`
      );
    }
  }

  // ============================================================
  // FORMAT CODE
  // ============================================================

  function formatSessionCode(
    code: string
  ) {
    if (code.length === 6) {
      return `${code.slice(
        0,
        3
      )} ${code.slice(3)}`;
    }

    return code;
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <DashboardShell footerNote="Live quiz workspace">
        <div className="cp-state-wrap">
          <div className="cp-state">
            <span className="live-dot" aria-hidden="true" />
            <p className="cp-sticker">Live Quiz</p>
            <h1 className="cp-h-card">Loading lobby...</h1>
            <p className="cp-state__msg">
              Connecting to the live session.
            </p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (
    !quiz ||
    !session
  ) {
    return (
      <DashboardShell footerNote="Live quiz workspace">
        <div className="cp-state-wrap">
          <div className="cp-state cp-state--error">
            <p className="cp-sticker">Live Quiz</p>
            <h1 className="cp-h-card">Lobby unavailable</h1>
            <p className="cp-state__msg">
              {errorMessage ||
                "No active session was found."}
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

  // ============================================================
  // UI
  // ============================================================

  return (
    <DashboardShell footerNote="Live quiz workspace">

      {/* Hero (acts as the page header) */}
      <header className="cp-hero cp-hero--sky">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <p className="cp-sticker">{quiz.subject}</p>

            <h2 className="cp-h-hero">{quiz.title}</h2>

            <p className="cp-hero__sub">
              Real-time classroom quiz
            </p>
          </div>

          <div className="cp-hero__pills">
            <span className="ui-pill ui-pill-dark">
              <span className="live-dot" aria-hidden="true" />
              Live Quiz
            </span>

            <Link
              href="/quizzes"
              className="ui-button ui-button-secondary ui-button-sm"
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Link>
          </div>
        </div>
      </header>

      {/* Session facts */}
      <section className="cp-grid-3" aria-label="Session">

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Session Code</p>
            <span className="cp-stat__icon cp-stat__icon--yellow" aria-hidden="true">
              <KeyRound />
            </span>
          </div>

          <p className="cp-pin">
            {formatSessionCode(
              session.session_code
            )}
          </p>

          <p className="cp-stat__caption">
            Join code for this session
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Joined</p>
            <span className="cp-stat__icon cp-stat__icon--sky" aria-hidden="true">
              <Users />
            </span>
          </div>

          <p className="cp-stat__value">{participantCount}</p>

          <p className="cp-stat__caption">
            {participantCount === 1
              ? "student"
              : "students"}{" "}
            joined
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Status</p>
            <span className="cp-stat__icon cp-stat__icon--mint" aria-hidden="true">
              <Radio />
            </span>
          </div>

          <p className="cp-stat__value cp-stat__value--sm capitalize">
            {session.status}
          </p>

          <p className="cp-stat__caption">
            Session state
          </p>
        </div>

      </section>

      {/* Before Join */}
      {!joined && (
        <section className="cp-card p-6 md:p-8" aria-labelledby="join-title">
          <div className="cp-grid-2 items-center">

            <div className="min-w-0">
              <p className="cp-sticker">Join Session</p>

              <h2 id="join-title" className="cp-h-card mt-3">
                Enter your name
              </h2>

              <p className="cp-text mt-2">
                Your name will appear on the live leaderboard.
              </p>
            </div>

            <div className="min-w-0">
              <label htmlFor="student-name" className="ui-label block">
                Student name
              </label>

              <input
                id="student-name"
                type="text"
                value={
                  studentName
                }
                onChange={(
                  event
                ) =>
                  setStudentName(
                    event.target
                      .value
                  )
                }
                placeholder="Enter your name"
                maxLength={40}
                className="ui-input mt-2"
              />

              <button
                onClick={
                  joinQuiz
                }
                disabled={
                  joining ||
                  !studentName.trim()
                }
                className="ui-button ui-button-primary ui-button-lg ui-button-block mt-4"
              >
                {joining
                  ? "Joining..."
                  : "Join Live Quiz"}
                <ArrowRight aria-hidden="true" />
              </button>

              {errorMessage && (
                <p className="ui-error mt-3">
                  {
                    errorMessage
                  }
                </p>
              )}
            </div>

          </div>
        </section>
      )}

      {/* After Join */}
      {joined && (
        <section className="cp-card cp-card--mint p-6 md:p-8">
          <div className="cp-hero__row">

            <div className="flex min-w-0 items-start gap-5">
              <div className="result-icon result-icon-filled shrink-0" aria-hidden="true">
                <Check />
              </div>

              <div className="min-w-0">
                <p className="cp-sticker">Joined Successfully</p>

                <h2 className="cp-h-card mt-3">
                  You&apos;re in,{" "}
                  {studentName}
                </h2>

                <p className="cp-text mt-2">
                  Stay on this page. The quiz will begin automatically.
                </p>
              </div>
            </div>

            <div className="cp-hero__pills">
              <span className="ui-pill ui-pill-hero">
                <span className="live-dot" aria-hidden="true" />
                Waiting for faculty to start...
              </span>
            </div>

          </div>
        </section>
      )}

    </DashboardShell>
  );
}
