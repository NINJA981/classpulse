import React from "react";
import { Link } from "react-router-dom";

function App() {
  return (
    <div className="app">

      {/* ========================= */}
      {/* NAVBAR */}
      {/* ========================= */}

      <header className="navbar">

        <div className="logo">
          TEACHER GUIDE
        </div>

        <nav>

          <Link to="/">
            Dashboard
          </Link>

          <Link to="/saved-plans">
            Lesson Plans
          </Link>

          <Link to="/classes">
            My Classes
          </Link>

          <Link to="/resources">
            Resources
          </Link>

          <Link to="/quiz-builder">
            Quizzes
          </Link>

          <Link to="/analytics">
            Analytics
          </Link>

        </nav>

        <div className="teacher">
          Teacher
        </div>

      </header>


      {/* ========================= */}
      {/* MAIN DASHBOARD */}
      {/* ========================= */}

      <main className="dashboard">

        {/* ========================= */}
        {/* HERO */}
        {/* ========================= */}

        <section className="hero">

          <p className="eyebrow">
            TEACHER WORKSPACE
          </p>

          <h1>
            Teach smarter.
            <br />
            Plan better.
          </h1>

          <p className="hero-text">
            Your intelligent workspace for planning lessons,
            managing classes, creating quizzes, organizing
            resources and tracking student progress.
          </p>


          {/* HERO BUTTONS */}

          <div className="hero-buttons">

            <Link
              className="primary-button"
              to="/lesson-plan"
            >
              Create Lesson Plan
            </Link>

            <Link
              className="secondary-button"
              to="/quiz-builder"
            >
              Create Quiz
            </Link>

            <Link
              className="secondary-button"
              to="/resources"
            >
              Explore Resources
            </Link>

          </div>

        </section>


        {/* ========================= */}
        {/* FEATURE GRID */}
        {/* ========================= */}

        <section className="feature-grid">


          {/* LESSON PLANS */}

          <Link
            to="/saved-plans"
            className="feature-card"
          >

            <span className="number">
              01
            </span>

            <h2>
              Lesson Plans
            </h2>

            <p>
              Create structured and engaging lesson
              plans quickly and organize your teaching.
            </p>

            <span className="open">
              Open →
            </span>

          </Link>


          {/* MY CLASSES */}

          <Link
            to="/classes"
            className="feature-card"
          >

            <span className="number">
              02
            </span>

            <h2>
              My Classes
            </h2>

            <p>
              Organize your classes, students and
              teaching activities in one place.
            </p>

            <span className="open">
              Open →
            </span>

          </Link>


          {/* RESOURCES */}

          <Link
            to="/resources"
            className="feature-card"
          >

            <span className="number">
              03
            </span>

            <h2>
              Resources
            </h2>

            <p>
              Manage worksheets, notes, presentations
              and other teaching materials.
            </p>

            <span className="open">
              Open →
            </span>

          </Link>


          {/* QUIZZES */}

          <Link
            to="/quizzes"
            className="feature-card"
          >

            <span className="number">
              04
            </span>

            <h2>
              Quizzes
            </h2>

            <p>
              Create assessments, add questions and
              evaluate student learning easily.
            </p>

            <span className="open">
              Open →
            </span>

          </Link>


          {/* ANALYTICS */}

          <Link
            to="/analytics"
            className="feature-card"
          >

            <span className="number">
              05
            </span>

            <h2>
              Analytics
            </h2>

            <p>
              Track student progress, classroom
              activity and teaching performance.
            </p>

            <span className="open">
              Open →
            </span>

          </Link>


        </section>


        {/* ========================= */}
        {/* QUICK ACTIONS */}
        {/* ========================= */}

        <section className="quick-actions">

          <div className="quick-actions-header">

            <p className="eyebrow">
              QUICK ACTIONS
            </p>

            <h2>
              Start teaching.
            </h2>

          </div>


          <div className="quick-actions-grid">


            {/* CREATE LESSON */}

            <Link
              to="/lesson-plan"
              className="quick-action"
            >

              <span>
                Lesson Plan
              </span>

              <strong>
                +
              </strong>

            </Link>


            {/* CREATE QUIZ */}

            <Link
              to="/quiz-builder"
              className="quick-action"
            >

              <span>
                Quiz
              </span>

              <strong>
                +
              </strong>

            </Link>


            {/* ADD CLASS */}

            <Link
              to="/classes"
              className="quick-action"
            >

              <span>
                Class
              </span>

              <strong>
                +
              </strong>

            </Link>


            {/* RESOURCE */}

            <Link
              to="/resources"
              className="quick-action"
            >

              <span>
                Resource
              </span>

              <strong>
                +
              </strong>

            </Link>


          </div>

        </section>


        {/* ========================= */}
        {/* FOOTER */}
        {/* ========================= */}

        <footer className="dashboard-footer">

          <div>
            TEACHER GUIDE
          </div>

          <p>
            Intelligent workspace for modern teaching.
          </p>

        </footer>


      </main>

    </div>
  );
}

export default App;