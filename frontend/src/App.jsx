import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";

import Dashboard from "./Dashboard.jsx";
import LessonPlan from "./LessonPlan.jsx";
import ClassView from "./ClassView.jsx";

/* =========================================================
   SAVED LESSON PLANS
========================================================= */

function SavedPlans() {
  const [plans, setPlans] = React.useState([]);

  React.useEffect(() => {
    const loadPlans = () => {
      try {
        const storedPlans = localStorage.getItem(
          "teacherGuideLessonPlans"
        );

        if (!storedPlans) {
          setPlans([]);
          return;
        }

        const parsedPlans = JSON.parse(storedPlans);

        setPlans(Array.isArray(parsedPlans) ? parsedPlans : []);
      } catch (error) {
        console.error("Error loading lesson plans:", error);
        setPlans([]);
      }
    };

    loadPlans();

    window.addEventListener("storage", loadPlans);

    return () => {
      window.removeEventListener("storage", loadPlans);
    };
  }, []);

  const formatDate = (dateValue) => {
    if (!dateValue) return "Recently";

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
          <Link to="/saved-plans">Lesson Plans</Link>
          <Link to="/classes">My Classes</Link>
          <Link to="/resources">Resources</Link>
          <Link to="/quizzes">Quizzes</Link>
          <Link to="/analytics">Analytics</Link>
        </nav>
      </header>

      {/* MAIN */}
      <main className="workspace-container">

        <section className="workspace-heading">
          <div>
            <p className="workspace-eyebrow">
              LESSON LIBRARY
            </p>

            <h1>Saved Lesson Plans</h1>

            <p>
              View and manage all the lesson plans
              you have created.
            </p>
          </div>

          <Link
            to="/lesson-plan"
            className="primary-action"
          >
            + Create Lesson Plan
          </Link>
        </section>

        {/* SUMMARY */}
        <section className="workspace-summary">

          <div>
            <span>SAVED PLANS</span>

            <strong>{plans.length}</strong>

            <p>
              {plans.length === 1
                ? "Lesson plan created"
                : "Lesson plans created"}
            </p>
          </div>

          <div>
            <span>LIBRARY STATUS</span>

            <strong>Ready</strong>

            <p>Stored in this browser</p>
          </div>

        </section>

        {/* EMPTY STATE / PLANS */}
        {plans.length === 0 ? (

          <section className="empty-state">

            <div className="empty-icon">
              +
            </div>

            <p className="workspace-eyebrow">
              EMPTY LIBRARY
            </p>

            <h2>No lesson plans yet</h2>

            <p>
              Create your first lesson plan and it
              will appear here.
            </p>

            <Link
              to="/lesson-plan"
              className="primary-action"
            >
              Create Your First Plan
            </Link>

          </section>

        ) : (

          <section className="plans-grid">

            {plans
              .slice()
              .reverse()
              .map((plan, index) => (

                <article
                  className="plan-card"
                  key={plan.id || index}
                >

                  <div className="plan-card-top">

                    <span className="plan-number">
                      {plan.subject || "Lesson"}
                    </span>

                    <span className="saved-badge">
                      Saved
                    </span>

                  </div>

                  <h2>
                    {plan.title ||
                      "Untitled Lesson Plan"}
                  </h2>

                  <p className="plan-topic">
                    {plan.topic ||
                      "No topic specified"}
                  </p>

                  <div className="plan-details">

                    <div>
                      <span>Subject</span>

                      <strong>
                        {plan.subject ||
                          "Not specified"}
                      </strong>
                    </div>

                    <div>
                      <span>Class</span>

                      <strong>
                        {plan.grade ||
                          "Not specified"}
                      </strong>
                    </div>

                    <div>
                      <span>Duration</span>

                      <strong>
                        {plan.duration
                          ? `${plan.duration} minutes`
                          : "Not specified"}
                      </strong>
                    </div>

                    <div>
                      <span>Created</span>

                      <strong>
                        {formatDate(
                          plan.createdAt ||
                          plan.savedAt
                        )}
                      </strong>
                    </div>

                  </div>

                  <div className="plan-section">
                    <span>
                      Learning Objectives
                    </span>

                    <p>
                      {plan.objectives ||
                        "No objectives added."}
                    </p>
                  </div>

                  <div className="plan-section">
                    <span>Activities</span>

                    <p>
                      {plan.activities ||
                        "No activities added."}
                    </p>
                  </div>

                  <div className="plan-section">
                    <span>Resources</span>

                    <p>
                      {plan.resources ||
                        "No resources added."}
                    </p>
                  </div>

                  <div className="plan-section">
                    <span>Assessment</span>

                    <p>
                      {plan.assessment ||
                        "No assessment added."}
                    </p>
                  </div>

                  <div className="plan-section">
                    <span>Teacher Notes</span>

                    <p>
                      {plan.notes ||
                        "No teacher notes added."}
                    </p>
                  </div>

                </article>
              ))}

          </section>
        )}

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
          <strong>TEACHER GUIDE</strong>

          <span>
            Plan better. Teach smarter. Track progress.
          </span>
        </div>

        <Link to="/">
          Dashboard
        </Link>

      </footer>

    </div>
  );
}


/* =========================================================
   CLASSES
========================================================= */

function Classes() {
  return (
    <div className="page-placeholder">

      <div className="placeholder-card">

        <span className="placeholder-label">
          TEACHER GUIDE
        </span>

        <h1>My Classes</h1>

        <p>
          Organize your classes, students and
          teaching activities in one place.
        </p>

        <Link
          to="/classes/class-a"
          className="placeholder-link"
        >
          View Class A →
        </Link>

      </div>

    </div>
  );
}


/* =========================================================
   RESOURCES
========================================================= */

function Resources() {
  return (
    <div className="page-placeholder">

      <div className="placeholder-card">

        <span className="placeholder-label">
          TEACHER GUIDE
        </span>

        <h1>Resources</h1>

        <p>
          Browse notes, worksheets and teaching
          materials.
        </p>

        <Link
          to="/"
          className="placeholder-link"
        >
          ← Back to Dashboard
        </Link>

      </div>

    </div>
  );
}


/* =========================================================
   QUIZZES
========================================================= */

function Quizzes() {
  return (
    <div className="page-placeholder">

      <div className="placeholder-card">

        <span className="placeholder-label">
          TEACHER GUIDE
        </span>

        <h1>Quizzes</h1>

        <p>
          Create assessments and track student
          performance.
        </p>

        <Link
          to="/"
          className="placeholder-link"
        >
          ← Back to Dashboard
        </Link>

      </div>

    </div>
  );
}


/* =========================================================
   ANALYTICS
========================================================= */

function Analytics() {
  return (
    <div className="page-placeholder">

      <div className="placeholder-card">

        <span className="placeholder-label">
          TEACHER GUIDE
        </span>

        <h1>Analytics</h1>

        <p>
          View student progress, attendance and
          learning analytics.
        </p>

        <Link
          to="/"
          className="placeholder-link"
        >
          ← Back to Dashboard
        </Link>

      </div>

    </div>
  );
}


/* =========================================================
   APP ROUTES
========================================================= */

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={<Dashboard />}
      />

      <Route
        path="/lesson-plan"
        element={<LessonPlan />}
      />

      <Route
        path="/saved-plans"
        element={<SavedPlans />}
      />

      <Route
        path="/classes"
        element={<Classes />}
      />

      <Route
        path="/classes/class-a"
        element={<ClassView />}
      />

      <Route
        path="/resources"
        element={<Resources />}
      />

      <Route
        path="/quizzes"
        element={<Quizzes />}
      />

      <Route
        path="/analytics"
        element={<Analytics />}
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}

export default App;