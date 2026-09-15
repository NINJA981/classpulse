import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

function QuizList() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  useEffect(() => {
    loadQuizzes();

    const handleStorageChange = () => {
      loadQuizzes();
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const loadQuizzes = () => {
    try {
      const stored = localStorage.getItem("teacherGuideQuizzes");

      if (!stored) {
        setQuizzes([]);
        return;
      }

      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        setQuizzes(parsed);
      } else {
        setQuizzes([]);
      }
    } catch (error) {
      console.error("Error loading quizzes:", error);
      setQuizzes([]);
    }
  };

  const deleteQuiz = (quizToDelete) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this quiz?"
    );

    if (!confirmed) {
      return;
    }

    const updatedQuizzes = quizzes.filter(
      (quiz) => quiz.id !== quizToDelete.id
    );

    localStorage.setItem(
      "teacherGuideQuizzes",
      JSON.stringify(updatedQuizzes)
    );

    setQuizzes(updatedQuizzes);
    setSelectedQuiz(null);
  };

  const deleteAllQuizzes = () => {
    if (quizzes.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete all saved quizzes?"
    );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem("teacherGuideQuizzes");

    setQuizzes([]);
    setSelectedQuiz(null);
  };

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "Recently saved";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getQuestionCount = (quiz) => {
    if (!Array.isArray(quiz.questions)) {
      return 0;
    }

    return quiz.questions.length;
  };

  const getDuration = (quiz) => {
    if (!quiz.duration) {
      return "Not specified";
    }

    return String(quiz.duration).toLowerCase().includes("minute")
      ? quiz.duration
      : `${quiz.duration} minutes`;
  };

  const getGrade = (quiz) => {
    return quiz.grade || "Not specified";
  };

  const optionClass = (question, letter) =>
    question.correctAnswer === letter
      ? "quiz-option quiz-option-static quiz-option-correct"
      : "quiz-option quiz-option-static quiz-option-muted";


  const footer = (
    <>
      <div>
        <strong>TEACHER GUIDE</strong>

        <span>
          Plan better. Teach smarter. Track progress.
        </span>
      </div>

      <Link to="/" className="ui-button ui-button-secondary">
        Dashboard
      </Link>
    </>
  );

  return (
    <AppShell footer={footer}>
      <div className="quiz-list-container">
        <header className="page-header">
          <div className="page-header-copy">
            <p className="zine-label">ASSESSMENT LIBRARY</p>

            <h1>Saved Quizzes</h1>

            <p>
              View, review and manage all the quizzes you have created.
            </p>
          </div>

          <div className="page-header-side">
            {quizzes.length > 0 && (
              <button
                type="button"
                className="ui-button ui-button-danger"
                onClick={deleteAllQuizzes}
              >
                Delete All
              </button>
            )}

            <Link to="/quizzes" className="ui-button ui-button-primary">
              Create Quiz
            </Link>
          </div>
        </header>

        <section className="stat-grid">
          <div className="hypercard-static stat-tile">
            <p className="zine-label">SAVED QUIZZES</p>

            <p className="stat-tile-value">{quizzes.length}</p>

            <p className="card-body">
              {quizzes.length === 1
                ? "Quiz created"
                : "Quizzes created"}
            </p>
          </div>

          <div className="hypercard-static stat-tile">
            <p className="zine-label">LIBRARY STATUS</p>

            <p className="stat-tile-value">Ready</p>

            <p className="card-body">Stored in this browser</p>
          </div>

          <div className="hypercard-static stat-tile">
            <p className="zine-label">QUESTIONS</p>

            <p className="stat-tile-value">
              {quizzes.reduce(
                (total, quiz) => total + getQuestionCount(quiz),
                0
              )}
            </p>

            <p className="card-body">Total questions</p>
          </div>
        </section>

        {quizzes.length === 0 ? (
          <section className="empty-block section-block">
            <p className="zine-label">EMPTY LIBRARY</p>

            <h2>No quizzes yet</h2>

            <p>
              Create your first quiz and it will appear here.
            </p>

            <Link to="/quizzes" className="ui-button ui-button-primary">
              Create Your First Quiz
            </Link>
          </section>
        ) : (
          <section className="card-grid section-block">
            {quizzes.map((quiz, index) => (
              <article className="ui-card pad-6" key={quiz.id || index}>
                <div className="card-top">
                  <span className="ui-pill ui-pill-dark">
                    Saved
                  </span>
                </div>

                <p className="zine-label">
                  {quiz.subject || "General"}
                </p>

                <h2 className="card-title">
                  {quiz.title || "Untitled Quiz"}
                </h2>

                <p className="card-body">
                  {quiz.subject || "General"} assessment
                </p>

                <div className="detail-grid">
                  <div>
                    <span>Subject</span>

                    <strong>
                      {quiz.subject || "Not specified"}
                    </strong>
                  </div>

                  <div>
                    <span>Grade</span>

                    <strong>{getGrade(quiz)}</strong>
                  </div>

                  <div>
                    <span>Duration</span>

                    <strong>{getDuration(quiz)}</strong>
                  </div>

                  <div>
                    <span>Questions</span>

                    <strong>
                      {getQuestionCount(quiz)}
                    </strong>
                  </div>

                  <div>
                    <span>Created</span>

                    <strong>
                      {formatDate(quiz.createdAt)}
                    </strong>
                  </div>
                </div>

                <div className="detail-section">
                  <span>QUESTION PREVIEW</span>

                  {Array.isArray(quiz.questions) &&
                  quiz.questions.length > 0 ? (
                    <div>
                      <p>
                        <strong>
                          Q1.{" "}
                          {quiz.questions[0].question ||
                            "Question text not available"}
                        </strong>
                      </p>

                      <p className="text-muted">
                        <span>
                          A.{" "}
                          {quiz.questions[0].optionA ||
                            "—"}
                        </span>
                        <br />
                        <span>
                          B.{" "}
                          {quiz.questions[0].optionB ||
                            "—"}
                        </span>
                        <br />
                        <span>
                          C.{" "}
                          {quiz.questions[0].optionC ||
                            "—"}
                        </span>
                        <br />
                        <span>
                          D.{" "}
                          {quiz.questions[0].optionD ||
                            "—"}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p>No questions available.</p>
                  )}
                </div>

                <div className="card-foot">
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={() => setSelectedQuiz(quiz)}
                  >
                    View Quiz
                  </button>

                  <button
                    type="button"
                    className="ui-button ui-button-danger"
                    onClick={() => deleteQuiz(quiz)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        <div className="back-row">
          <Link to="/" className="ui-button ui-button-secondary">
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {selectedQuiz && (
        <div
          className="ui-modal-overlay"
          onClick={() => setSelectedQuiz(null)}
        >
          <div
            className="ui-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ui-modal-header">
              <div>
                <p className="zine-label">SAVED QUIZ</p>

                <h2>
                  {selectedQuiz.title ||
                    "Untitled Quiz"}
                </h2>

                <p>
                  {selectedQuiz.subject ||
                    "General"}
                  {" · "}
                  {getGrade(selectedQuiz)}
                </p>
              </div>

              <button
                type="button"
                className="ui-button ui-button-secondary ui-button-icon"
                aria-label="Close"
                onClick={() => setSelectedQuiz(null)}
              >
                ×
              </button>
            </div>

            <div className="ui-modal-body">
              <div className="detail-grid">
                <div>
                  <span>Subject</span>

                  <strong>
                    {selectedQuiz.subject ||
                      "Not specified"}
                  </strong>
                </div>

                <div>
                  <span>Grade</span>

                  <strong>
                    {getGrade(selectedQuiz)}
                  </strong>
                </div>

                <div>
                  <span>Duration</span>

                  <strong>
                    {getDuration(selectedQuiz)}
                  </strong>
                </div>

                <div>
                  <span>Questions</span>

                  <strong>
                    {getQuestionCount(selectedQuiz)}
                  </strong>
                </div>
              </div>

              <div className="stack-5">
                {Array.isArray(selectedQuiz.questions) &&
                selectedQuiz.questions.length > 0 ? (
                  selectedQuiz.questions.map(
                    (question, index) => (
                      <div
                        className="ui-card list-row pad-5"
                        key={index}
                      >
                        <div className="list-row-main">
                          <div className="card-top">
                            <span className="zine-label">
                              QUESTION{" "}
                              {String(index + 1).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <span className="ui-pill ui-pill-dark">
                              Correct:{" "}
                              {question.correctAnswer ||
                                "A"}
                            </span>
                          </div>

                          <h3>
                            {question.question ||
                              "Question text not available"}
                          </h3>

                          <div className="stack-3">
                            <div className={optionClass(question, "A")}>
                              <span className="quiz-option-key">A</span>

                              <span className="quiz-option-text">
                                {question.optionA ||
                                  "—"}
                              </span>

                              {question.correctAnswer === "A" && (
                                <span className="quiz-option-mark">✓</span>
                              )}
                            </div>

                            <div className={optionClass(question, "B")}>
                              <span className="quiz-option-key">B</span>

                              <span className="quiz-option-text">
                                {question.optionB ||
                                  "—"}
                              </span>

                              {question.correctAnswer === "B" && (
                                <span className="quiz-option-mark">✓</span>
                              )}
                            </div>

                            <div className={optionClass(question, "C")}>
                              <span className="quiz-option-key">C</span>

                              <span className="quiz-option-text">
                                {question.optionC ||
                                  "—"}
                              </span>

                              {question.correctAnswer === "C" && (
                                <span className="quiz-option-mark">✓</span>
                              )}
                            </div>

                            <div className={optionClass(question, "D")}>
                              <span className="quiz-option-key">D</span>

                              <span className="quiz-option-text">
                                {question.optionD ||
                                  "—"}
                              </span>

                              {question.correctAnswer === "D" && (
                                <span className="quiz-option-mark">✓</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="empty-block">
                    <p className="zine-label">NO QUESTIONS</p>

                    <p>
                      No questions have been added to this quiz.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="ui-modal-footer">
              <button
                type="button"
                className="ui-button ui-button-danger"
                onClick={() =>
                  deleteQuiz(selectedQuiz)
                }
              >
                Delete Quiz
              </button>

              <button
                type="button"
                className="ui-button ui-button-secondary"
                onClick={() => setSelectedQuiz(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default QuizList;
