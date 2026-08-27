import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

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
      <div className="app">
        <header className="navbar">
          <div className="logo">TEACHER GUIDE</div>

          <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/saved-plans">Lesson Plans</Link>
            <Link to="/classes">My Classes</Link>
            <Link to="/resources">Resources</Link>
            <Link to="/quizzes">Quizzes</Link>
            <Link to="/analytics">Analytics</Link>
          </nav>

          <div className="teacher">Teacher</div>
        </header>

        <main className="dashboard">
          <section className="empty-state">
            <div className="empty-number">404</div>

            <h2>Quiz not found.</h2>

            <p>
              The selected quiz could not be found.
            </p>

            <Link
              to="/quizzes"
              className="primary-button"
            >
              ← Back to Quizzes
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const questions = Array.isArray(quiz.questions)
    ? quiz.questions
    : [];

  return (
    <div className="app">

      <header className="navbar">
        <div className="logo">TEACHER GUIDE</div>

        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/saved-plans">Lesson Plans</Link>
          <Link to="/classes">My Classes</Link>
          <Link to="/resources">Resources</Link>
          <Link to="/quizzes">Quizzes</Link>
          <Link to="/analytics">Analytics</Link>
        </nav>

        <div className="teacher">Teacher</div>
      </header>

      <main className="dashboard">

        <section className="hero">
          <p className="eyebrow">TAKE QUIZ</p>

          <h1>
            {quiz.title || "Untitled Quiz"}
          </h1>

          <p className="hero-text">
            {quiz.subject || "General"} •{" "}
            {quiz.grade || "All Grades"} •{" "}
            {quiz.duration || "30 minutes"}
          </p>

          <Link
            to="/quizzes"
            className="secondary-button"
          >
            ← Back to Quizzes
          </Link>
        </section>

        {submitted ? (
          <section className="quiz-section">

            <p className="eyebrow">
              QUIZ RESULT
            </p>

            <h2>
              Quiz Submitted Successfully!
            </h2>

            <div className="analytics-value">
              {score} / {questions.length}
            </div>

            <p className="hero-text">
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

            <div className="quiz-actions">

              <button
                type="button"
                className="primary-button"
                onClick={retakeQuiz}
              >
                Retake Quiz
              </button>

              <Link
                to="/quizzes"
                className="secondary-button"
              >
                Back to Quizzes
              </Link>

              <Link
                to="/analytics"
                className="secondary-button"
              >
                View Analytics
              </Link>

            </div>

          </section>
        ) : (
          <section className="quiz-section">

            <div className="section-number">
              01
            </div>

            <h2>
              Questions
            </h2>

            {questions.map((question, questionIndex) => {

              const options = getOptions(question);

              return (
                <article
                  className="question-card"
                  key={questionIndex}
                >

                  <div className="question-header">
                    <h3>
                      QUESTION {questionIndex + 1}
                    </h3>
                  </div>

                  <h2>
                    {question.question ||
                      "Question"}
                  </h2>

                  {options.length === 0 ? (
                    <p>
                      No answer options available.
                    </p>
                  ) : (
                    <div className="take-quiz-options">

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
                              className={`take-quiz-option ${
                                selected
                                  ? "selected"
                                  : ""
                              }`}
                            >

                              <input
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

                              <span className="option-letter">
                                {letter}
                              </span>

                              <span className="option-text">
                                {option}
                              </span>

                            </label>
                          );
                        }
                      )}

                    </div>
                  )}

                </article>
              );
            })}

            {questions.length > 0 && (
              <div className="quiz-actions">

                <button
                  type="button"
                  className="primary-button"
                  onClick={submitQuiz}
                >
                  Submit Quiz
                </button>

                <Link
                  to="/quizzes"
                  className="secondary-button"
                >
                  Cancel
                </Link>

              </div>
            )}

          </section>
        )}

      </main>
    </div>
  );
}

export default TakeQuiz;
