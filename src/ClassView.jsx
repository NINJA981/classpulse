import React from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

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


  const footer = (
    <>
      <div>
        <strong>TEACHER GUIDE</strong>
        <p>Intelligent workspace for modern teaching.</p>
      </div>

      <Link to="/" className="ui-button ui-button-secondary">
        Back to Dashboard →
      </Link>
    </>
  );

  return (
    <AppShell footer={footer}>
      {/* BACK */}
      <div className="classview-back">
        <button
          type="button"
          className="ui-button ui-button-secondary"
          onClick={() => navigate("/classes")}
        >
          ← Back to Classes
        </button>
      </div>

      {/* HERO */}
      <header className="page-header">
        <div className="page-header-copy">
          <p className="zine-label">CLASS DETAILS</p>

          <h1>Class A</h1>

          <p>Mathematics learning group · Grade 8</p>
        </div>

        <div className="page-header-side">
          <button
            type="button"
            className="ui-button ui-button-secondary"
            onClick={() => navigate("/lesson-plan")}
          >
            + Lesson Plan
          </button>

          <button
            type="button"
            className="ui-button ui-button-primary"
            onClick={() => navigate("/quizzes")}
          >
            Create Quiz
          </button>
        </div>
      </header>

      {/* STATS */}
      <section className="stat-grid">
        <div className="hypercard-static stat-tile">
          <p className="zine-label">STUDENTS</p>
          <p className="stat-tile-value">30</p>
          <div className="stat-tile-foot">
            <span>Registered students</span>
          </div>
        </div>

        <div className="hypercard-static stat-tile">
          <p className="zine-label">ATTENDANCE</p>
          <p className="stat-tile-value">96%</p>
          <div className="stat-tile-foot">
            <span>Average attendance</span>
          </div>
        </div>

        <div className="hypercard-static stat-tile">
          <p className="zine-label">PROGRESS</p>
          <p className="stat-tile-value">0%</p>
          <div className="stat-tile-foot">
            <span>Overall completion</span>
          </div>
        </div>

        <div className="hypercard-static stat-tile">
          <p className="zine-label">SUBJECT</p>
          <p className="stat-tile-value">Math</p>
          <div className="stat-tile-foot">
            <span>Grade 8 Mathematics</span>
          </div>
        </div>
      </section>

      {/* TWO COLUMNS */}
      <div className="two-column section-block">
        {/* STUDENTS */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="zine-label">STUDENTS</p>
              <h2>Student roster</h2>
            </div>

            <span className="ui-pill">30 students</span>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Performance</th>
                  <th>Attendance</th>
                </tr>
              </thead>

              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="classview-student">
                        <div className="index-circle index-circle-sm">
                          {student.name.charAt(0)}
                        </div>

                        <div className="classview-student-copy">
                          <strong>{student.name}</strong>
                          <span className="text-fine">
                            Student {student.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="classview-score">
                        <strong>{student.score}%</strong>

                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{ width: `${student.score}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="ui-pill ui-pill-dark">
                        {student.attendance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="classview-table-foot">
            <button type="button" className="text-link">
              View all 30 students →
            </button>
          </div>
        </section>

        {/* CLASS INFORMATION */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="zine-label">CLASS INFORMATION</p>
              <h2>Teaching overview</h2>
            </div>
          </div>

          <div className="detail-grid">
            <div>
              <span>Class name</span>
              <strong>Class A</strong>
            </div>

            <div>
              <span>Subject</span>
              <strong>Mathematics</strong>
            </div>

            <div>
              <span>Grade</span>
              <strong>Grade 8</strong>
            </div>

            <div>
              <span>Students</span>
              <strong>30</strong>
            </div>

            <div>
              <span>Attendance</span>
              <strong>96%</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>
                <span className="ui-pill ui-pill-dark">Active</span>
              </strong>
            </div>
          </div>
        </section>
      </div>

      {/* PROGRESS SECTION */}
      <section className="panel section-block">
        <div className="panel-header">
          <div>
            <p className="zine-label">LEARNING PROGRESS</p>
            <h2>Class performance</h2>
          </div>

          <span className="ui-pill">
            Getting started
          </span>
        </div>

        <div className="classview-overall">
          <div className="progress-meta">
            <span>Overall class progress</span>
            <strong>0%</strong>
          </div>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: "0%" }} />
          </div>
        </div>

        <div className="mini-metrics mini-metrics-4 classview-metrics">
          <div>
            <span>Students</span>
            <strong>30</strong>
          </div>

          <div>
            <span>Completed</span>
            <strong>0</strong>
          </div>

          <div>
            <span>Attendance</span>
            <strong>96%</strong>
          </div>

          <div>
            <span>Lesson Plans</span>
            <strong>2</strong>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="section-block">
        <div className="section-header">
          <div className="section-header-copy">
            <p className="zine-label">QUICK ACTIONS</p>
            <h2>Continue teaching</h2>
          </div>
        </div>

        <div className="card-grid card-grid-4">
          <Link to="/lesson-plan" className="hypercard stat-tile action-tile">
            <p className="zine-label">01</p>
            <h3 className="card-title">Create Lesson Plan</h3>
            <p className="card-body">Plan your next mathematics lesson.</p>

            <div className="stat-tile-foot">
              <span className="text-link">Open →</span>
            </div>
          </Link>

          <Link to="/quizzes" className="hypercard stat-tile action-tile">
            <p className="zine-label">02</p>
            <h3 className="card-title">Create Quiz</h3>
            <p className="card-body">Assess your students' understanding.</p>

            <div className="stat-tile-foot">
              <span className="text-link">Open →</span>
            </div>
          </Link>

          <Link to="/resources" className="hypercard stat-tile action-tile">
            <p className="zine-label">03</p>
            <h3 className="card-title">Browse Resources</h3>
            <p className="card-body">Find teaching material for this class.</p>

            <div className="stat-tile-foot">
              <span className="text-link">Open →</span>
            </div>
          </Link>

          <Link to="/analytics" className="hypercard stat-tile action-tile">
            <p className="zine-label">04</p>
            <h3 className="card-title">View Analytics</h3>
            <p className="card-body">Track class performance and progress.</p>

            <div className="stat-tile-foot">
              <span className="text-link">Open →</span>
            </div>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

export default ClassView;
