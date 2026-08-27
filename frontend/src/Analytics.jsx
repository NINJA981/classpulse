import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Analytics() {
  const [stats, setStats] = useState({
    students: 0,
    classes: 0,
    lessonPlans: 0,
    resources: 0,
    quizzes: 0,
    quizAttempts: 0,
    averageScore: 0,
  });

  const readArray = (key) => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return [];
    }
  };

  const loadAnalytics = useCallback(() => {
    const classes = readArray("teacherGuideClasses");
    const lessonPlans = readArray("teacherGuideLessonPlans");
    const resources = readArray("teacherGuideResources");
    const quizzes = readArray("teacherGuideQuizzes");
    const attempts = readArray("teacherGuideQuizAttempts");

    // -----------------------------------------
    // TOTAL STUDENTS
    // -----------------------------------------

    const students = classes.reduce(
      (total, item) => {
        return total + Number(item.students || 0);
      },
      0
    );

    // -----------------------------------------
    // AVERAGE QUIZ SCORE
    // -----------------------------------------

    let averageScore = 0;

    if (attempts.length > 0) {
      const percentages = attempts.map((attempt) => {
        // New format
        if (
          attempt.percentage !== undefined &&
          attempt.percentage !== null
        ) {
          return Number(attempt.percentage) || 0;
        }

        // Fallback for older attempts
        const score = Number(attempt.score || 0);
        const total = Number(attempt.total || 0);

        if (total > 0) {
          return (score / total) * 100;
        }

        return 0;
      });

      const totalPercentage = percentages.reduce(
        (total, percentage) => total + percentage,
        0
      );

      averageScore = Math.round(
        totalPercentage / percentages.length
      );
    }

    // -----------------------------------------
    // UPDATE STATE
    // -----------------------------------------

    setStats({
      students,
      classes: classes.length,
      lessonPlans: lessonPlans.length,
      resources: resources.length,
      quizzes: quizzes.length,
      quizAttempts: attempts.length,
      averageScore,
    });
  }, []);

  // -----------------------------------------
  // LOAD ANALYTICS
  // -----------------------------------------

  useEffect(() => {
    loadAnalytics();

    // Runs when localStorage changes
    window.addEventListener("storage", loadAnalytics);

    // Runs when returning to this page/tab
    window.addEventListener("focus", loadAnalytics);

    // Runs when page becomes visible again
    document.addEventListener(
      "visibilitychange",
      loadAnalytics
    );

    return () => {
      window.removeEventListener(
        "storage",
        loadAnalytics
      );

      window.removeEventListener(
        "focus",
        loadAnalytics
      );

      document.removeEventListener(
        "visibilitychange",
        loadAnalytics
      );
    };
  }, [loadAnalytics]);

  return (
    <div className="app">

      {/* =========================================
          NAVBAR
      ========================================= */}

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

          <Link to="/quizzes">
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


      {/* =========================================
          MAIN
      ========================================= */}

      <main className="dashboard">

        {/* =========================================
            HERO
        ========================================= */}

        <section className="hero">

          <p className="eyebrow">
            TEACHER ANALYTICS
          </p>

          <h1>
            Track.
            <br />
            Understand.
          </h1>

          <p className="hero-text">
            Monitor classroom activity, assessments and
            teaching resources from one place.
          </p>

        </section>


        {/* =========================================
            STATISTICS
        ========================================= */}

        <section className="feature-grid">

          {/* STUDENTS */}

          <div className="feature-card">

            <span className="number">
              01
            </span>

            <h2>
              Students
            </h2>

            <p>
              Students registered across your classes.
            </p>

            <span className="analytics-value">
              {stats.students}
            </span>

          </div>


          {/* CLASSES */}

          <div className="feature-card">

            <span className="number">
              02
            </span>

            <h2>
              Classes
            </h2>

            <p>
              Classes currently managed in Teacher Guide.
            </p>

            <span className="analytics-value">
              {stats.classes}
            </span>

          </div>


          {/* LESSON PLANS */}

          <div className="feature-card">

            <span className="number">
              03
            </span>

            <h2>
              Lesson Plans
            </h2>

            <p>
              Lesson plans created and saved.
            </p>

            <span className="analytics-value">
              {stats.lessonPlans}
            </span>

          </div>


          {/* RESOURCES */}

          <div className="feature-card">

            <span className="number">
              04
            </span>

            <h2>
              Resources
            </h2>

            <p>
              Teaching materials available.
            </p>

            <span className="analytics-value">
              {stats.resources}
            </span>

          </div>


          {/* QUIZZES */}

          <div className="feature-card">

            <span className="number">
              05
            </span>

            <h2>
              Quizzes
            </h2>

            <p>
              Assessments created for students.
            </p>

            <span className="analytics-value">
              {stats.quizzes}
            </span>

          </div>


          {/* ATTEMPTS */}

          <div className="feature-card">

            <span className="number">
              06
            </span>

            <h2>
              Quiz Attempts
            </h2>

            <p>
              Completed quiz attempts recorded.
            </p>

            <span className="analytics-value">
              {stats.quizAttempts}
            </span>

          </div>


          {/* AVERAGE SCORE */}

          <div className="feature-card">

            <span className="number">
              07
            </span>

            <h2>
              Average Score
            </h2>

            <p>
              Average percentage from completed quizzes.
            </p>

            <span className="analytics-value">
              {stats.averageScore}%
            </span>

          </div>

        </section>


        {/* =========================================
            CLASSROOM OVERVIEW
        ========================================= */}

        <section className="quiz-section">

          <p className="section-number">
            CLASSROOM OVERVIEW
          </p>

          <h2>
            Teaching Activity
          </h2>


          <div className="feature-grid">

            {/* LESSON PLANNING */}

            <div className="feature-card">

              <span className="number">
                01
              </span>

              <h2>
                Lesson Planning
              </h2>

              <p>
                {stats.lessonPlans} plans created
              </p>

              <span className="analytics-value">
                {stats.lessonPlans}
              </span>

            </div>


            {/* CLASSROOM MANAGEMENT */}

            <div className="feature-card">

              <span className="number">
                02
              </span>

              <h2>
                Classroom Management
              </h2>

              <p>
                {stats.classes} classes managed
              </p>

              <span className="analytics-value">
                {stats.classes}
              </span>

            </div>


            {/* TEACHING MATERIALS */}

            <div className="feature-card">

              <span className="number">
                03
              </span>

              <h2>
                Teaching Materials
              </h2>

              <p>
                {stats.resources} resources available
              </p>

              <span className="analytics-value">
                {stats.resources}
              </span>

            </div>


            {/* STUDENT MANAGEMENT */}

            <div className="feature-card">

              <span className="number">
                04
              </span>

              <h2>
                Student Management
              </h2>

              <p>
                {stats.students} students registered
              </p>

              <span className="analytics-value">
                {stats.students}
              </span>

            </div>


            {/* ASSESSMENTS */}

            <div className="feature-card">

              <span className="number">
                05
              </span>

              <h2>
                Assessments
              </h2>

              <p>
                {stats.quizzes} quizzes created
              </p>

              <span className="analytics-value">
                {stats.quizzes}
              </span>

            </div>


            {/* STUDENT PERFORMANCE */}

            <div className="feature-card">

              <span className="number">
                06
              </span>

              <h2>
                Student Performance
              </h2>

              <p>
                {stats.averageScore}% average score
              </p>

              <span className="analytics-value">
                {stats.averageScore}%
              </span>

            </div>

          </div>

        </section>


        {/* =========================================
            QUICK ACTIONS
        ========================================= */}

        <section className="quick-actions">

          <div className="quick-actions-header">

            <p className="eyebrow">
              QUICK ACTIONS
            </p>

            <h2>
              Continue Teaching
            </h2>

          </div>


          <div className="quick-actions-grid">

            <Link
              to="/lesson-plan"
              className="quick-action"
            >
              <span>
                Create Lesson Plan
              </span>

              <strong>
                01
              </strong>
            </Link>


            <Link
              to="/classes"
              className="quick-action"
            >
              <span>
                Manage Classes
              </span>

              <strong>
                02
              </strong>
            </Link>


            <Link
              to="/quizzes"
              className="quick-action"
            >
              <span>
                Manage Quizzes
              </span>

              <strong>
                03
              </strong>
            </Link>


            <Link
              to="/resources"
              className="quick-action"
            >
              <span>
                Manage Resources
              </span>

              <strong>
                04
              </strong>
            </Link>

          </div>

        </section>


        {/* =========================================
            BACK TO DASHBOARD
        ========================================= */}

        <div className="analytics-back">

          <Link
            to="/"
            className="secondary-button"
          >
            ← Back to Dashboard
          </Link>

        </div>


        {/* =========================================
            FOOTER
        ========================================= */}

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

export default Analytics;
