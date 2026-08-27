import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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

  return (
    <div className="quiz-list-page">
      <header className="quiz-list-header">
        <div className="brand-area">
          <Link to="/" className="brand-logo">
            TG
          </Link>

          <div className="brand-text">
            <Link to="/" className="brand-name">
              TEACHER GUIDE
            </Link>

            <span>TEACHER WORKSPACE</span>
          </div>
        </div>

        <nav className="top-navigation">
          <Link to="/">Dashboard</Link>

          <Link to="/saved-plans">Lesson Plans</Link>

          <Link to="/classes">My Classes</Link>

          <Link to="/resources">Resources</Link>

          <Link to="/quizzes" className="active">
            Quizzes
          </Link>

          <Link to="/analytics">Analytics</Link>
        </nav>

        <div className="profile-area">
          <div className="profile-avatar">T</div>

          <div className="profile-details">
            <strong>Teacher</strong>
            <span>Administrator</span>
          </div>
        </div>
      </header>

      <main className="quiz-list-container">
        <section className="quiz-list-hero">
          <div>
            <p className="eyebrow">ASSESSMENT LIBRARY</p>

            <h1>Saved Quizzes</h1>

            <p>
              View, review and manage all the quizzes you have created.
            </p>
          </div>

          <div className="hero-actions">
            {quizzes.length > 0 && (
              <button
                type="button"
                className="delete-all-button"
                onClick={deleteAllQuizzes}
              >
                Delete All
              </button>
            )}

            <Link to="/quizzes" className="create-quiz-button">
              Create Quiz
            </Link>
          </div>
        </section>

        <section className="summary-section">
          <div className="summary-card">
            <span className="summary-label">SAVED QUIZZES</span>

            <strong>{quizzes.length}</strong>

            <span>
              {quizzes.length === 1
                ? "Quiz created"
                : "Quizzes created"}
            </span>
          </div>

          <div className="summary-card">
            <span className="summary-label">LIBRARY STATUS</span>

            <strong>Ready</strong>

            <span>Stored in this browser</span>
          </div>

          <div className="summary-card">
            <span className="summary-label">QUESTIONS</span>

            <strong>
              {quizzes.reduce(
                (total, quiz) => total + getQuestionCount(quiz),
                0
              )}
            </strong>

            <span>Total questions</span>
          </div>
        </section>

        {quizzes.length === 0 ? (
          <section className="empty-library">
            <div className="empty-number">01</div>

            <div className="empty-content">
              <p className="eyebrow">EMPTY LIBRARY</p>

              <h2>No quizzes yet</h2>

              <p>
                Create your first quiz and it will appear here.
              </p>

              <Link to="/quizzes" className="create-quiz-button">
                Create Your First Quiz
              </Link>
            </div>
          </section>
        ) : (
          <section className="quiz-list">
            {quizzes.map((quiz, index) => (
              <article className="quiz-card" key={quiz.id || index}>
                <div className="quiz-number">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="quiz-main">
                  <div className="quiz-top">
                    <span className="quiz-subject">
                      {quiz.subject || "General"}
                    </span>

                    <span className="saved-badge">
                      Saved
                    </span>
                  </div>

                  <h2>
                    {quiz.title || "Untitled Quiz"}
                  </h2>

                  <p className="quiz-description">
                    {quiz.subject || "General"} assessment
                  </p>

                  <div className="quiz-details">
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

                  <div className="question-preview">
                    <span>QUESTION PREVIEW</span>

                    {Array.isArray(quiz.questions) &&
                    quiz.questions.length > 0 ? (
                      <div className="preview-content">
                        <strong>
                          Q1.{" "}
                          {quiz.questions[0].question ||
                            "Question text not available"}
                        </strong>

                        <div className="preview-options">
                          <span>
                            A.{" "}
                            {quiz.questions[0].optionA ||
                              "—"}
                          </span>

                          <span>
                            B.{" "}
                            {quiz.questions[0].optionB ||
                              "—"}
                          </span>

                          <span>
                            C.{" "}
                            {quiz.questions[0].optionC ||
                              "—"}
                          </span>

                          <span>
                            D.{" "}
                            {quiz.questions[0].optionD ||
                              "—"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p>No questions available.</p>
                    )}
                  </div>
                </div>

                <div className="quiz-actions">
                  <button
                    type="button"
                    className="view-button"
                    onClick={() => setSelectedQuiz(quiz)}
                  >
                    View Quiz
                  </button>

                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => deleteQuiz(quiz)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        <div className="back-dashboard">
          <Link to="/">← Back to Dashboard</Link>
        </div>
      </main>

      {selectedQuiz && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedQuiz(null)}
        >
          <div
            className="quiz-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">SAVED QUIZ</p>

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
                className="close-button"
                onClick={() => setSelectedQuiz(null)}
              >
                Close
              </button>
            </div>

            <div className="modal-summary">
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

            <div className="modal-questions">
              {Array.isArray(selectedQuiz.questions) &&
              selectedQuiz.questions.length > 0 ? (
                selectedQuiz.questions.map(
                  (question, index) => (
                    <div
                      className="modal-question"
                      key={index}
                    >
                      <div className="modal-question-header">
                        <span>
                          QUESTION{" "}
                          {String(index + 1).padStart(
                            2,
                            "0"
                          )}
                        </span>

                        <strong>
                          Correct:{" "}
                          {question.correctAnswer ||
                            "A"}
                        </strong>
                      </div>

                      <h3>
                        {question.question ||
                          "Question text not available"}
                      </h3>

                      <div className="modal-options">
                        <div
                          className={
                            question.correctAnswer ===
                            "A"
                              ? "correct-option"
                              : ""
                          }
                        >
                          <span>A</span>
                          <p>
                            {question.optionA ||
                              "—"}
                          </p>
                        </div>

                        <div
                          className={
                            question.correctAnswer ===
                            "B"
                              ? "correct-option"
                              : ""
                          }
                        >
                          <span>B</span>
                          <p>
                            {question.optionB ||
                              "—"}
                          </p>
                        </div>

                        <div
                          className={
                            question.correctAnswer ===
                            "C"
                              ? "correct-option"
                              : ""
                          }
                        >
                          <span>C</span>
                          <p>
                            {question.optionC ||
                              "—"}
                          </p>
                        </div>

                        <div
                          className={
                            question.correctAnswer ===
                            "D"
                              ? "correct-option"
                              : ""
                          }
                        >
                          <span>D</span>
                          <p>
                            {question.optionD ||
                              "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                )
              ) : (
                <p className="no-questions">
                  No questions have been added to this quiz.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="delete-button"
                onClick={() =>
                  deleteQuiz(selectedQuiz)
                }
              >
                Delete Quiz
              </button>

              <button
                type="button"
                className="view-button"
                onClick={() => setSelectedQuiz(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="quiz-list-footer">
        <div>
          <strong>TEACHER GUIDE</strong>

          <span>
            Plan better. Teach smarter. Track progress.
          </span>
        </div>

        <Link to="/">Dashboard</Link>
      </footer>

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f7f7f5;
          color: #111111;
          font-family: Arial, Helvetica, sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .quiz-list-page {
          min-height: 100vh;
          background: #f7f7f5;
        }

        .quiz-list-header {
          min-height: 76px;
          padding: 0 38px;
          background: #ffffff;
          border-bottom: 1px solid #deded9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
        }

        .brand-area {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 205px;
        }

        .brand-logo {
          width: 38px;
          height: 38px;
          border: 1px solid #111111;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .brand-name {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }

        .brand-text span {
          color: #777777;
          font-size: 9px;
          letter-spacing: 1.7px;
        }

        .top-navigation {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          flex: 1;
        }

        .top-navigation a {
          padding: 9px 11px;
          color: #666666;
          font-size: 11px;
          border-radius: 3px;
        }

        .top-navigation a:hover {
          color: #111111;
          background: #f1f1ee;
        }

        .top-navigation a.active {
          color: #ffffff;
          background: #111111;
        }

        .profile-area {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 150px;
          justify-content: flex-end;
        }

        .profile-avatar {
          width: 34px;
          height: 34px;
          border: 1px solid #111111;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }

        .profile-details {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
        }

        .profile-details strong {
          font-size: 12px;
        }

        .profile-details span {
          color: #777777;
          font-size: 10px;
        }

        .quiz-list-container {
          width: 100%;
          max-width: 1250px;
          margin: 0 auto;
          padding: 52px 42px 70px;
        }

        .quiz-list-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 30px;
          margin-bottom: 34px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #777777;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .quiz-list-hero h1 {
          margin: 0;
          font-size: 44px;
          line-height: 1;
          letter-spacing: -2px;
        }

        .quiz-list-hero p:not(.eyebrow) {
          max-width: 650px;
          margin: 15px 0 0;
          color: #6c6c6c;
          font-size: 14px;
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .create-quiz-button,
        .delete-all-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 18px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .create-quiz-button {
          background: #111111;
          color: #ffffff;
          border: 1px solid #111111;
        }

        .create-quiz-button:hover {
          background: #333333;
        }

        .delete-all-button {
          background: #ffffff;
          color: #111111;
          border: 1px solid #ccccca;
        }

        .delete-all-button:hover {
          border-color: #111111;
        }

        .summary-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .summary-card {
          min-height: 115px;
          padding: 22px;
          background: #ffffff;
          border: 1px solid #deded9;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
        }

        .summary-label {
          color: #777777;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.7px;
        }

        .summary-card strong {
          font-size: 27px;
          letter-spacing: -0.5px;
        }

        .summary-card span:last-child {
          color: #777777;
          font-size: 11px;
        }

        .empty-library {
          background: #ffffff;
          border: 1px solid #deded9;
          min-height: 260px;
          padding: 40px;
          display: flex;
          gap: 35px;
          align-items: flex-start;
        }

        .empty-number {
          color: #999999;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .empty-content h2 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.8px;
        }

        .empty-content > p:not(.eyebrow) {
          margin: 10px 0 22px;
          color: #777777;
          font-size: 13px;
        }

        .quiz-list {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .quiz-card {
          background: #ffffff;
          border: 1px solid #deded9;
          padding: 28px;
          display: grid;
          grid-template-columns: 45px minmax(0, 1fr) auto;
          gap: 20px;
        }

        .quiz-number {
          color: #999999;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          padding-top: 3px;
        }

        .quiz-main {
          min-width: 0;
        }

        .quiz-top {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 10px;
        }

        .quiz-subject {
          color: #555555;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .saved-badge {
          border: 1px solid #cfcfca;
          padding: 4px 8px;
          color: #555555;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .quiz-main h2 {
          margin: 0;
          font-size: 23px;
          letter-spacing: -0.6px;
        }

        .quiz-description {
          margin: 7px 0 20px;
          color: #777777;
          font-size: 12px;
        }

        .quiz-details {
          display: grid;
          grid-template-columns: repeat(5, minmax(90px, 1fr));
          gap: 12px;
          border-top: 1px solid #e7e7e3;
          border-bottom: 1px solid #e7e7e3;
          padding: 16px 0;
        }

        .quiz-details div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .quiz-details span {
          color: #888888;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .quiz-details strong {
          font-size: 11px;
          font-weight: 700;
        }

        .question-preview {
          margin-top: 18px;
          padding: 15px 17px;
          background: #fafaf8;
          border: 1px solid #e5e5e0;
        }

        .question-preview > span {
          display: block;
          margin-bottom: 9px;
          color: #888888;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .preview-content strong {
          display: block;
          font-size: 12px;
          line-height: 1.5;
        }

        .preview-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px 20px;
          margin-top: 12px;
          color: #666666;
          font-size: 11px;
        }

        .quiz-actions {
          display: flex;
          flex-direction: column;
          gap: 9px;
          min-width: 105px;
        }

        .view-button,
        .delete-button {
          min-height: 38px;
          padding: 0 14px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .view-button {
          background: #111111;
          color: #ffffff;
          border: 1px solid #111111;
        }

        .view-button:hover {
          background: #333333;
        }

        .delete-button {
          background: #ffffff;
          color: #555555;
          border: 1px solid #ccccca;
        }

        .delete-button:hover {
          color: #111111;
          border-color: #111111;
        }

        .back-dashboard {
          margin-top: 25px;
        }

        .back-dashboard a {
          color: #555555;
          font-size: 11px;
          border-bottom: 1px solid #999999;
          padding-bottom: 4px;
        }

        .back-dashboard a:hover {
          color: #111111;
          border-color: #111111;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.45);
          padding: 30px;
          overflow-y: auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .quiz-modal {
          width: 100%;
          max-width: 900px;
          max-height: calc(100vh - 60px);
          overflow-y: auto;
          background: #ffffff;
          border: 1px solid #cfcfca;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }

        .modal-header {
          padding: 28px 30px;
          border-bottom: 1px solid #e1e1dc;
          display: flex;
          justify-content: space-between;
          gap: 25px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -0.7px;
        }

        .modal-header p:not(.eyebrow) {
          margin: 8px 0 0;
          color: #777777;
          font-size: 12px;
        }

        .close-button {
          height: 36px;
          padding: 0 14px;
          background: #ffffff;
          border: 1px solid #ccccca;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .close-button:hover {
          border-color: #111111;
        }

        .modal-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid #e1e1dc;
        }

        .modal-summary div {
          padding: 18px 22px;
          border-right: 1px solid #e1e1dc;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .modal-summary div:last-child {
          border-right: 0;
        }

        .modal-summary span {
          color: #888888;
          font-size: 9px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .modal-summary strong {
          font-size: 12px;
        }

        .modal-questions {
          padding: 25px 30px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .modal-question {
          border: 1px solid #deded9;
          padding: 20px;
          background: #fafaf8;
        }

        .modal-question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .modal-question-header span {
          color: #777777;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.2px;
        }

        .modal-question-header strong {
          font-size: 10px;
        }

        .modal-question h3 {
          margin: 0 0 18px;
          font-size: 14px;
          line-height: 1.5;
        }

        .modal-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .modal-options > div {
          min-height: 52px;
          padding: 10px;
          background: #ffffff;
          border: 1px solid #ddddda;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .modal-options > div > span {
          width: 23px;
          height: 23px;
          flex: 0 0 23px;
          border: 1px solid #ccccca;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
        }

        .modal-options p {
          margin: 3px 0 0;
          color: #555555;
          font-size: 11px;
          line-height: 1.4;
        }

        .modal-options .correct-option {
          border-color: #111111;
          background: #f2f2ef;
        }

        .modal-options .correct-option > span {
          background: #111111;
          color: #ffffff;
          border-color: #111111;
        }

        .no-questions {
          color: #777777;
          font-size: 12px;
        }

        .modal-footer {
          padding: 20px 30px;
          border-top: 1px solid #e1e1dc;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .quiz-list-footer {
          min-height: 80px;
          padding: 22px 42px;
          background: #ffffff;
          border-top: 1px solid #deded9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .quiz-list-footer div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .quiz-list-footer strong {
          font-size: 10px;
          letter-spacing: 1.5px;
        }

        .quiz-list-footer span {
          color: #777777;
          font-size: 10px;
        }

        .quiz-list-footer > a {
          font-size: 11px;
          border-bottom: 1px solid #999999;
          padding-bottom: 3px;
        }

        @media (max-width: 1050px) {
          .quiz-list-header {
            padding: 0 22px;
          }

          .top-navigation {
            gap: 0;
          }

          .top-navigation a {
            padding: 8px 7px;
            font-size: 10px;
          }

          .quiz-card {
            grid-template-columns: 35px minmax(0, 1fr);
          }

          .quiz-actions {
            grid-column: 2;
            flex-direction: row;
          }

          .quiz-details {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 800px) {
          .quiz-list-header {
            min-height: auto;
            padding: 15px 20px;
            flex-wrap: wrap;
          }

          .top-navigation {
            order: 3;
            width: 100%;
            overflow-x: auto;
            justify-content: flex-start;
          }

          .profile-area {
            min-width: auto;
          }

          .quiz-list-container {
            padding: 32px 20px 50px;
          }

          .quiz-list-hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .summary-section {
            grid-template-columns: 1fr;
          }

          .quiz-card {
            grid-template-columns: 1fr;
            padding: 22px;
          }

          .quiz-number {
            display: none;
          }

          .quiz-details {
            grid-template-columns: 1fr 1fr;
          }

          .preview-options {
            grid-template-columns: 1fr;
          }

          .quiz-actions {
            grid-column: auto;
            width: 100%;
            flex-direction: row;
          }

          .quiz-actions button {
            flex: 1;
          }

          .empty-library {
            padding: 28px;
            flex-direction: column;
            gap: 15px;
          }

          .modal-overlay {
            padding: 12px;
          }

          .quiz-modal {
            max-height: calc(100vh - 24px);
          }

          .modal-summary {
            grid-template-columns: 1fr 1fr;
          }

          .modal-summary div:nth-child(2) {
            border-right: 0;
          }

          .modal-summary div:nth-child(-n + 2) {
            border-bottom: 1px solid #e1e1dc;
          }

          .modal-options {
            grid-template-columns: 1fr;
          }

          .modal-header {
            padding: 22px;
          }

          .modal-questions {
            padding: 20px;
          }

          .modal-footer {
            padding: 18px 20px;
          }

          .quiz-list-footer {
            padding: 20px;
          }
        }

        @media (max-width: 500px) {
          .brand-text {
            display: none;
          }

          .profile-details {
            display: none;
          }

          .quiz-list-hero h1 {
            font-size: 35px;
          }

          .hero-actions {
            width: 100%;
          }

          .hero-actions > * {
            flex: 1;
          }

          .quiz-details {
            grid-template-columns: 1fr;
          }

          .modal-summary {
            grid-template-columns: 1fr;
          }

          .modal-summary div {
            border-right: 0;
            border-bottom: 1px solid #e1e1dc;
          }

          .modal-summary div:last-child {
            border-bottom: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default QuizList;