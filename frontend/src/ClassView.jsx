import React from "react";
import { Link, useNavigate } from "react-router-dom";

const students = [
  { id: 1, name: "Aarav Sharma", score: 86, attendance: "98%" },
  { id: 2, name: "Ananya Reddy", score: 92, attendance: "100%" },
  { id: 3, name: "Arjun Kumar", score: 78, attendance: "94%" },
  { id: 4, name: "Diya Patel", score: 88, attendance: "97%" },
  { id: 5, name: "Ishaan Rao", score: 74, attendance: "91%" },
  { id: 6, name: "Meera Nair", score: 95, attendance: "100%" },
];

function ClassView() {
  const navigate = useNavigate();

  return (
    <div className="class-view-page">
      {/* TOP NAVIGATION */}
      <header className="class-view-header">
        <div className="class-view-brand">
          <Link to="/" className="brand-main">
            TEACHER GUIDE
          </Link>
          <span>TEACHER WORKSPACE</span>
        </div>

        <nav className="class-view-nav">
          <Link to="/">Dashboard</Link>
          <Link to="/saved-plans">Lesson Plans</Link>
          <Link to="/classes" className="active">
            My Classes
          </Link>
          <Link to="/resources">Resources</Link>
          <Link to="/quizzes">Quizzes</Link>
          <Link to="/analytics">Analytics</Link>
        </nav>

        <div className="class-view-profile">
          <div className="class-view-avatar">H</div>
          <div>
            <strong>Teacher</strong>
            <span>Administrator</span>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="class-view-content">
        {/* BACK */}
        <button
          className="back-button"
          onClick={() => navigate("/classes")}
        >
          ← Back to Classes
        </button>

        {/* HERO */}
        <section className="class-hero">
          <div>
            <p className="class-eyebrow">CLASS DETAILS</p>

            <h1>Class A</h1>

            <p className="class-description">
              Mathematics learning group · Grade 8
            </p>
          </div>

          <div className="class-hero-actions">
            <button
              className="secondary-button"
              onClick={() => navigate("/lesson-plan")}
            >
              + Lesson Plan
            </button>

            <button
              className="primary-button"
              onClick={() => navigate("/quizzes")}
            >
              Create Quiz
            </button>
          </div>
        </section>

        {/* STATS */}
        <section className="class-stats">
          <div className="class-stat-card">
            <span>STUDENTS</span>
            <strong>30</strong>
            <p>Registered students</p>
          </div>

          <div className="class-stat-card">
            <span>ATTENDANCE</span>
            <strong>96%</strong>
            <p>Average attendance</p>
          </div>

          <div className="class-stat-card">
            <span>PROGRESS</span>
            <strong>0%</strong>
            <p>Overall completion</p>
          </div>

          <div className="class-stat-card">
            <span>SUBJECT</span>
            <strong className="subject-value">Math</strong>
            <p>Grade 8 Mathematics</p>
          </div>
        </section>

        {/* TWO COLUMNS */}
        <div className="class-main-grid">
          {/* STUDENTS */}
          <section className="class-panel students-panel">
            <div className="class-panel-header">
              <div>
                <p className="class-eyebrow">STUDENTS</p>
                <h2>Student roster</h2>
              </div>

              <span className="student-count">30 students</span>
            </div>

            <div className="student-table">
              <div className="student-table-header">
                <span>Student</span>
                <span>Performance</span>
                <span>Attendance</span>
              </div>

              {students.map((student) => (
                <div className="student-row" key={student.id}>
                  <div className="student-name">
                    <div className="student-avatar">
                      {student.name.charAt(0)}
                    </div>

                    <div>
                      <strong>{student.name}</strong>
                      <span>Student {student.id}</span>
                    </div>
                  </div>

                  <div className="student-performance">
                    <strong>{student.score}%</strong>

                    <div className="mini-progress">
                      <div
                        className="mini-progress-fill"
                        style={{ width: `${student.score}%` }}
                      />
                    </div>
                  </div>

                  <span className="attendance-badge">
                    {student.attendance}
                  </span>
                </div>
              ))}
            </div>

            <button className="view-students-button">
              View all 30 students →
            </button>
          </section>

          {/* CLASS INFORMATION */}
          <section className="class-panel">
            <div className="class-panel-header">
              <div>
                <p className="class-eyebrow">CLASS INFORMATION</p>
                <h2>Teaching overview</h2>
              </div>
            </div>

            <div className="info-list">
              <div className="info-item">
                <span>Class name</span>
                <strong>Class A</strong>
              </div>

              <div className="info-item">
                <span>Subject</span>
                <strong>Mathematics</strong>
              </div>

              <div className="info-item">
                <span>Grade</span>
                <strong>Grade 8</strong>
              </div>

              <div className="info-item">
                <span>Students</span>
                <strong>30</strong>
              </div>

              <div className="info-item">
                <span>Attendance</span>
                <strong>96%</strong>
              </div>

              <div className="info-item">
                <span>Status</span>
                <strong className="status-active">Active</strong>
              </div>
            </div>
          </section>
        </div>

        {/* PROGRESS SECTION */}
        <section className="class-panel progress-panel">
          <div className="class-panel-header">
            <div>
              <p className="class-eyebrow">LEARNING PROGRESS</p>
              <h2>Class performance</h2>
            </div>

            <span className="progress-label">Getting started</span>
          </div>

          <div className="overall-progress">
            <div className="overall-progress-top">
              <span>Overall class progress</span>
              <strong>0%</strong>
            </div>

            <div className="large-progress">
              <div className="large-progress-fill" />
            </div>
          </div>

          <div className="progress-metrics">
            <div>
              <strong>30</strong>
              <span>Students</span>
            </div>

            <div>
              <strong>0</strong>
              <span>Completed</span>
            </div>

            <div>
              <strong>96%</strong>
              <span>Attendance</span>
            </div>

            <div>
              <strong>2</strong>
              <span>Lesson Plans</span>
            </div>
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="quick-actions-section">
          <div className="class-eyebrow">QUICK ACTIONS</div>

          <h2>Continue teaching</h2>

          <div className="class-quick-grid">
            <Link to="/lesson-plan" className="class-action-card">
              <span className="action-number">01</span>

              <div>
                <strong>Create Lesson Plan</strong>
                <p>Plan your next mathematics lesson.</p>
              </div>

              <span className="action-arrow">→</span>
            </Link>

            <Link to="/quizzes" className="class-action-card">
              <span className="action-number">02</span>

              <div>
                <strong>Create Quiz</strong>
                <p>Assess your students' understanding.</p>
              </div>

              <span className="action-arrow">→</span>
            </Link>

            <Link to="/resources" className="class-action-card">
              <span className="action-number">03</span>

              <div>
                <strong>Browse Resources</strong>
                <p>Find teaching material for this class.</p>
              </div>

              <span className="action-arrow">→</span>
            </Link>

            <Link to="/analytics" className="class-action-card">
              <span className="action-number">04</span>

              <div>
                <strong>View Analytics</strong>
                <p>Track class performance and progress.</p>
              </div>

              <span className="action-arrow">→</span>
            </Link>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="class-view-footer">
        <div>
          <strong>TEACHER GUIDE</strong>
          <p>Intelligent workspace for modern teaching.</p>
        </div>

        <Link to="/">Back to Dashboard →</Link>
      </footer>
    </div>
  );
}

export default ClassView;