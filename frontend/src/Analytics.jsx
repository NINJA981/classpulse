import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import SectionReadinessCard from "./components/SectionReadinessCard.jsx";

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

  const footer = (
    <>
      <div>
        <strong>
          TEACHER GUIDE
        </strong>

        <p>
          Intelligent workspace for modern teaching.
        </p>
      </div>
    </>
  );

  const overview = [
    {
      label: "Students",
      description: "Students registered across your classes.",
      value: stats.students,
    },
    {
      label: "Classes",
      description: "Classes currently managed in Teacher Guide.",
      value: stats.classes,
    },
    {
      label: "Lesson Plans",
      description: "Lesson plans created and saved.",
      value: stats.lessonPlans,
    },
    {
      label: "Resources",
      description: "Teaching materials available.",
      value: stats.resources,
    },
    {
      label: "Quizzes",
      description: "Assessments created for students.",
      value: stats.quizzes,
    },
    {
      label: "Quiz Attempts",
      description: "Completed quiz attempts recorded.",
      value: stats.quizAttempts,
    },
    {
      label: "Average Score",
      description: "Average percentage from completed quizzes.",
      value: `${stats.averageScore}%`,
    },
  ];

  const activity = [
    {
      title: "Lesson Planning",
      detail: `${stats.lessonPlans} plans created`,
      value: stats.lessonPlans,
    },
    {
      title: "Classroom Management",
      detail: `${stats.classes} classes managed`,
      value: stats.classes,
    },
    {
      title: "Teaching Materials",
      detail: `${stats.resources} resources available`,
      value: stats.resources,
    },
    {
      title: "Student Management",
      detail: `${stats.students} students registered`,
      value: stats.students,
    },
    {
      title: "Assessments",
      detail: `${stats.quizzes} quizzes created`,
      value: stats.quizzes,
    },
    {
      title: "Student Performance",
      detail: `${stats.averageScore}% average score`,
      value: `${stats.averageScore}%`,
    },
  ];

  const quickActions = [
    { label: "Create Lesson Plan", to: "/lesson-plan" },
    { label: "Manage Classes", to: "/classes" },
    { label: "Manage Quizzes", to: "/quizzes" },
    { label: "Manage Resources", to: "/resources" },
  ];
  return (
    <AppShell footer={footer}>
      <div className="dashboard">

        {/* =========================================
            HERO
        ========================================= */}

        <header className="page-header">
          <div className="page-header-copy">
            <p className="zine-label">
              TEACHER ANALYTICS
            </p>

            <h1>
              Track.
              <br />
              Understand.
            </h1>

            <p>
              Monitor classroom activity, assessments and
              teaching resources from one place.
            </p>
          </div>

          <div className="page-header-side">
            <span className="ui-pill live-label">
              <span className="live-dot" aria-hidden="true"></span>
              {stats.quizAttempts}{" "}
              {stats.quizAttempts === 1 ? "attempt" : "attempts"}
            </span>
          </div>
        </header>


        {/* =========================================
            STATISTICS
        ========================================= */}

        <section className="stat-grid">
          {overview.map((item) => (
            <div
              className="hypercard-static stat-tile"
              key={item.label}
            >
              <p className="zine-label">
                {item.label}
              </p>

              <p className="stat-tile-value">
                {item.value}
              </p>

              <p className="card-body">
                {item.description}
              </p>
            </div>
          ))}
        </section>


        {/* =========================================
            CLASSROOM OVERVIEW
        ========================================= */}

        <section className="section-block">
          <div className="section-header">
            <div className="section-header-copy">
              <p className="zine-label">
                CLASSROOM OVERVIEW
              </p>

              <h2>
                Teaching Activity
              </h2>
            </div>
          </div>

          <div className="card-grid">
              {activity.map((item) => (
                <div className="ui-card pad-6" key={item.title}>
                  <div className="card-top">
                    <span className="ui-pill">
                      {item.value}
                    </span>
                  </div>

                  <h3 className="card-title">
                    {item.title}
                  </h3>

                  <p className="card-body">
                    {item.detail}
                  </p>
                </div>
              ))}
          </div>
        </section>

        {/* =========================================
            SECTION READINESS ROLLUP
        ========================================= */}

        <section className="section-block">
          <SectionReadinessCard />
        </section>

        {/* =========================================
            QUICK ACTIONS
        ========================================= */}

        <section className="section-block">
          <div className="section-header">
            <div className="section-header-copy">
              <p className="zine-label">
                QUICK ACTIONS
              </p>

              <h2>
                Continue Teaching
              </h2>
            </div>
          </div>

          <div className="card-grid">
            {quickActions.map((action, index) => (
              <Link
                to={action.to}
                className="hypercard stat-tile action-tile"
                key={action.to}
              >
                <p className="zine-label">
                  {String(index + 1).padStart(2, "0")}
                </p>

                <h3 className="card-title">
                  {action.label}
                </h3>

                <div className="stat-tile-foot">
                  <span className="text-link">Open →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>


        {/* =========================================
            BACK TO DASHBOARD
        ========================================= */}

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

export default Analytics;
