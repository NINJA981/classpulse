import React, { useState } from "react";
import { Link } from "react-router-dom";

const initialQuizzes = [
  {
    id: 1,
    title: "Photosynthesis Quiz",
    subject: "Science",
    grade: "Grade 8",
    questions: 10,
    status: "Published",
  },
  {
    id: 2,
    title: "Algebra Basics",
    subject: "Mathematics",
    grade: "Grade 8",
    questions: 15,
    status: "Published",
  },
  {
    id: 3,
    title: "Fractions Practice",
    subject: "Mathematics",
    grade: "Grade 7",
    questions: 12,
    status: "Draft",
  },
];

function Quizzes() {
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [grade, setGrade] = useState("Grade 8");
  const [questions, setQuestions] = useState("10");

  const createQuiz = (event) => {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    const newQuiz = {
      id: Date.now(),
      title: title.trim(),
      subject,
      grade,
      questions: Number(questions) || 10,
      status: "Draft",
    };

    setQuizzes((current) => [...current, newQuiz]);

    setTitle("");
    setSubject("Mathematics");
    setGrade("Grade 8");
    setQuestions("10");
    setShowForm(false);
  };

  const deleteQuiz = (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this quiz?"
    );

    if (!confirmed) {
      return;
    }

    setQuizzes((current) =>
      current.filter((quiz) => quiz.id !== id)
    );
  };

  return (
    <div className="workspace-page">
      {/* HEADER */}
      <header className="workspace-header">
        <div>
          <Link to="/" className="workspace-brand">
            TEACHER GUIDE
          </Link>

          <div className="workspace-subtitle">
            TEACHER WORKSPACE
          </div>
        </div>

        <nav className="workspace-navigation">
          <Link to="/">Dashboard</Link>

          <Link to="/saved-plans">
            Lesson Plans
          </Link>

          <Link to="/classes">
            My Classes
          </Link>

          <Link to="/resources">
            Resources
          </Link>

          <Link to="/quizzes">
            Quizzes
          </Link>

          <Link to="/analytics">
            Analytics
          </Link>
        </nav>
      </header>

      {/* MAIN */}
      <main className="workspace-container">

        {/* PAGE HEADING */}
        <section className="workspace-heading">
          <div>
            <p className="workspace-eyebrow">
              ASSESSMENT CENTER
            </p>

            <h1>
              Quizzes
            </h1>

            <p>
              Create assessments and track student performance.
            </p>
          </div>

          <button
            type="button"
            className="primary-action"
            onClick={() => setShowForm((current) => !current)}
          >
            + Create Quiz
          </button>
        </section>

        {/* SUMMARY */}
        <section className="workspace-summary">
          <div>
            <span>
              TOTAL QUIZZES
            </span>

            <strong>
              {quizzes.length}
            </strong>

            <p>
              Assessments created
            </p>
          </div>

          <div>
            <span>
              PUBLISHED
            </span>

            <strong>
              {
                quizzes.filter(
                  (quiz) => quiz.status === "Published"
                ).length
              }
            </strong>

            <p>
              Ready for students
            </p>
          </div>

          <div>
            <span>
              DRAFTS
            </span>

            <strong>
              {
                quizzes.filter(
                  (quiz) => quiz.status === "Draft"
                ).length
              }
            </strong>

            <p>
              Still being prepared
            </p>
          </div>
        </section>

        {/* CREATE FORM */}
        {showForm && (
          <section className="quiz-form-card">
            <div className="quiz-form-header">
              <div>
                <p className="workspace-eyebrow">
                  NEW ASSESSMENT
                </p>

                <h2>
                  Create a Quiz
                </h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={createQuiz}>
              <div className="quiz-form-grid">

                <div className="form-field">
                  <label htmlFor="quiz-title">
                    Quiz Title
                  </label>

                  <input
                    id="quiz-title"
                    type="text"
                    value={title}
                    onChange={(event) =>
                      setTitle(event.target.value)
                    }
                    placeholder="Example: Algebra Basics"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="quiz-subject">
                    Subject
                  </label>

                  <select
                    id="quiz-subject"
                    value={subject}
                    onChange={(event) =>
                      setSubject(event.target.value)
                    }
                  >
                    <option>
                      Mathematics
                    </option>

                    <option>
                      Science
                    </option>

                    <option>
                      English
                    </option>

                    <option>
                      Computer Science
                    </option>

                    <option>
                      Social Science
                    </option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="quiz-grade">
                    Class
                  </label>

                  <select
                    id="quiz-grade"
                    value={grade}
                    onChange={(event) =>
                      setGrade(event.target.value)
                    }
                  >
                    <option>
                      Grade 6
                    </option>

                    <option>
                      Grade 7
                    </option>

                    <option>
                      Grade 8
                    </option>

                    <option>
                      Grade 9
                    </option>

                    <option>
                      Grade 10
                    </option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="quiz-questions">
                    Number of Questions
                  </label>

                  <input
                    id="quiz-questions"
                    type="number"
                    min="1"
                    max="100"
                    value={questions}
                    onChange={(event) =>
                      setQuestions(event.target.value)
                    }
                  />
                </div>

              </div>

              <div className="quiz-form-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-action"
                >
                  Create Quiz
                </button>
              </div>
            </form>
          </section>
        )}

        {/* QUIZ LIBRARY */}
        <section className="quiz-library">

          <div className="library-heading">
            <div>
              <p className="workspace-eyebrow">
                QUIZ LIBRARY
              </p>

              <h2>
                Your assessments
              </h2>
            </div>

            <span className="library-count">
              {quizzes.length} quizzes
            </span>
          </div>

          {quizzes.length === 0 ? (
            <section className="empty-state">

              <div className="empty-icon">
                +
              </div>

              <p className="workspace-eyebrow">
                EMPTY LIBRARY
              </p>

              <h2>
                No quizzes yet
              </h2>

              <p>
                Create your first quiz and it will appear here.
              </p>

              <button
                type="button"
                className="primary-action"
                onClick={() => setShowForm(true)}
              >
                Create Your First Quiz
              </button>

            </section>
          ) : (
            <div className="quiz-grid">

              {quizzes.map((quiz, index) => (
                <article
                  className="quiz-card"
                  key={quiz.id}
                >

                  <div className="quiz-card-top">

                    <span className="quiz-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span
                      className={
                        quiz.status === "Published"
                          ? "quiz-status published"
                          : "quiz-status"
                      }
                    >
                      {quiz.status}
                    </span>

                  </div>

                  <div className="quiz-icon">
                    ✓
                  </div>

                  <h2>
                    {quiz.title}
                  </h2>

                  <p className="quiz-description">
                    {quiz.subject} · {quiz.grade}
                  </p>

                  <div className="quiz-details">

                    <div>
                      <span>
                        Subject
                      </span>

                      <strong>
                        {quiz.subject}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Class
                      </span>

                      <strong>
                        {quiz.grade}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Questions
                      </span>

                      <strong>
                        {quiz.questions}
                      </strong>
                    </div>

                  </div>

                  <div className="quiz-card-footer">

                    <button
                      type="button"
                      className="quiz-open-button"
                    >
                      Open Quiz →
                    </button>

                    <button
                      type="button"
                      className="quiz-delete-button"
                      onClick={() =>
                        deleteQuiz(quiz.id)
                      }
                    >
                      Delete
                    </button>

                  </div>

                </article>
              ))}

            </div>
          )}
        </section>

        {/* QUICK ACTIONS */}
        <section className="quick-actions-section">

          <div className="library-heading">
            <div>
              <p className="workspace-eyebrow">
                QUICK ACTIONS
              </p>

              <h2>
                Continue teaching
              </h2>
            </div>
          </div>

          <div className="quick-actions-grid">

            <Link
              to="/lesson-plan"
              className="quick-action-card"
            >
              <span>
                01
              </span>

              <strong>
                Create Lesson Plan
              </strong>

              <p>
                Plan your next structured lesson.
              </p>

              <b>
                →
              </b>
            </Link>

            <Link
              to="/classes"
              className="quick-action-card"
            >
              <span>
                02
              </span>

              <strong>
                Manage Classes
              </strong>

              <p>
                View students and class progress.
              </p>

              <b>
                →
              </b>
            </Link>

            <Link
              to="/resources"
              className="quick-action-card"
            >
              <span>
                03
              </span>

              <strong>
                Browse Resources
              </strong>

              <p>
                Find teaching materials.
              </p>

              <b>
                →
              </b>
            </Link>

            <Link
              to="/analytics"
              className="quick-action-card"
            >
              <span>
                04
              </span>

              <strong>
                View Analytics
              </strong>

              <p>
                Track student performance.
              </p>

              <b>
                →
              </b>
            </Link>

          </div>
        </section>

        {/* BACK */}
        <div className="workspace-back-container">
          <Link
            to="/"
            className="workspace-back"
          >
            ← Back to Dashboard
          </Link>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="workspace-footer">

        <div>
          <strong>
            TEACHER GUIDE
          </strong>

          <span>
            Intelligent workspace for modern teaching.
          </span>
        </div>

        <Link to="/">
          Dashboard
        </Link>

      </footer>
    </div>
  );
}

export default Quizzes;