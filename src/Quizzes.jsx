import React, { useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

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
    <AppShell
      footer={
        <>
          <div>
            <strong>
              TEACHER GUIDE
            </strong>

            <span>
              Intelligent workspace for modern teaching.
            </span>
          </div>

          <Link to="/" className="ui-button ui-button-secondary">
            Dashboard
          </Link>
        </>
      }
    >
      {/* MAIN */}
      <div>

        {/* PAGE HEADING */}
        <header className="page-header">
          <div className="page-header-copy">
            <p className="zine-label">
              ASSESSMENT CENTER
            </p>

            <h1>
              Quizzes
            </h1>

            <p>
              Create assessments and track student performance.
            </p>
          </div>

          <div className="page-header-side">
            <button
              type="button"
              className="ui-button ui-button-primary"
              onClick={() => setShowForm((current) => !current)}
            >
              + Create Quiz
            </button>
          </div>
        </header>

        {/* SUMMARY */}
        <section className="stat-grid">
          <div className="hypercard-static stat-tile">
            <p className="zine-label">
              TOTAL QUIZZES
            </p>

            <p className="stat-tile-value">
              {quizzes.length}
            </p>

            <p className="card-body">
              Assessments created
            </p>
          </div>

          <div className="hypercard-static stat-tile">
            <p className="zine-label">
              PUBLISHED
            </p>

            <p className="stat-tile-value">
              {
                quizzes.filter(
                  (quiz) => quiz.status === "Published"
                ).length
              }
            </p>

            <p className="card-body">
              Ready for students
            </p>
          </div>

          <div className="hypercard-static stat-tile">
            <p className="zine-label">
              DRAFTS
            </p>

            <p className="stat-tile-value">
              {
                quizzes.filter(
                  (quiz) => quiz.status === "Draft"
                ).length
              }
            </p>

            <p className="card-body">
              Still being prepared
            </p>
          </div>
        </section>

        {/* CREATE FORM */}
        {showForm && (
          <section className="panel section-block">
            <div className="panel-header">
              <div>
                <p className="zine-label">
                  NEW ASSESSMENT
                </p>

                <h2>
                  Create a Quiz
                </h2>
              </div>

              <button
                type="button"
                className="ui-button ui-button-secondary ui-button-icon"
                aria-label="Close"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={createQuiz}>
              <div className="form-grid">

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

              <div className="form-actions">
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ui-button ui-button-primary"
                >
                  Create Quiz
                </button>
              </div>
            </form>
          </section>
        )}

        {/* QUIZ LIBRARY */}
        <section className="section-block">

          <div className="section-header">
            <div className="section-header-copy">
              <p className="zine-label">
                QUIZ LIBRARY
              </p>

              <h2>
                Your assessments
              </h2>
            </div>

            <span className="ui-pill">
              {quizzes.length} quizzes
            </span>
          </div>

          {quizzes.length === 0 ? (
            <section className="empty-block">
              <p className="zine-label">
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
                className="ui-button ui-button-primary"
                onClick={() => setShowForm(true)}
              >
                Create Your First Quiz
              </button>

            </section>
          ) : (
            <div className="card-grid">

              {quizzes.map((quiz, index) => (
                <article
                  className="ui-card pad-6"
                  key={quiz.id}
                >

                  <div className="card-top">

                    <span className="zine-label">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span
                      className={
                        quiz.status === "Published"
                          ? "ui-pill ui-pill-dark"
                          : "ui-pill"
                      }
                    >
                      {quiz.status}
                    </span>

                  </div>

                  <h2 className="card-title">
                    {quiz.title}
                  </h2>

                  <p className="card-body">
                    {quiz.subject} · {quiz.grade}
                  </p>

                  <div className="detail-grid">

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

                  <div className="card-foot">

                    <button
                      type="button"
                      className="ui-button ui-button-secondary"
                    >
                      Open Quiz →
                    </button>

                    <button
                      type="button"
                      className="ui-button ui-button-danger"
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
        <section className="section-block">

          <div className="section-header">
            <div className="section-header-copy">
              <p className="zine-label">
                QUICK ACTIONS
              </p>

              <h2>
                Continue teaching
              </h2>
            </div>
          </div>

          <div className="card-grid card-grid-4">

            <Link
              to="/lesson-plan"
              className="hypercard stat-tile action-tile"
            >
              <p className="zine-label">
                01
              </p>

              <h3 className="card-title">
                Create Lesson Plan
              </h3>

              <p className="card-body">
                Plan your next structured lesson.
              </p>

              <div className="stat-tile-foot">
                <span className="text-link">Open →</span>
              </div>
            </Link>

            <Link
              to="/classes"
              className="hypercard stat-tile action-tile"
            >
              <p className="zine-label">
                02
              </p>

              <h3 className="card-title">
                Manage Classes
              </h3>

              <p className="card-body">
                View students and class progress.
              </p>

              <div className="stat-tile-foot">
                <span className="text-link">Open →</span>
              </div>
            </Link>

            <Link
              to="/resources"
              className="hypercard stat-tile action-tile"
            >
              <p className="zine-label">
                03
              </p>

              <h3 className="card-title">
                Browse Resources
              </h3>

              <p className="card-body">
                Find teaching materials.
              </p>

              <div className="stat-tile-foot">
                <span className="text-link">Open →</span>
              </div>
            </Link>

            <Link
              to="/analytics"
              className="hypercard stat-tile action-tile"
            >
              <p className="zine-label">
                04
              </p>

              <h3 className="card-title">
                View Analytics
              </h3>

              <p className="card-body">
                Track student performance.
              </p>

              <div className="stat-tile-foot">
                <span className="text-link">Open →</span>
              </div>
            </Link>

          </div>
        </section>

        {/* BACK */}
        <div className="back-row">
          <Link
            to="/"
            className="ui-button ui-button-secondary"
          >
            ← Back to Dashboard
          </Link>
        </div>

      </div>
    </AppShell>
  );
}

export default Quizzes;