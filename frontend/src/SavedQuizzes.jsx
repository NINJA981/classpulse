import React from "react";
import { Link } from "react-router-dom";

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
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">TEACHER WORKSPACE</p>
          <h1>Saved Quizzes</h1>
          <p className="page-description">
            Manage your saved assessments and quizzes.
          </p>
        </div>

        <Link to="/quizzes" className="primary-button">
          + Create Quiz
        </Link>
      </div>

      <div className="content-card">
        <div className="section-heading">
          <div>
            <h2>Your Quizzes</h2>
            <p>View and manage your saved quizzes.</p>
          </div>
        </div>

        <div className="quiz-list">
          {savedQuizzes.map((quiz) => (
            <div className="quiz-card" key={quiz.id}>
              <div className="quiz-icon">✓</div>

              <div className="quiz-info">
                <h3>{quiz.title}</h3>
                <p>
                  {quiz.subject} · {quiz.questions} questions
                </p>
                <span className="quiz-updated">
                  Updated {quiz.updated}
                </span>
              </div>

              <div className="quiz-actions">
                <span
                  className={
                    quiz.status === "Published"
                      ? "status status-ready"
                      : "status status-draft"
                  }
                >
                  {quiz.status}
                </span>

                <Link to="/quizzes" className="view-button">
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SavedQuizzes;
