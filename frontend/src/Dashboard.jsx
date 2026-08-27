import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Dashboard() {
  const [classes, setClasses] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);

  const [resources, setResources] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  const loadDashboardData = () => {
    try {
      const storedClasses = JSON.parse(
        localStorage.getItem("teacherGuideClasses") || "[]"
      );

      setClasses(
        Array.isArray(storedClasses) ? storedClasses : []
      );
    } catch {
      setClasses([]);
    }

    try {
      const storedPlans =
        localStorage.getItem("teacherGuideLessonPlans") ||
        localStorage.getItem("teacherGuidePlans") ||
        "[]";

      const parsedPlans = JSON.parse(storedPlans);

      setLessonPlans(
        Array.isArray(parsedPlans) ? parsedPlans : []
      );
    } catch {
      setLessonPlans([]);
    }

    try {
      const storedResources = JSON.parse(
        localStorage.getItem("teacherGuideResources") || "[]"
      );

      setResources(
        Array.isArray(storedResources) ? storedResources : []
      );
    } catch {
      setResources([]);
    }

    try {
      const storedQuizzes = JSON.parse(
        localStorage.getItem("teacherGuideQuizzes") || "[]"
      );

      setQuizzes(
        Array.isArray(storedQuizzes) ? storedQuizzes : []
      );
    } catch {
      setQuizzes([]);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const handleStorageChange = () => {
      loadDashboardData();
    };

    window.addEventListener("storage", handleStorageChange);

    const handleFocus = () => {
      loadDashboardData();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener(
        "storage",
        handleStorageChange
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, []);

  const totalStudents = classes.reduce(
    (total, item) =>
      total + Number(item.students || 0),
    0
  );

  const recentPlans = lessonPlans
    .slice()
    .sort((a, b) => {
      const dateA = new Date(
        a.createdAt || a.savedAt || a.updatedAt || 0
      ).getTime();

      const dateB = new Date(
        b.createdAt || b.savedAt || b.updatedAt || 0
      ).getTime();

      return dateB - dateA;
    })
    .slice(0, 3);

  const firstClass = classes[0];

  const getPlanTitle = (plan) =>
    plan.title ||
    plan.lessonTitle ||
    plan.name ||
    plan.topic ||
    "Untitled Lesson Plan";

  const getPlanSubject = (plan) =>
    plan.subject || "General";

  const getPlanDuration = (plan) => {
    if (!plan.duration) {
      return "Duration not specified";
    }

    return String(plan.duration).toLowerCase().includes("minute")
      ? String(plan.duration)
      : `${plan.duration} minutes`;
  };

  const stats = [
    {
      icon: "▣",
      label: "Active Classes",
      value: String(classes.length),
      detail: `${totalStudents} ${
        totalStudents === 1 ? "student" : "students"
      } registered`,
      path: "/classes",
    },
    {
      icon: "▤",
      label: "Lesson Plans",
      value: String(lessonPlans.length),
      detail: `${lessonPlans.length} ${
        lessonPlans.length === 1 ? "plan" : "plans"
      } created`,
      path: "/saved-plans",
    },
    {
      icon: "□",
      label: "Resources",
      value: String(resources.length),
      detail: `${resources.length} ${
        resources.length === 1
          ? "resource"
          : "resources"
      } available`,
      path: "/resources",
    },
    {
      icon: "✓",
      label: "Quizzes",
      value: String(quizzes.length),
      detail: `${quizzes.length} ${
        quizzes.length === 1
          ? "quiz"
          : "quizzes"
      } created`,
      path: "/quizzes",
    },
  ];

  const actions = [
    {
      icon: "＋",
      title: "Create Lesson Plan",
      description:
        "Build a structured lesson with objectives, activities and assessment.",
      path: "/lesson-plan",
    },
    {
      icon: "▣",
      title: "Manage Classes",
      description:
        "View students, class details and learning progress.",
      path: "/classes",
    },
    {
      icon: "□",
      title: "Browse Resources",
      description:
        "Find notes, documents, worksheets and teaching material.",
      path: "/resources",
    },
    {
      icon: "✓",
      title: "Create Quiz",
      description:
        "Create assessments and track student performance.",
      path: "/quizzes",
    },
  ];

  return (
    <div className="dashboard-page">

      {/* HEADER */}
      <header className="topbar">
        <Link to="/" className="brand-area">
          <div className="brand-mark">TG</div>

          <div>
            <div className="brand">
              TEACHER GUIDE
            </div>

            <div className="brand-subtitle">
              TEACHER WORKSPACE
            </div>
          </div>
        </Link>

        <div className="profile">
          <div className="profile-avatar">
            H
          </div>

          <div className="profile-info">
            <strong>Teacher</strong>
            <span>Administrator</span>
          </div>

          <button
            className="profile-menu"
            type="button"
            aria-label="Profile menu"
          >
            ⌄
          </button>
        </div>
      </header>

      <main className="dashboard-content">

        {/* HERO */}
        <section className="welcome-section">
          <div className="welcome-copy">
            <p className="eyebrow">
              DASHBOARD
            </p>

            <h1>
              Good morning,
              <br />
              <span>Teacher.</span>
            </h1>

            <p className="welcome-text">
              Everything you need to plan, teach and
              assess is right here.
            </p>
          </div>

          <Link
            to="/lesson-plan"
            className="primary-button"
          >
            <span>＋</span>
            Create Lesson Plan
          </Link>
        </section>

        {/* STATS */}
        <section className="stats-grid">
          {stats.map((stat) => (
            <Link
              to={stat.path}
              className="stat-card"
              key={stat.label}
            >
              <div className="stat-top">
                <div className="stat-icon">
                  {stat.icon}
                </div>

                <span className="stat-arrow">
                  ↗
                </span>
              </div>

              <div className="stat-label">
                {stat.label}
              </div>

              <div className="stat-value">
                {stat.value}
              </div>

              <div className="stat-detail">
                {stat.detail}
              </div>
            </Link>
          ))}
        </section>

        {/* QUICK ACTIONS */}
        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                QUICK ACTIONS
              </p>

              <h2>
                Start your most common teaching tasks.
              </h2>
            </div>
          </div>

          <div className="actions-grid">
            {actions.map((action, index) => (
              <Link
                to={action.path}
                className="action-card"
                key={action.title}
              >
                <div>
                  <div className="action-top">
                    <div className="action-icon">
                      {action.icon}
                    </div>

                    <span className="action-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <h3>
                    {action.title}
                  </h3>

                  <p>
                    {action.description}
                  </p>
                </div>

                <div className="action-footer">
                  <span>Open</span>

                  <span className="action-arrow">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* TWO COLUMN SECTION */}
        <div className="dashboard-columns">

          {/* RECENT LESSON PLANS */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">
                  RECENT LESSON PLANS
                </p>

                <h2>
                  Your latest teaching plans.
                </h2>
              </div>

              <Link
                to="/saved-plans"
                className="view-link"
              >
                View all →
              </Link>
            </div>

            <div className="lesson-list">

              {recentPlans.length === 0 ? (
                <div className="empty-dashboard-state">
                  <span>01</span>

                  <strong>
                    No lesson plans yet.
                  </strong>

                  <p>
                    Create your first lesson plan
                    to see it here.
                  </p>
                </div>
              ) : (
                recentPlans.map((plan, index) => (
                  <div
                    className="lesson-item"
                    key={
                      plan.id ||
                      `${getPlanTitle(plan)}-${index}`
                    }
                  >
                    <div className="lesson-icon">
                      ▤
                    </div>

                    <div className="lesson-content">
                      <h3>
                        {getPlanTitle(plan)}
                      </h3>

                      <p>
                        {getPlanSubject(plan)}
                        {" · "}
                        {getPlanDuration(plan)}
                      </p>
                    </div>

                    <span className="status">
                      Saved
                    </span>
                  </div>
                ))
              )}

            </div>
          </section>

          {/* CLASS OVERVIEW */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">
                  CLASS OVERVIEW
                </p>

                <h2>
                  Current student progress.
                </h2>
              </div>

              <Link
                to="/classes"
                className="view-link"
              >
                View all →
              </Link>
            </div>

            {firstClass ? (
              <>
                <div className="class-overview">
                  <div className="class-top">
                    <div>
                      <h3>
                        {firstClass.name ||
                          "Class"}
                      </h3>

                      <p>
                        {Number(
                          firstClass.students || 0
                        )}{" "}
                        students ·{" "}
                        {firstClass.subject ||
                          "General"}
                      </p>
                    </div>

                    <strong>
                      0%
                    </strong>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: "0%",
                      }}
                    />
                  </div>

                  <div className="progress-meta">
                    <span>
                      Overall progress
                    </span>

                    <span>
                      Getting started
                    </span>
                  </div>
                </div>

                <div className="mini-metrics">
                  <div>
                    <span>
                      Students
                    </span>

                    <strong>
                      {Number(
                        firstClass.students || 0
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Attendance
                    </span>

                    <strong>
                      {firstClass.attendance ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Completed
                    </span>

                    <strong>
                      {firstClass.completed ||
                        "0"}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-dashboard-state">
                <span>00</span>

                <strong>
                  No classes yet.
                </strong>

                <p>
                  Add a class to start tracking
                  student progress.
                </p>

                <Link
                  to="/classes"
                  className="view-link"
                >
                  Add Class →
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* RECENT ACTIVITY */}
        <section className="panel activity-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">
                RECENT ACTIVITY
              </p>

              <h2>
                Latest activity across your
                workspace.
              </h2>
            </div>

            <span className="activity-status">
              ● Live workspace
            </span>
          </div>

          <div className="activity-list">

            {lessonPlans.length > 0 && (
              <div className="activity-item">
                <div className="activity-icon">
                  ▤
                </div>

                <div className="activity-content">
                  <strong>
                    Lesson plan created
                  </strong>

                  <p>
                    {getPlanTitle(
                      recentPlans[0]
                    )}
                  </p>
                </div>

                <span className="activity-time">
                  Recently
                </span>
              </div>
            )}

            {classes.length > 0 && (
              <div className="activity-item">
                <div className="activity-icon">
                  ▣
                </div>

                <div className="activity-content">
                  <strong>
                    Class available
                  </strong>

                  <p>
                    {firstClass.name ||
                      "Class"}
                  </p>
                </div>

                <span className="activity-time">
                  Recently
                </span>
              </div>
            )}

            {resources.length > 0 && (
              <div className="activity-item">
                <div className="activity-icon">
                  □
                </div>

                <div className="activity-content">
                  <strong>
                    Resource available
                  </strong>

                  <p>
                    {resources[0].title ||
                      resources[0].name ||
                      "Teaching Resource"}
                  </p>
                </div>

                <span className="activity-time">
                  Recently
                </span>
              </div>
            )}

            {quizzes.length > 0 && (
              <div className="activity-item">
                <div className="activity-icon">
                  ✓
                </div>

                <div className="activity-content">
                  <strong>
                    Quiz available
                  </strong>

                  <p>
                    {quizzes[0].title ||
                      quizzes[0].name ||
                      "Quiz"}
                  </p>
                </div>

                <span className="activity-time">
                  Recently
                </span>
              </div>
            )}

            {lessonPlans.length === 0 &&
              classes.length === 0 &&
              resources.length === 0 &&
              quizzes.length === 0 && (
                <div className="empty-dashboard-state">
                  <span>00</span>

                  <strong>
                    No recent activity.
                  </strong>

                  <p>
                    Your workspace activity will
                    appear here.
                  </p>
                </div>
              )}

          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-brand">
          <div className="footer-mark">
            TG
          </div>

          <div>
            <strong>
              Teacher Guide
            </strong>

            <p>
              Keep your teaching workflow organized
              — from planning to assessment and
              analytics.
            </p>
          </div>
        </div>

        <Link
          to="/analytics"
          className="footer-button"
        >
          Explore Analytics →
        </Link>
      </footer>

    </div>
  );
}

export default Dashboard;