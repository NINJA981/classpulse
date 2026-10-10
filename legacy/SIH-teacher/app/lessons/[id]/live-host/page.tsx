'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  Users,
  Play,
  ArrowRight,
  Trophy,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowLeft,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../../../../lib/api';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, '') ||
  (typeof window !== 'undefined' ? `http://${window.location.hostname}:4000` : 'http://localhost:4000');

interface Participant {
  studentId: string;
  studentName: string;
  score: number;
  streak?: number;
}

interface HostQuestion {
  questionIndex: number;
  totalQuestions: number;
  stem: string;
  stemLocal?: string;
  options: string[];
  optionsLocal?: string[];
  correctIndex: number;
  explanation: string;
  timeLimitSec: number;
}

export default function TeacherLiveHostPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const lessonId = typeof params.id === 'string' ? params.id : '';
  const initialPin = searchParams.get('pin') || '';

  const [pin, setPin] = useState(initialPin);
  const [sessionTitle, setSessionTitle] = useState('Live Quiz');
  const [status, setStatus] = useState<'lobby' | 'in_progress' | 'leaderboard' | 'ended'>('lobby');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<HostQuestion | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [podium, setPodium] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(!initialPin);

  const socketRef = useRef<Socket | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or fetch session pin
  useEffect(() => {
    let isMounted = true;

    async function initHost() {
      try {
        let activePin = initialPin;
        if (!activePin) {
          const res = await api.createLiveQuizSession(lessonId);
          activePin = res.pin;
          setPin(res.pin);
          setSessionTitle(res.title);
          router.replace(`/lessons/${lessonId}/live-host?pin=${res.pin}`);
        }

        // Connect to Socket.IO
        const socket = io(BACKEND_URL, {
          transports: ['websocket', 'polling']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('[Host] Connected to Live Socket');
          socket.emit('quiz:host_join', { pin: activePin });
        });

        socket.on('quiz:host_joined_ack', (data) => {
          if (!isMounted) return;
          setSessionTitle(data.title);
          setStatus(data.status);
          setParticipants(data.participants || []);
          setLoading(false);
        });

        socket.on('quiz:player_joined', (data) => {
          if (!isMounted) return;
          setParticipants(data.participants || []);
        });

        socket.on('quiz:host_question_active', (q: HostQuestion) => {
          if (!isMounted) return;
          setActiveQuestion(q);
          setStatus('in_progress');
          setAnsweredCount(0);
          setTimeLeft(q.timeLimitSec || 20);

          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        });

        socket.on('quiz:host_answer_update', (data) => {
          if (!isMounted) return;
          setAnsweredCount(data.answeredCount);
        });

        socket.on('quiz:leaderboard_snapshot', (data) => {
          if (!isMounted) return;
          setLeaderboard(data.leaderboard || []);
          setStatus('leaderboard');
        });

        socket.on('quiz:game_over', (data) => {
          if (!isMounted) return;
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setPodium(data.podium || []);
          setLeaderboard(data.leaderboard || []);
          setStatus('ended');
        });
      } catch (err) {
        console.error('[Host] Setup error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (lessonId) {
      initHost();
    }

    return () => {
      isMounted = false;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [lessonId]);

  const handleStartGame = () => {
    if (socketRef.current && pin) {
      socketRef.current.emit('quiz:start', { pin });
    }
  };

  const handleShowLeaderboard = () => {
    if (socketRef.current && pin) {
      socketRef.current.emit('quiz:show_leaderboard', { pin });
    }
  };

  const handleNextQuestion = () => {
    if (socketRef.current && pin) {
      socketRef.current.emit('quiz:next_question', { pin });
    }
  };

  const handleCopyPin = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <span className="badge badge-ink mb-2">INITIALIZING LIVE ARENA</span>
        <h2>Starting live quiz session…</h2>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link href={`/lessons/${lessonId}/review`} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} /> Exit Host Mode
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="status-pill status-pill-ready">● LIVE SESSION</span>
          <span className="badge badge-ink" style={{ fontSize: '13px' }}>{sessionTitle}</span>
        </div>
      </div>

      {/* LOBBY SCREEN */}
      {status === 'lobby' && (
        <div className="card card-solid mb-4" style={{ padding: '2.5rem', textAlign: 'center', border: '3px solid var(--ink)' }}>
          <span className="eyebrow" style={{ fontSize: '14px', letterSpacing: '0.1em' }}>
            STUDENT GAME PIN (JOIN AT HTTP://LOCALHOST:3001/QUIZZES)
          </span>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '1.5rem',
              background: '#f8fafc',
              border: '3px dashed var(--ink)',
              borderRadius: '12px',
              padding: '1rem 3rem',
              margin: '1.5rem 0'
            }}
          >
            <span style={{ fontSize: '4.5rem', fontWeight: 900, letterSpacing: '0.15em', fontFamily: 'monospace', color: 'var(--ink)' }}>
              {pin}
            </span>
            <button
              onClick={handleCopyPin}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {copied ? <Check size={16} color="green" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <p className="text-secondary" style={{ fontSize: '14px', marginBottom: '2rem' }}>
            Students open <strong>Student Portal → Quizzes</strong> and enter this PIN to enter the live waiting lobby.
          </p>

          {/* Joined Players */}
          <div style={{ maxWidth: '800px', margin: '0 auto 2rem auto', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} />
                <span style={{ fontWeight: 800 }}>Joined Players ({participants.length})</span>
              </div>
              {participants.length === 0 && (
                <span className="text-secondary" style={{ fontSize: '12px' }}>Waiting for students to join…</span>
              )}
            </div>

            {participants.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: '#fff', border: '1px solid var(--hairline)', borderRadius: '8px' }}>
                <p className="text-secondary" style={{ fontSize: '13px' }}>
                  No students in the lobby yet. Tell students to join PIN: <strong>{pin}</strong>.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {participants.map((p) => (
                  <span
                    key={p.studentId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: '#fff',
                      border: '2px solid var(--ink)',
                      padding: '8px 16px',
                      borderRadius: '30px',
                      fontWeight: 800,
                      fontSize: '14px',
                      boxShadow: '2px 2px 0px rgba(0,0,0,0.1)'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    {p.studentName}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleStartGame}
            disabled={participants.length === 0}
            className="btn btn-primary btn-lg"
            style={{
              padding: '1rem 3rem',
              fontSize: '1.25rem',
              fontWeight: 900,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Play size={22} />
            Start Live Quiz Now ({participants.length} Players)
          </button>
        </div>
      )}

      {/* QUESTION IN PROGRESS SCREEN */}
      {status === 'in_progress' && activeQuestion && (
        <div>
          {/* Question HUD */}
          <div
            className="card card-solid mb-4"
            style={{
              border: '3px solid var(--ink)',
              padding: '2rem',
              background: '#fff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span className="badge badge-ink" style={{ fontSize: '14px' }}>
                Question {activeQuestion.questionIndex + 1} of {activeQuestion.totalQuestions}
              </span>

              {/* Countdown circle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: timeLeft <= 5 ? '#fef2f2' : '#f0fdf4',
                  color: timeLeft <= 5 ? '#dc2626' : '#15803d',
                  border: `2px solid ${timeLeft <= 5 ? '#dc2626' : '#15803d'}`,
                  borderRadius: '30px',
                  padding: '6px 18px',
                  fontWeight: 900,
                  fontSize: '1.2rem'
                }}
              >
                <Clock size={20} />
                <span>{timeLeft}s</span>
              </div>

              {/* Answered counter */}
              <span style={{ fontWeight: 800, fontSize: '14px' }}>
                Answers: {answeredCount} / {participants.length}
              </span>
            </div>

            {/* Stem */}
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '8px', color: 'var(--ink)' }}>
              {activeQuestion.stem}
            </h2>
            {activeQuestion.stemLocal && (
              <p style={{ fontSize: '1.2rem', color: '#475569', fontWeight: 600, marginBottom: '1.5rem' }}>
                {activeQuestion.stemLocal}
              </p>
            )}

            {/* Options Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
              {activeQuestion.options.map((opt, idx) => {
                const isCorrect = idx === activeQuestion.correctIndex;
                const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'];
                const letter = ['A', 'B', 'C', 'D'][idx] || '';

                return (
                  <div
                    key={idx}
                    style={{
                      border: isCorrect ? '3px solid #10b981' : '2px solid var(--hairline)',
                      background: isCorrect ? '#f0fdf4' : '#fafafa',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <span
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        background: colors[idx % 4],
                        color: '#fff',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px'
                      }}
                    >
                      {letter}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: '15px', margin: 0 }}>{opt}</p>
                      {activeQuestion.optionsLocal?.[idx] && (
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                          {activeQuestion.optionsLocal[idx]}
                        </p>
                      )}
                    </div>
                    {isCorrect && (
                      <span className="status-pill status-pill-ready" style={{ fontWeight: 800 }}>
                        <CheckCircle2 size={14} /> Correct Key
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Teacher Navigation Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              onClick={handleShowLeaderboard}
              className="btn btn-secondary btn-lg"
              style={{ fontWeight: 800 }}
            >
              <Trophy size={18} /> Show Standings
            </button>
            <button
              onClick={handleNextQuestion}
              className="btn btn-primary btn-lg"
              style={{ fontWeight: 800 }}
            >
              Next Question <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* LEADERBOARD VIEW */}
      {status === 'leaderboard' && (
        <div className="card card-solid mb-4" style={{ padding: '2rem', border: '3px solid var(--ink)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span className="eyebrow" style={{ fontSize: '13px' }}>ROUND STANDINGS</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Top Performers</h2>
          </div>

          <div style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leaderboard.slice(0, 5).map((player, idx) => (
              <div
                key={player.studentId || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  background: idx === 0 ? '#fef9c3' : '#fff',
                  border: idx === 0 ? '2px solid #ca8a04' : '1px solid var(--hairline)',
                  borderRadius: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontWeight: 900, fontSize: '18px', width: '24px' }}>#{idx + 1}</span>
                  <span style={{ fontWeight: 800, fontSize: '16px' }}>{player.studentName}</span>
                  {player.streak >= 2 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#ea580c', fontWeight: 800 }}>
                      <Flame size={14} /> {player.streak} streak!
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 900, fontSize: '18px', color: 'var(--ink)' }}>
                  {player.score} pts
                </span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <button
              onClick={handleNextQuestion}
              className="btn btn-primary btn-lg"
              style={{ padding: '0.8rem 2.5rem', fontWeight: 900 }}
            >
              Continue to Next Question <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* FINAL PODIUM (GAME OVER) SCREEN */}
      {status === 'ended' && (
        <div className="card card-solid mb-4" style={{ padding: '3rem 2rem', textAlign: 'center', border: '3px solid var(--ink)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Sparkles size={24} color="#eab308" />
            <span className="eyebrow" style={{ fontSize: '14px', margin: 0 }}>QUIZ CONCLUDED</span>
            <Sparkles size={24} color="#eab308" />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '2.5rem' }}>
            Classroom Champions Podium
          </h1>

          {/* 3-Column Podium */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              gap: '1.5rem',
              maxWidth: '700px',
              margin: '0 auto 3rem auto',
              height: '240px'
            }}
          >
            {/* 2nd Place (Silver) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '14px', marginBottom: '6px' }}>
                {podium[1]?.studentName || '—'}
              </span>
              <span className="badge badge-ink mb-2" style={{ fontSize: '11px' }}>
                {podium[1]?.score || 0} pts
              </span>
              <div
                style={{
                  width: '100%',
                  height: '140px',
                  background: '#94a3b8',
                  borderRadius: '8px 8px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '28px'
                }}
              >
                2nd
              </div>
            </div>

            {/* 1st Place (Gold) */}
            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '24px', marginBottom: '2px' }}>👑</span>
              <span style={{ fontWeight: 900, fontSize: '16px', marginBottom: '6px' }}>
                {podium[0]?.studentName || 'Winner'}
              </span>
              <span className="badge badge-ink mb-2" style={{ fontSize: '12px' }}>
                {podium[0]?.score || 0} pts
              </span>
              <div
                style={{
                  width: '100%',
                  height: '190px',
                  background: '#eab308',
                  borderRadius: '8px 8px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '36px'
                }}
              >
                1st
              </div>
            </div>

            {/* 3rd Place (Bronze) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '14px', marginBottom: '6px' }}>
                {podium[2]?.studentName || '—'}
              </span>
              <span className="badge badge-ink mb-2" style={{ fontSize: '11px' }}>
                {podium[2]?.score || 0} pts
              </span>
              <div
                style={{
                  width: '100%',
                  height: '100px',
                  background: '#d97706',
                  borderRadius: '8px 8px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '24px'
                }}
              >
                3rd
              </div>
            </div>
          </div>

          <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '2rem' }}>
            All live quiz student responses have been saved and merged into this lesson's Concept Gap Heatmap.
          </p>

          <Link href={`/lessons/${lessonId}/review`} className="btn btn-primary btn-lg">
            View Class Concept Heatmap & Submissions →
          </Link>
        </div>
      )}
    </div>
  );
}
