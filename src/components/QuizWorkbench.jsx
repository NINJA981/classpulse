'use client';

import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

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

  const isGenerating = quizState.status === 'generating';

  return (
    <>
      {/* Top Banner & Generation Controller */}
      <section className="cp-page-header">
        <div>
          <span className="cp-eyebrow">Quiz workbench</span>
          <h1 className="cp-display">Quiz Generator & Teacher Workbench</h1>
          <p className="cp-lead">
            Synthesizes 4–5 multiple choice questions from classroom transcript. Nothing displays on projector without teacher approval.
          </p>
        </div>

        {/* Prompt Input & Regenerate */}
        <div className="cp-page-actions flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Topic prompt (e.g. Light Reaction)"
            aria-label="Topic prompt"
            className="cp-input h-[46px] flex-1 md:w-72"
          />
          <button
            onClick={regenerateQuiz}
            disabled={isGenerating}
            className="cp-btn cp-btn-secondary flex items-center gap-2 shrink-0"
          >
            {isGenerating && <span className="cp-spinner" aria-hidden="true" />}
            <span>{isGenerating ? 'Generating...' : 'Regenerate'}</span>
          </button>
        </div>
      </section>

      <section className="cp-stack">
        {/* Safety Gate Alert */}
        <div className="cp-alert flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="cp-icon-box shrink-0" aria-hidden="true">✓</span>
            <span className="text-body">
              <strong className="text-ink">Teacher Approval Active:</strong> Review generated questions below before presenting live to the classroom projector.
            </span>
          </div>

          <button
            onClick={launchQuiz}
            className="cp-btn cp-btn-primary flex items-center gap-2 shrink-0"
          >
            <span>Approve & Launch Quiz</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        {/* Question Cards List */}
        <div className="cp-stack">
          {currentQuiz.questions.map((q, idx) => (
            <div
              key={q.id}
              className="cp-card space-y-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="cp-chip-letter shrink-0">
                    Q{idx + 1}
                  </span>
                  <h4 className="cp-h4 text-lead">{q.question}</h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="cp-badge">
                    10 Points
                  </span>
                </div>
              </div>

              {/* Answer Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {q.options.map((optionText, optIdx) => {
                  const isCorrect = q.correctAnswer === optIdx;
                  return (
                    <div
                      key={optIdx}
                      onClick={() => handleCorrectAnswerChange(q.id, optIdx)}
                      className={`cp-option justify-between cursor-pointer hover:border-line-strong ${isCorrect ? 'is-correct' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="cp-chip-letter shrink-0">
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span>{optionText}</span>
                      </div>

                      {isCorrect && (
                        <span className="text-eyebrow font-black uppercase tracking-eyebrow flex items-center gap-1 shrink-0">
                          <span aria-hidden="true">✓</span> Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* AI Explanation preview */}
              <div className="cp-card cp-card-sunken text-caption text-muted leading-relaxed">
                <strong className="cp-detail-label block mb-1.5">Context & Explanation:</strong>
                {q.explanation}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};
