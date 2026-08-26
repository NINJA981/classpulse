import React, { useEffect, useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  Tv2,
  Users,
  Clock,
  Trophy,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

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
            origin: { y: 0.6 }
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFinished]);

  return (
    <div className="min-h-[82vh] rounded-3xl bg-white p-6 md:p-8 border border-slate-200 text-slate-900 flex flex-col justify-between relative overflow-hidden shadow-sm">
      {/* Background Subtle Accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-slate-100/60 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar for Projector */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 z-10">
        <div className="flex items-center gap-4">
          <div className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-extrabold text-sm tracking-wide flex items-center gap-2 shadow-xs">
            <Tv2 className="w-4 h-4" />
            <span>Classroom Projector View</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{currentQuiz.title}</h2>
        </div>

        {/* Live Timer & Connected Students Counter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 text-slate-800">
            <Users className="w-5 h-5 text-indigo-600" />
            <span className="font-mono font-bold text-base">{quizState.connectedStudents} Connected</span>
          </div>

          <div
            className={`flex items-center gap-2 px-5 py-2 rounded-2xl border font-mono font-extrabold text-lg ${
              timeLeft <= 10
                ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-6 z-10 items-center">
        {/* Question & Options Area (Left 8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-widest">
              <span>Question {activeQuestionIndex + 1} of {currentQuiz.questions.length}</span>
              <span>•</span>
              <span>10 Points</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-snug">
              {currentQ.question}
            </h1>
          </div>

          {/* Option Grid for Students */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentQ.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const responseCount = quizState.studentAnswers[`Q${activeQuestionIndex + 1}`]?.[letter] || 8;
              const isCorrect = i === currentQ.correctAnswer;

              return (
                <div
                  key={i}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                    isFinished && isCorrect
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-md'
                      : 'bg-slate-50/80 border-slate-200 text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-xl font-extrabold text-sm flex items-center justify-center ${isFinished && isCorrect ? 'bg-emerald-700 text-white' : 'bg-indigo-600 text-white'}`}>
                        {letter}
                      </span>
                      <span className={`text-base font-bold ${isFinished && isCorrect ? 'text-emerald-950' : 'text-slate-900'}`}>{opt}</span>
                    </div>

                    {isFinished && isCorrect && (
                      <CheckCircle className="w-5 h-5 text-emerald-700" />
                    )}
                  </div>

                  {/* Live Response Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600 font-mono font-medium">
                      <span>Live Votes</span>
                      <span>{responseCount} students ({Math.round((responseCount / 38) * 100)}%)</span>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
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
        <div className="lg:col-span-4 bg-slate-50 rounded-3xl p-6 border border-slate-200 text-center space-y-4 flex flex-col items-center justify-center shadow-xs">
          <div className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200">
            Scan QR Code to Join
          </div>

          {/* Rendered QR Code */}
          {qrCanvasUrl ? (
            <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
              <img src={qrCanvasUrl} alt="ClassPulse Join QR Code" className="w-44 h-44 rounded-xl" />
            </div>
          ) : (
            <div className="w-44 h-44 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
              Generating QR...
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs text-slate-500 font-medium">Join URL on phone browser:</p>
            <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 font-mono font-extrabold text-lg text-indigo-700 tracking-wider shadow-xs">
              classpulse.live/j/<span className="text-emerald-600">CP-8492</span>
            </div>
            <p className="text-[11px] text-slate-500">Enter nickname to participate</p>
          </div>
        </div>
      </div>

      {/* Footer Question Switcher */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 z-10">
        <div className="flex items-center gap-2">
          {currentQuiz.questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveQuestionIndex(idx)}
              className={`w-9 h-9 rounded-xl font-bold text-xs transition cursor-pointer ${
                activeQuestionIndex === idx
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Q{idx + 1}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {activeQuestionIndex < currentQuiz.questions.length - 1 ? (
            <button
              onClick={() => setActiveQuestionIndex(activeQuestionIndex + 1)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <span>Next Question</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
              <Trophy className="w-4 h-4 text-emerald-600" />
              <span>Session Completed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
