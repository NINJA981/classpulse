import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  BrainCircuit,
  RefreshCw,
  CheckCircle2,
  Tv2,
  FileCheck
} from 'lucide-react';

export const QuizWorkbench = () => {
  const { quizState, setQuizState, launchQuiz, regenerateQuiz } = useClassPulse();
  const [customPrompt, setCustomPrompt] = useState('Photosynthesis & Light Reactions');

  const currentQuiz = quizState.currentQuiz;

  const handleOptionChange = (qId, optionIdx, newValue) => {
    const updatedQuestions = currentQuiz.questions.map((q) => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optionIdx] = newValue;
        return { ...q, options: newOptions };
      }
      return q;
    });

    setQuizState((prev) => ({
      ...prev,
      currentQuiz: {
        ...prev.currentQuiz,
        questions: updatedQuestions
      }
    }));
  };

  const handleCorrectAnswerChange = (qId, newCorrectIndex) => {
    const updatedQuestions = currentQuiz.questions.map((q) => {
      if (q.id === qId) {
        return { ...q, correctAnswer: newCorrectIndex };
      }
      return q;
    });

    setQuizState((prev) => ({
      ...prev,
      currentQuiz: {
        ...prev.currentQuiz,
        questions: updatedQuestions
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Generation Controller */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Quiz Generator & Teacher Workbench</h2>
          </div>
          <p className="text-xs text-slate-500">
            Synthesizes 4–5 multiple choice questions from classroom transcript. Nothing displays on projector without teacher approval.
          </p>
        </div>

        {/* Prompt Input & Regenerate */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Topic prompt (e.g. Light Reaction)"
            className="glass-input px-3 py-2 rounded-xl text-xs flex-1 md:w-56 bg-white text-slate-900 border border-slate-300"
          />
          <button
            onClick={regenerateQuiz}
            disabled={quizState.status === 'generating'}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-300 shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${quizState.status === 'generating' ? 'animate-spin' : ''}`} />
            <span>{quizState.status === 'generating' ? 'Generating...' : 'Regenerate'}</span>
          </button>
        </div>
      </div>

      {/* Safety Gate Alert */}
      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-3 text-xs text-indigo-900 shadow-xs">
        <div className="flex items-center gap-2.5">
          <FileCheck className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>
            <strong>Teacher Approval Active:</strong> Review generated questions below before presenting live to the classroom projector.
          </span>
        </div>

        <button
          onClick={launchQuiz}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm flex items-center gap-2 transition cursor-pointer shrink-0"
        >
          <Tv2 className="w-4 h-4" />
          <span>Approve & Launch Quiz</span>
        </button>
      </div>

      {/* Question Cards List */}
      <div className="space-y-4">
        {currentQuiz.questions.map((q, idx) => (
          <div
            key={q.id}
            className="glass-card rounded-2xl p-5 border border-slate-200 space-y-4 hover:border-slate-300 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs">
                  Q{idx + 1}
                </span>
                <h4 className="text-sm font-bold text-slate-900">{q.question}</h4>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-mono font-medium">
                  10 Points
                </span>
              </div>
            </div>

            {/* Answer Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {q.options.map((optionText, optIdx) => {
                const isCorrect = q.correctAnswer === optIdx;
                return (
                  <div
                    key={optIdx}
                    onClick={() => handleCorrectAnswerChange(q.id, optIdx)}
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between cursor-pointer transition ${
                      isCorrect
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-500 shadow-xs font-semibold'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isCorrect ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className={isCorrect ? 'text-emerald-950 font-bold' : 'text-slate-800'}>{optionText}</span>
                    </div>

                    {isCorrect && (
                      <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Correct
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI Explanation preview */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800 block mb-0.5 font-semibold">Context & Explanation:</strong>
              {q.explanation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
