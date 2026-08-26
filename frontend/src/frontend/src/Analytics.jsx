import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Analytics() {
  const [stats, setStats] = useState({
    students: 0,
    classes: 0,
    plans: 0,
    resources: 0,
    quizzes: 0,
    attempts: 0,
    averageScore: 0,
  });

  useEffect(() => {
    const loadAnalytics = () => {
      try {
        // -----------------------------
        // LESSON PLANS
        // -----------------------------
        const plans =
          JSON.parse(
            localStorage.getItem("lessonPlans") ||
            localStorage.getItem("teacherGuidePlans") ||
            "[]"
          ) || [];

        // -----------------------------
        // CLASSES
        // -----------------------------
        const classes =
          JSON.parse(
            localStorage.getItem("classes") || "[]"
          ) || [];

        // -----------------------------
        // RESOURCES
        // -----------------------------
        const resources =
          JSON.parse(
            localStorage.getItem("resources") || "[]"
          ) || [];

        // -----------------------------
        // QUIZZES
        // -----------------------------
        const quizzes =
          JSON.parse(
            localStorage.getItem("teacherGuideQuizzes") ||
            localStorage.getItem("quizzes") ||
            "[]"
          ) || [];

        // -----------------------------
        // STUDENTS
        // -----------------------------
        let students = 0;

        classes.forEach((item) => {
          if (Array.isArray(item.studentList)) {
            students += item.studentList.length;
          } else {
            students += Number(
              item.students ||
              item.studentCount ||
              0
            );
          }
        });

        // -----------------------------
        // QUIZ RESULTS
        // -----------------------------
        let attempts = 0;
        let totalScore = 0;

        // Check all quiz result entries
        Object.keys(localStorage).forEach((key) => {
          if (
            key.startsWith("teacherGuideQuizResult_")
          ) {
            try {
              const result = JSON.parse(
                localStorage.getItem(key)
              );

              if (!result) return;

              let score = null;

              // Percentage already stored
              if (
                typeof result.percentage === "number"
              ) {
                score = result.percentage;
              }

              // Score stored as percentage
              else if (
                typeof result.score === "number" &&
                result.score <= 100
              ) {
                score = result.score;
              }

              // Correct / total format
              else if (
                typeof result.correct === "number" &&
                typeof result.total === "number" &&
                result.total > 0
              ) {
                score =
                  (result.correct / result.total) * 100;
              }

              // Correct answers / total questions
              else if (
                typeof result.correctAnswers === "number" &&
                typeof result.totalQuestions === "number" &&
                result.totalQuestions > 0
              ) {
                score =
                  (result.correctAnswers /
                    result.totalQuestions) *
                  100;
              }

              if (score !== null) {
                totalScore += score;
                attempts += 1;
              }
            } catch (error) {
              console.error(
                "Error reading quiz result:",
                error
              );
            }
          }
        });

        // -----------------------------
        // AVERAGE SCORE
        // -----------------------------
        const averageScore =
          attempts > 0
            ? Math.round(totalScore / attempts)
            : 0;

        // -----------------------------
        // UPDATE ANALYTICS
        // -----------------------------
        setStats({
          students,
          classes: classes.length,
          plans: plans.length,
          resources: resources.length,
          quizzes: quizzes.length,
          attempts,
          averageScore,
        });
      } catch (error) {
        console.error(
          "Could not load analytics:",
          error
        );
      }
    };

    loadAnalytics();

    // Refresh analytics when localStorage changes
    window.addEventListener(
      "storage",
      loadAnalytics
    );

    // Refresh when returning to the page
    window.addEventListener(
      "focus",
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
    };
  }, []);

  return (
    <div className="app">

      {/* NAVBAR */}
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

      {/* MAIN */}
      <main className="dashboard">

        {/* HERO */}
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
            Monitor classroom activity, assessments
            and teaching resources from one place.
          </p>

        </section>

        {/* STATISTICS */}
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

            <strong className="analytics-value">
              {stats.students}
            </strong>

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

            <strong className="analytics-value">
              {stats.classes}
            </strong>

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

            <strong className="analytics-value">
              {stats.plans}
            </strong>

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

            <strong className="analytics-value">
              {stats.resources}
            </strong>

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

            <strong className="analytics-value">
              {stats.quizzes}
            </strong>

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

            <strong className="analytics-value">
              {stats.attempts}
            </strong>

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
              Average score from completed quizzes.
            </p>

            <strong className="analytics-value">
              {stats.averageScore}%
            </strong>

          </div>

        </section>

        {/* CLASSROOM OVERVIEW */}
        <section className="analytics-details">

          <div className="analytics-heading">

            <p className="eyebrow">
              CLASSROOM OVERVIEW
            </p>

            <h2>
              Teaching Activity
            </h2>

          </div>

          <div className="activity-list">

            <div className="activity-row">

              <div>
                <span className="activity-number">
                  01
                </span>

                <strong>
                  Lesson Planning
                </strong>
              </div>

              <span>
                {stats.plans} plans created
              </span>

            </div>

            <div className="activity-row">

              <div>
                <span className="activity-number">
                  02
                </span>

                <strong>
                  Classroom Management
                </strong>
              </div>

              <span>
                {stats.classes} classes managed
              </span>

            </div>

            <div className="activity-row">

              <div>
                <span className="activity-number">
                  03
                </span>

                <strong>
                  Teaching Materials
                </strong>
              </div>

              <span>
                {stats.resources} resources available
              </span>

            </div>

            <div className="activity-row">

              <div>
                <span className="activity-number">
                  04
                </span>

                <strong>
                  Student Management
                </strong>
              </div>

              <span>
                {stats.students} students registered
              </span>

            </div>

            <div className="activity-row">

              <div>
                <span className="activity-number">
                  05
                </span>

                <strong>
                  Assessments
                </strong>
              </div>

              <span>
                {stats.quizzes} quizzes created
              </span>

            </div>

            <div className="activity-row">

              <div>
                <span className="activity-number">
                  06
                </span>

                <strong>
                  Student Performance
                </strong>
              </div>

              <span>
                {stats.averageScore}% average score
              </span>

            </div>

          </div>

        </section>

        {/* QUICK ACTIONS */}
        <section className="analytics-details">

          <div className="analytics-heading">

            <p className="eyebrow">
              QUICK ACTIONS
            </p>

            <h2>
              Continue Teaching
            </h2>

          </div>

          <div className="analytics-actions">

            <Link
              to="/lesson-plan"
              className="analytics-action"
            >
              <span>
                01
              </span>

              <strong>
                Create Lesson Plan
              </strong>

              <small>
                Plan your next lesson →
              </small>
            </Link>

            <Link
              to="/classes"
              className="analytics-action"
            >
              <span>
                02
              </span>

              <strong>
                Manage Classes
              </strong>

              <small>
                View your classes →
              </small>
            </Link>

            <Link
              to="/quizzes"
              className="analytics-action"
            >
              <span>
                03
              </span>

              <strong>
                Manage Quizzes
              </strong>

              <small>
                Create and review assessments →
              </small>
            </Link>

            <Link
              to="/resources"
              className="analytics-action"
            >
              <span>
                04
              </span>

              <strong>
                Manage Resources
              </strong>

              <small>
                View teaching materials →
              </small>
            </Link>

          </div>

        </section>

        {/* BACK */}
        <div className="analytics-back">

          <Link
            to="/"
            className="secondary-button"
          >
            ← Back to Dashboard
          </Link>

        </div>

      </main>

    </div>
  );
}

export default Analytics;