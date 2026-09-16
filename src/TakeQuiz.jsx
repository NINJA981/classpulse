import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

function TakeQuiz() {
  const { id } = useParams();

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("teacherGuideQuizzes") || "[]"
      );

      const found = saved.find(
        (item) => String(item.id) === String(id)
      );

      setQuiz(found || null);
    } catch (error) {
      console.error("Quiz loading error:", error);
      setQuiz(null);
    }
  }, [id]);

  const selectAnswer = (questionIndex, letter) => {
    if (submitted) return;

    setAnswers((previous) => ({
      ...previous,
      [questionIndex]: letter,
    }));
  };

  const getOptions = (question) => {
    // New quiz format
    if (Array.isArray(question.options)) {
      return question.options;
    }

    // Your Quiz.jsx format
    return [
      question.optionA || "",
      question.optionB || "",
      question.optionC || "",
      question.optionD || "",
    ].filter((option) => option.trim() !== "");
  };

  const getCorrectAnswer = (question) => {
    // New format
    if (question.answer !== undefined) {
      return String(question.answer).trim();
    }

    // Your Quiz.jsx format
    if (question.correctAnswer !== undefined) {
      return String(question.correctAnswer)
        .replace("Option ", "")
        .trim();
    }

    return "";
  };

  const submitQuiz = () => {
    if (!quiz) return;

    const questions = Array.isArray(quiz.questions)
      ? quiz.questions
      : [];

    if (questions.length === 0) {
      alert("This quiz has no questions.");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (answers[i] === undefined) {
        alert(`Please answer Question ${i + 1}.`);
        return;
      }
    }

    let totalScore = 0;

    questions.forEach((question, index) => {
      const selected = answers[index];
      const correct = getCorrectAnswer(question);

      if (
        selected &&
        correct &&
        selected.toUpperCase() === correct.toUpperCase()
      ) {
        totalScore++;
      }
    });

    const percentage = Math.round(
      (totalScore / questions.length) * 100
    );

    const attempt = {
      id: Date.now().toString(),
      quizId: quiz.id,
      quizTitle: quiz.title || "Untitled Quiz",
      subject: quiz.subject || "",
      grade: quiz.grade || "",
      score: totalScore,
      total: questions.length,
      percentage,
      submittedAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(
        localStorage.getItem("teacherGuideQuizAttempts") || "[]"
      );

      const attempts = Array.isArray(existing)
        ? existing
        : [];

      localStorage.setItem(
        "teacherGuideQuizAttempts",
        JSON.stringify([...attempts, attempt])
      );
    } catch (error) {
      console.error("Could not save attempt:", error);
    }

    setScore(totalScore);
    setSubmitted(true);
  };

  const retakeQuiz = () => {
    setAnswers({});
    setScore(0);
    setSubmitted(false);
  };

  if (!quiz) {
    return (
      <AppShell>
        <div className="app-main-narrow">

          <div className="ui-button-row">
            <Link
              to="/quizzes"
              className="ui-button ui-button-secondary"
            >
              ← Back to Quizzes
            </Link>
          </div>

          <div className="page-center">
            <section className="empty-block">
              <p className="zine-label">TAKE QUIZ</p>

              <h2>Quiz not found.</h2>

              <p>
                The selected quiz could not be found.
              </p>

              <Link
                to="/quizzes"
                className="ui-button ui-button-primary"
              >
                ← Back to Quizzes
              </Link>
            </section>
          </div>

        </div>
      </AppShell>
    );
  }

  const questions = Array.isArray(quiz.questions)
    ? quiz.questions
    : [];

  const answeredCount = questions.filter(
    (_, index) => answers[index] !== undefined
  ).length;

  return (
    <AppShell>

      <div className="app-main-narrow">

        <div className="ui-button-row">
          <Link
            to="/quizzes"
            className="ui-button ui-button-secondary"
          >
            ← Back to Quizzes
          </Link>
        </div>

        <header className="page-header section-block">
          <div className="page-header-copy">
            <p className="zine-label">TAKE QUIZ</p>

            <h1>
              {quiz.title || "Untitled Quiz"}
            </h1>

            <p>
              {quiz.subject || "General"} •{" "}
              {quiz.grade || "All Grades"} •{" "}
              {quiz.duration || "30 minutes"}
            </p>
          </div>

          <div className="page-header-side">
            <span className="ui-pill ui-pill-dark live-label">
              {submitted ? null : <span className="live-dot" />}
              {questions.length} questions
            </span>
          </div>
        </header>

        {submitted ? (
          <section className="stack-card pad-10 text-center quizflow-result">

            <div
              className={
                score === questions.length && questions.length > 0
                  ? "result-icon result-icon-filled"
                  : "result-icon"
              }
            >
              {score > 0 ? "✓" : "0"}
            </div>

            <p className="zine-label">
              QUIZ RESULT
            </p>

            <h2 className="text-section-title">
              Quiz Submitted Successfully!
            </h2>

            <p className="text-stat">
              {score} / {questions.length}
            </p>

            <p className="text-muted quizflow-result-note">
              Your score:{" "}
              <strong>
                {questions.length > 0
                  ? Math.round(
                      (score / questions.length) * 100
                    )
                  : 0}
                %
              </strong>
            </p>

            <div className="ui-button-row">

              <button
                type="button"
                className="ui-button ui-button-primary"
                onClick={retakeQuiz}
              >
                Retake Quiz
              </button>

              <Link
                to="/quizzes"
                className="ui-button ui-button-secondary"
              >
                Back to Quizzes
              </Link>

              <Link
                to="/analytics"
                className="ui-button ui-button-secondary"
              >
                View Analytics
              </Link>

            </div>

          </section>
        ) : (
          <section>

            <div className="section-header">
              <div className="section-header-copy">
                <p className="zine-label">
                  01
                </p>

                <h2>
                  Questions
                </h2>
              </div>

              <span className="ui-pill">
                {answeredCount} / {questions.length}
              </span>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    questions.length > 0
                      ? (answeredCount / questions.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="stack-5 section-block">

            {questions.map((question, questionIndex) => {

              const options = getOptions(question);

              return (
                <article
                  className={
                    questionIndex === 0
                      ? "stack-card pad-6"
                      : "ui-card pad-6"
                  }
                  key={questionIndex}
                >

                  <div className="card-top">
                    <span className="index-circle">
                      {String(questionIndex + 1).padStart(2, "0")}
                    </span>

                    <span className="zine-label">
                      QUESTION {questionIndex + 1}
                    </span>
                  </div>

                  <h3 className="text-question">
                    {question.question ||
                      "Question"}
                  </h3>

                  {options.length === 0 ? (
                    <p className="text-muted quizflow-options">
                      No answer options available.
                    </p>
                  ) : (
                    <div className="card-grid-2 quizflow-options">

                      {options.map(
                        (option, optionIndex) => {

                          const letter =
                            String.fromCharCode(
                              65 + optionIndex
                            );

                          const selected =
                            answers[questionIndex] ===
                            letter;

                          return (
                            <label
                              key={optionIndex}
                              className={`quiz-option ${
                                selected
                                  ? "quiz-option-selected"
                                  : ""
                              }`}
                            >

                              <input
                                className="visually-hidden"
                                type="radio"
                                name={`question-${questionIndex}`}
                                value={letter}
                                checked={selected}
                                onChange={() =>
                                  selectAnswer(
                                    questionIndex,
                                    letter
                                  )
                                }
                              />

                              <span className="quiz-option-key">
                                {letter}
                              </span>

                              <span className="quiz-option-text">
                                {option}
                              </span>

                              {selected && (
                                <span className="quiz-option-mark">
                                  ✓
                                </span>
                              )}

                            </label>
                          );
                        }
                      )}

                    </div>
                  )}

                </article>
              );
            })}

            </div>

            {questions.length > 0 && (
              <div className="ui-button-row back-row">

                <button
                  type="button"
                  className="ui-button ui-button-primary"
                  onClick={submitQuiz}
                >
                  Submit Quiz
                </button>

                <Link
                  to="/quizzes"
                  className="ui-button ui-button-secondary"
                >
                  Cancel
                </Link>

              </div>
            )}

          </section>
        )}

      </div>
    </AppShell>
  );
}

export default TakeQuiz;
