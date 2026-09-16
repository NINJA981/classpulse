import React from "react";
import { Link } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

const savedQuizzes = [
  {
    id: 1,
    title: "AI Basics Quiz",
    subject: "Artificial Intelligence",
    questions: 10,
    status: "Published",
    updated: "Today",
  },
  {
    id: 2,
    title: "Python Fundamentals",
    subject: "Python",
    questions: 15,
    status: "Draft",
    updated: "Yesterday",
  },
  {
    id: 3,
    title: "Machine Learning Basics",
    subject: "Machine Learning",
    questions: 20,
    status: "Published",
    updated: "2 days ago",
  },
];

function SavedQuizzes() {
  return (
    <AppShell>
      <div>
      <header className="page-header">
        <div className="page-header-copy">
          <p className="zine-label">TEACHER WORKSPACE</p>
          <h1>Saved Quizzes</h1>
          <p>
            Manage your saved assessments and quizzes.
          </p>
        </div>

        <div className="page-header-side">
          <Link to="/quizzes" className="ui-button ui-button-primary">
            + Create Quiz
          </Link>
        </div>
      </header>

      <section className="section-block">
        <div className="section-header">
          <div className="section-header-copy">
            <p className="zine-label">QUIZ LIBRARY</p>
            <h2>Your Quizzes</h2>
            <p>View and manage your saved quizzes.</p>
          </div>

          <span className="ui-pill">{savedQuizzes.length} quizzes</span>
        </div>

        <div className="card-grid">
          {savedQuizzes.map((quiz) => (
            <div className="ui-card pad-6" key={quiz.id}>
              <div className="card-top">
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

              <div>
                <h3 className="card-title">{quiz.title}</h3>
                <p className="card-body">
                  {quiz.subject} · {quiz.questions} questions
                </p>
                <p className="text-fine">
                  Updated {quiz.updated}
                </p>
              </div>

              <div className="card-foot">
                <span className="zine-caption">{quiz.subject}</span>

                <Link to="/quizzes" className="text-link">
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
      </div>
    </AppShell>
  );
}

export default SavedQuizzes;
