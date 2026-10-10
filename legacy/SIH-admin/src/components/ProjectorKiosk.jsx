'use client';

import React, { useEffect, useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';

// Celebration stays inside the monochrome system.
const CONFETTI_COLORS = ['#111', '#555', '#999', '#cfcfca'];

export const ProjectorKiosk = () => {
  const { quizState } = useClassPulse();
  const [qrCanvasUrl, setQrCanvasUrl] = useState('');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [isFinished, setIsFinished] = useState(false);

  const currentQuiz = quizState.currentQuiz;
  const currentQ = currentQuiz.questions[activeQuestionIndex];

  // Generate QR Code for join link
  useEffect(() => {
    QRCode.toDataURL('https://classpulse.live/j/CP-8492', { width: 200, margin: 1 })
      .then((url) => setQrCanvasUrl(url))
      .catch((err) => console.error(err));
  }, []);

  // Timer countdown
  useEffect(() => {
    if (isFinished) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsFinished(true);
          // Trigger celebration confetti on projector screen
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: CONFETTI_COLORS
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFinished]);

  const isUrgent = timeLeft <= 10;

  return (
    <div className="cp-card min-h-[82vh] p-6 md:p-8 flex flex-col justify-between gap-[14px]">
      {/* Top Header Bar for Projector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div className="flex flex-wrap items-center gap-4">
          <span className="cp-badge is-ink inline-flex items-center gap-2 h-9 px-3">
            <span>Classroom Projector View</span>
          </span>
          <h2 className="cp-h3">{currentQuiz.title}</h2>
        </div>

        {/* Live Timer & Connected Students Counter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="cp-status inline-flex items-center gap-2">
            <span aria-hidden="true">□</span>
            <span className="font-extrabold text-lead text-ink">{quizState.connectedStudents} Connected</span>
          </div>

          <div
            className={`inline-flex items-center gap-2 border px-4 h-11 font-black tracking-tightest transition ${
              isUrgent
                ? 'bg-ink text-white border-line-strong text-3xl'
                : 'bg-surface-sunken text-ink border-line text-2xl'
            }`}
          >
            <span className={`cp-dot ${isUrgent ? 'is-live bg-white' : ''}`} />
            <span>00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[14px] my-auto items-stretch">
        {/* Question & Options Area (Left 8 Cols) */}
        <div className="lg:col-span-8 cp-stack">
          <div className="cp-card-ink p-8 md:p-10">
            <div className="cp-eyebrow flex items-center gap-2 flex-wrap">
              <span>Question {activeQuestionIndex + 1} of {currentQuiz.questions.length}</span>
              <span>•</span>
              <span>10 Points</span>
            </div>
            <h1 className="cp-h2 text-white">
              {currentQ.question}
            </h1>
          </div>

          {/* Option Grid for Students */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentQ.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const responseCount = quizState.studentAnswers[`Q${activeQuestionIndex + 1}`]?.[letter] || 8;
              const isCorrect = i === currentQ.correctAnswer;
              const revealed = isFinished && isCorrect;

              return (
                <div
                  key={i}
                  className={`cp-option flex-col items-stretch gap-4 p-5 ${revealed ? 'is-correct shadow-hard' : 'border-line'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="cp-chip-letter shrink-0 w-9 h-9 text-lead">
                        {letter}
                      </span>
                      <span className="text-lg font-bold text-ink">{opt}</span>
                    </div>

                    {revealed && (
                      <span className="text-lead font-black shrink-0" role="img" aria-label="Correct answer">✓</span>
                    )}
                  </div>

                  {/* Live Response Bar */}
                  <div className="space-y-1.5">
                    <div className="cp-progress-meta mt-0 text-caption">
                      <span>Live Votes</span>
                      <span>{responseCount} students ({Math.round((responseCount / 38) * 100)}%)</span>
                    </div>
                    <div className="cp-progress is-thick">
                      <span
                        style={{ width: `${(responseCount / 38) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* QR Code & Join Kiosk Card (Right 4 Cols) */}
        <div className="lg:col-span-4 cp-card cp-card-sunken text-center space-y-5 flex flex-col items-center justify-center">
          <span className="cp-badge is-ink">
            Scan QR Code to Join
          </span>

          {/* Rendered QR Code */}
          {qrCanvasUrl ? (
            <div className="cp-card cp-card-static p-3 bg-white">
              <img src={qrCanvasUrl} alt="ClassPulse Join QR Code" className="w-44 h-44 max-w-full" />
            </div>
          ) : (
            <div className="cp-empty is-sm w-44 h-44 min-h-0 p-0 text-caption text-muted">
              Generating QR...
            </div>
          )}

          <div className="space-y-2 w-full">
            <p className="cp-caption font-bold">Join URL on phone browser:</p>
            <div className="cp-card px-4 py-4 bg-white text-ink break-all">
              <span className="block text-caption font-bold text-muted tracking-label">classpulse.live/j/</span>
              <span className="cp-code is-sm block">CP-8492</span>
            </div>
            <p className="cp-caption-2">Enter nickname to participate</p>
          </div>
        </div>
      </div>

      {/* Footer Question Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-line">
        <div className="cp-segment flex flex-wrap">
          {currentQuiz.questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveQuestionIndex(idx)}
              className={`cp-segment-item ${activeQuestionIndex === idx ? 'is-active' : ''}`}
            >
              Q{idx + 1}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {activeQuestionIndex < currentQuiz.questions.length - 1 ? (
            <button
              onClick={() => setActiveQuestionIndex(activeQuestionIndex + 1)}
              className="cp-btn cp-btn-primary flex items-center gap-2"
            >
              <span>Next Question</span>
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <div className="cp-badge is-ink inline-flex items-center gap-2 h-9 px-3">
              <span aria-hidden="true">✓</span>
              <span>Session Completed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
