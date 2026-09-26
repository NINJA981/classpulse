"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  KeyRound,
  Sparkles,
  Trophy,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import Link from "next/link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ||
  (typeof window !== "undefined" ? `http://${window.location.hostname}:4000` : "http://localhost:4000");

interface ActiveQuestion {
  questionIndex: number;
  totalQuestions: number;
  stem: string;
  stemLocal?: string;
  options: string[];
  optionsLocal?: string[];
  timeLimitSec: number;
}

function LiveArenaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryPin = searchParams.get("pin") || "";
  const queryName = searchParams.get("name") || "";

  const [pin, setPin] = useState(queryPin);
  const [studentName, setStudentName] = useState(queryName || "Student");
  const [joined, setJoined] = useState(false);
  const [stage, setStage] = useState<"enter_pin" | "lobby" | "question" | "answer_feedback" | "leaderboard" | "game_over">("enter_pin");

  const [sessionTitle, setSessionTitle] = useState("Live Classroom Quiz");
  const [participantsCount, setParticipantsCount] = useState(1);
  const [participants, setParticipants] = useState<Array<{ studentId: string; studentName: string; score: number }>>([]);

  const [currentQuestion, setCurrentQuestion] = useState<ActiveQuestion | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerLocked, setAnswerLocked] = useState(false);

  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
    totalScore: number;
    streak: number;
    correctIndex: number;
    explanation: string;
    explanationLocal?: string;
  } | null>(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [podium, setPodium] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [useVernacular, setUseVernacular] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const studentIdRef = useRef<string>("");

  // Auto-connect if PIN is present in URL
  useEffect(() => {
    if (queryPin) {
      handleJoinRoom(queryPin, studentName);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const handleJoinRoom = (roomPin: string, name: string) => {
    if (!roomPin.trim()) {
      setErrorMessage("Please enter a valid 6-digit PIN.");
      return;
    }

    setErrorMessage("");

    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Student Socket] Connected to Live Game");
      socket.emit("quiz:join", {
        pin: roomPin.trim(),
        studentName: name.trim() || "Student",
        studentId: socket.id,
      });
    });

    socket.on("quiz:joined_success", (data) => {
      setJoined(true);
      setSessionTitle(data.title);
      setPin(data.pin);
      if (data.studentId) {
        studentIdRef.current = data.studentId;
      }

      if (data.status === "in_progress") {
        setStage("question");
      } else {
        setStage("lobby");
      }
    });

    socket.on("quiz:player_joined", (data) => {
      setParticipantsCount(data.participantsCount);
      setParticipants(data.participants || []);
    });

    socket.on("quiz:question_started", (q: ActiveQuestion) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentQuestion(q);
      setSelectedOption(null);
      setAnswerLocked(false);
      setFeedback(null);
      setTimeLeft(q.timeLimitSec || 20);
      setStage("question");

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on("quiz:answer_result", (result) => {
      setFeedback(result);
      setScore(result.totalScore);
      setStreak(result.streak);
      setStage("answer_feedback");
    });

    socket.on("quiz:leaderboard_snapshot", (data) => {
      setLeaderboard(data.leaderboard || []);
      setStage("leaderboard");
    });

    socket.on("quiz:game_over", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setPodium(data.podium || []);
      setLeaderboard(data.leaderboard || []);
      setStage("game_over");
    });

    socket.on("quiz:error", (err) => {
      setErrorMessage(err.message || "Failed to join live quiz.");
    });
  };

  const handleSelectOption = (index: number) => {
    if (answerLocked || timeLeft <= 0 || !currentQuestion || !socketRef.current) return;

    setSelectedOption(index);
    setAnswerLocked(true);

    socketRef.current.emit("quiz:submit_answer", {
      pin,
      studentId: studentIdRef.current || socketRef.current.id,
      studentName,
      questionIndex: currentQuestion.questionIndex,
      selectedOption: index,
      timeRemainingSec: timeLeft,
    });
  };

  // Card background styling based on classic gamified palette
  const optionColors = [
    { bg: "bg-red-500", hover: "hover:bg-red-600", border: "border-red-600", symbol: "▲", label: "A" },
    { bg: "bg-blue-500", hover: "hover:bg-blue-600", border: "border-blue-600", symbol: "◆", label: "B" },
    { bg: "bg-amber-500", hover: "hover:bg-amber-600", border: "border-amber-600", symbol: "●", label: "C" },
    { bg: "bg-emerald-500", hover: "hover:bg-emerald-600", border: "border-emerald-600", symbol: "■", label: "D" },
  ];

  return (
    <DashboardShell footerNote="Live In-Class Quiz Arena">
      {/* 1. ENTER PIN SCREEN */}
      {stage === "enter_pin" && (
        <div className="mx-auto max-w-md py-8">
          <div className="hypercard-static p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 mb-4">
              <Zap size={28} />
            </div>

            <p className="cp-sticker">Live Kahoot-Style Quiz</p>
            <h2 className="cp-h-hero mt-1 text-2xl font-black">Enter Game PIN</h2>
            <p className="cp-hero__sub mt-1 text-sm">
              Enter the 6-digit code shown on the teacher's classroom display.
            </p>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600">
                {errorMessage}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoinRoom(pin, studentName);
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="block text-left text-xs font-bold text-ink/70 mb-1">6-Digit PIN</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 583921"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border-2 border-ink/20 bg-white p-3.5 text-center font-mono text-2xl font-black tracking-widest outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-left text-xs font-bold text-ink/70 mb-1">Your Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Maya S."
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full rounded-xl border-2 border-ink/20 bg-white p-3 text-center text-base font-bold outline-none focus:border-sky-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="ui-button ui-button-primary w-full py-3.5 text-base font-black tracking-wide"
              >
                Join Live Arena →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. LOBBY WAITING SCREEN */}
      {stage === "lobby" && (
        <div className="mx-auto max-w-lg py-8 text-center">
          <div className="hypercard-static p-8">
            <span className="live-dot mx-auto mb-2" />
            <p className="cp-sticker">You are in the lobby!</p>
            <h2 className="cp-h-card mt-2 text-2xl font-black">{sessionTitle}</h2>
            <p className="text-sm text-ink/60 mt-1">Playing as <strong className="text-ink">{studentName}</strong></p>

            <div className="my-6 rounded-2xl border-2 border-dashed border-ink/20 bg-white/70 p-4">
              <span className="text-xs font-black uppercase tracking-wider text-ink/50">Room PIN</span>
              <p className="font-mono text-3xl font-black tracking-widest text-ink mt-0.5">{pin}</p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-bold text-ink/70">
              <Users size={16} />
              <span>{participantsCount} student{participantsCount === 1 ? "" : "s"} waiting for teacher to start…</span>
            </div>

            <div className="mt-8 flex justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]" />
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.4s]" />
            </div>

            <p className="text-xs text-ink/40 mt-4">
              Keep this screen open. When your teacher presses Start, your question buttons will appear immediately!
            </p>
          </div>
        </div>
      )}

      {/* 3. ACTIVE QUESTION SCREEN */}
      {stage === "question" && currentQuestion && (
        <div className="mx-auto max-w-3xl py-4">
          {/* Top HUD */}
          <div className="flex items-center justify-between mb-4">
            <span className="ui-pill ui-pill-dark font-black">
              Q{currentQuestion.questionIndex + 1} of {currentQuestion.totalQuestions}
            </span>

            {/* Countdown timer */}
            <div
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-black text-sm border-2 ${
                timeLeft <= 5 ? "border-red-500 bg-red-50 text-red-600 animate-pulse" : "border-emerald-500 bg-emerald-50 text-emerald-700"
              }`}
            >
              <Clock size={16} />
              <span>{timeLeft}s</span>
            </div>

            <div className="flex items-center gap-3">
              {streak >= 2 && (
                <span className="ui-pill ui-pill-yellow font-black">
                  <Flame size={14} className="text-amber-600" /> {streak} streak!
                </span>
              )}
              <span className="ui-pill ui-pill-mint font-black">{score} pts</span>
            </div>
          </div>

          {/* Question Card */}
          <div className="hypercard-static p-6 text-center mb-6">
            <h3 className="cp-h-card text-xl sm:text-2xl font-black text-balance">
              {useVernacular && currentQuestion.stemLocal ? currentQuestion.stemLocal : currentQuestion.stem}
            </h3>

            {currentQuestion.stemLocal && (
              <button
                type="button"
                onClick={() => setUseVernacular(!useVernacular)}
                className="mt-3 text-xs font-bold text-sky-600 hover:underline cursor-pointer"
              >
                🌐 Toggle {useVernacular ? "English" : "Vernacular"}
              </button>
            )}
          </div>

          {/* 4 Big Kahoot-style buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentQuestion.options.map((opt, idx) => {
              const theme = optionColors[idx % optionColors.length];
              const isSelected = selectedOption === idx;
              const optText = (useVernacular && currentQuestion.optionsLocal?.[idx]) || opt;

              return (
                <button
                  key={idx}
                  disabled={answerLocked || timeLeft <= 0}
                  onClick={() => handleSelectOption(idx)}
                  className={`flex items-center gap-4 rounded-2xl border-4 p-5 text-left text-white shadow-md transition-transform active:scale-95 cursor-pointer ${
                    theme.bg
                  } ${theme.border} ${theme.hover} ${isSelected ? "ring-4 ring-white" : ""}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20 text-lg font-black">
                    {theme.symbol}
                  </span>
                  <span className="text-base sm:text-lg font-bold leading-tight">{optText}</span>
                </button>
              );
            })}
          </div>

          {answerLocked && (
            <div className="mt-6 text-center">
              <span className="ui-pill ui-pill-sky font-bold">
                ✓ Answer submitted! Faster answers earn more points.
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. ANSWER FEEDBACK SCREEN */}
      {stage === "answer_feedback" && feedback && (
        <div className="mx-auto max-w-lg py-8 text-center">
          <div
            className={`hypercard-static p-8 border-4 ${
              feedback.isCorrect ? "border-emerald-500 bg-emerald-50/50" : "border-red-400 bg-red-50/50"
            }`}
          >
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white mb-3 ${
                feedback.isCorrect ? "bg-emerald-500" : "bg-red-500"
              }`}
            >
              {feedback.isCorrect ? <Check size={32} strokeWidth={3} /> : <X size={32} strokeWidth={3} />}
            </div>

            <h2 className="cp-h-hero text-3xl font-black">
              {feedback.isCorrect ? "Correct!" : "Not Quite!"}
            </h2>

            {feedback.isCorrect ? (
              <p className="mt-2 text-base font-black text-emerald-700">
                +{feedback.pointsEarned} Points! {feedback.streak >= 2 ? `🔥 ${feedback.streak} In A Row!` : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm font-bold text-red-700">
                Correct Answer: {currentQuestion?.options[feedback.correctIndex]}
              </p>
            )}

            <div className="my-6 rounded-xl border border-ink/10 bg-white/80 p-4 text-xs text-left">
              <span className="font-bold text-ink/70">Explanation:</span>
              <p className="mt-1 text-ink/90 leading-relaxed">
                {useVernacular && feedback.explanationLocal ? feedback.explanationLocal : feedback.explanation}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-ink/70">
              <span>Total Score: {feedback.totalScore} pts</span>
              <span>Waiting for teacher…</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. LEADERBOARD / STANDINGS SCREEN */}
      {stage === "leaderboard" && (
        <div className="mx-auto max-w-md py-8">
          <div className="hypercard-static p-6 text-center">
            <span className="ui-pill ui-pill-yellow mx-auto mb-2">Round Standings</span>
            <h2 className="cp-h-card text-2xl font-black">Leaderboard</h2>

            <div className="mt-6 space-y-2 text-left">
              {leaderboard.slice(0, 5).map((player, idx) => {
                const isMe = player.studentName === studentName;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between rounded-xl p-3 border ${
                      isMe ? "border-sky-400 bg-sky-50 font-bold" : "border-ink/10 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black w-6">#{idx + 1}</span>
                      <span className="text-sm font-bold">{player.studentName} {isMe && "(You)"}</span>
                      {player.streak >= 2 && (
                        <span className="text-xs text-amber-600 font-bold flex items-center">
                          <Flame size={12} /> {player.streak}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-black text-ink">{player.score} pts</span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-ink/50 mt-6">Next question starting shortly…</p>
          </div>
        </div>
      )}

      {/* 6. GAME OVER / PODIUM SCREEN */}
      {stage === "game_over" && (
        <div className="mx-auto max-w-xl py-6 text-center">
          <div className="hypercard-static p-8 border-4 border-amber-400">
            <span className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700">
              <Sparkles size={16} /> Final Results <Sparkles size={16} />
            </span>
            <h1 className="cp-h-hero text-3xl font-black mt-2">Classroom Podium</h1>

            {/* Podium Display */}
            <div className="flex items-end justify-center gap-4 my-8 h-48">
              {/* 2nd Place */}
              <div className="flex-1 flex flex-col items-center">
                <span className="text-xs font-bold truncate max-w-[90px] mb-1">{podium[1]?.studentName || "—"}</span>
                <span className="text-[11px] font-black text-ink/70 mb-1">{podium[1]?.score || 0} pts</span>
                <div className="w-full h-24 rounded-t-xl bg-slate-400 flex items-center justify-center text-white text-xl font-black">
                  2nd
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex-1 flex flex-col items-center">
                <span className="text-xl mb-0.5">👑</span>
                <span className="text-xs font-bold truncate max-w-[100px] mb-1">{podium[0]?.studentName || "Winner"}</span>
                <span className="text-[11px] font-black text-amber-800 mb-1">{podium[0]?.score || 0} pts</span>
                <div className="w-full h-36 rounded-t-xl bg-amber-400 flex items-center justify-center text-white text-2xl font-black">
                  1st
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex-1 flex flex-col items-center">
                <span className="text-xs font-bold truncate max-w-[90px] mb-1">{podium[2]?.studentName || "—"}</span>
                <span className="text-[11px] font-black text-ink/70 mb-1">{podium[2]?.score || 0} pts</span>
                <div className="w-full h-16 rounded-t-xl bg-amber-700 flex items-center justify-center text-white text-lg font-black">
                  3rd
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-ink/10 bg-white/80 p-4 mb-6">
              <p className="text-sm font-bold text-ink">
                Your Score: <span className="font-black text-sky-600">{score} Points</span>
              </p>
              <p className="text-xs text-ink/60 mt-1">
                Your attempts have been registered to your student diagnostic profile!
              </p>
            </div>

            <button
              onClick={() => router.push("/quizzes")}
              className="ui-button ui-button-primary w-full py-3"
            >
              Back to Quizzes
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function StudentLiveArenaPage() {
  return (
    <Suspense fallback={
      <DashboardShell>
        <div className="flex items-center justify-center p-12 text-center text-ink/60">
          <p className="font-semibold text-sm">Loading live arena...</p>
        </div>
      </DashboardShell>
    }>
      <LiveArenaContent />
    </Suspense>
  );
}
