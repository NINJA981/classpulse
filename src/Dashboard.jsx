import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import SectionReadinessCard from "./components/SectionReadinessCard.jsx";
import {
  getCourseStatus,
  getConceptProposals,
  getClaimDetails,
} from "./onboardingApi.js";

function Dashboard() {
  const [classes, setClasses] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [resources, setResources] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [courseStatus, setCourseStatus] = useState(null);
  const [unreviewedProposals, setUnreviewedProposals] = useState([]);
  const [teacherName, setTeacherName] = useState("Teacher");

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

    try {
      const claim = getClaimDetails();
      if (claim && claim.name) {
        setTeacherName(claim.name.replace(/^Prof\.\s*|^Dr\.\s*/i, ""));
      }
      getCourseStatus("cs-201").then(setCourseStatus);
      getConceptProposals("cs-201").then(setUnreviewedProposals);
    } catch (err) {
      console.error("Error loading course validation status:", err);
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
      label: "Active Classes",
      value: String(classes.length),
      detail: `${totalStudents} ${
        totalStudents === 1 ? "student" : "students"
      } registered`,
      path: "/classes",
    },
    {
      label: "Lesson Plans",
      value: String(lessonPlans.length),
      detail: `${lessonPlans.length} ${
        lessonPlans.length === 1 ? "plan" : "plans"
      } created`,
      path: "/saved-plans",
    },
    {
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
      title: "Create Lesson Plan",
      description:
        "Build a structured lesson with objectives, activities and assessment.",
      path: "/lesson-plan",
    },
    {
      title: "Manage Classes",
      description:
        "View students, class details and learning progress.",
      path: "/classes",
    },
    {
      title: "Browse Resources",
      description:
        "Find notes, documents, worksheets and teaching material.",
      path: "/resources",
    },
    {
      title: "Create Quiz",
      description:
        "Create assessments and track student performance.",
      path: "/quizzes",
    },
  ];


  const footer = (
    <>
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

      <Link
        to="/analytics"
        className="ui-button ui-button-secondary"
      >
        Explore Analytics →
      </Link>
    </>
  );

  return (
    <AppShell footer={footer}>

      {/* HEADER */}
      <header className="page-header">
        <div className="page-header-copy">
          <p className="zine-label">
            DASHBOARD
          </p>

          <h1>
            Good morning,
            <br />
            <span>{teacherName}.</span>
          </h1>

          <p>
            Everything you need to plan, teach and
            assess is right here.
          </p>
        </div>

        <div className="page-header-side">
          <Link
            to="/lesson-plan"
            className="ui-button ui-button-primary"
          >
            <span>+</span>
            Create Lesson Plan
          </Link>
        </div>
      </header>

      {/* CONCEPT GRAPH VALIDATION BANNER */}
      {courseStatus?.status === "parsed but not validated" && (
        <section
          className="hypercard-static pad-6"
          style={{
            marginBottom: "32px",
            background: "var(--surface)",
            border: "2px solid var(--border-strong)",
            boxShadow: "var(--shadow-md)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div style={{ maxWidth: "620px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <p className="zine-label">CONCEPT GRAPH RITUAL REQUIRED</p>
              <span
                className="ui-pill"
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  background: "#fff0ed",
                  borderColor: "#990000",
                  color: "#990000",
                }}
              >
                {unreviewedProposals.length} prerequisite pairs need your review
              </span>
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: "700" }}>
              {courseStatus.code || "CS 201"}: {courseStatus.title || "Data Structures & Algorithms"}
            </h2>
            <p className="card-body" style={{ marginTop: "6px", color: "var(--ink-2)", fontSize: "14px" }}>
              The AI syllabus parser extracted prerequisite relationships that require your academic validation. Complete the 10-minute ritual to certify the concept graph before running student diagnostic readiness rollups.
            </p>
          </div>

          <div>
            <Link
              to={`/concept-validation?courseId=${courseStatus.id || "cs-201"}`}
              className="ui-button ui-button-primary"
              style={{ minHeight: "46px", fontSize: "15px", padding: "12px 24px" }}
            >
              Begin 10-Minute Ritual →
            </Link>
          </div>
        </section>
      )}

      {/* STATS */}
      <section className="stat-grid">
        {stats.map((stat) => (
          <Link
            to={stat.path}
            className="hypercard stat-tile"
            key={stat.label}
          >
            <p className="zine-label">
              {stat.label}
            </p>

            <p className="stat-tile-value">
              {stat.value}
            </p>

            <div className="stat-tile-foot">
              <span>
                {stat.detail}
              </span>

              <span className="text-link">
                View →
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* QUICK ACTIONS */}
      <section className="section-block">
        <div className="section-header">
          <div className="section-header-copy">
            <p className="zine-label">
              QUICK ACTIONS
            </p>

            <h2>
              Start your most common teaching tasks.
            </h2>
          </div>
        </div>

        <div className="card-grid card-grid-4">
          {actions.map((action) => (
            <Link
              to={action.path}
              className="hypercard stat-tile action-tile"
              key={action.title}
            >
              <p className="zine-label">
                {String(actions.indexOf(action) + 1).padStart(2, "0")}
              </p>

              <h3 className="card-title">
                {action.title}
              </h3>

              <p className="card-body">
                {action.description}
              </p>

              <div className="stat-tile-foot">
                <span className="text-link">Open →</span>
              </div>
            </Link>
          ))}
          </div>
      </section>

      {/* SECTION READINESS ROLLUP */}
      <section className="section-block">
        <SectionReadinessCard />
      </section>

      {/* TWO COLUMN SECTION */}
      <div className="dashboard-columns">

        {/* RECENT LESSON PLANS */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="zine-label">
                RECENT LESSON PLANS
              </p>

              <h2>
                Your latest teaching plans.
              </h2>
            </div>

            <Link
              to="/saved-plans"
              className="text-link"
            >
              View all →
            </Link>
          </div>

          <div className="stack-3">

            {recentPlans.length === 0 ? (
              <div className="empty-block dashboard-empty">

                <p className="zine-label">Lesson plans</p>

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
                  className="ui-card list-row dashboard-row"
                  key={
                    plan.id ||
                    `${getPlanTitle(plan)}-${index}`
                  }
                >
                  <div className="list-row-main">
                    <h3>
                      {getPlanTitle(plan)}
                    </h3>

                    <p>
                      {getPlanSubject(plan)}
                      {" · "}
                      {getPlanDuration(plan)}
                    </p>
                  </div>

                  <span className="ui-pill ui-pill-dark">
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
              <p className="zine-label">
                CLASS OVERVIEW
              </p>

              <h2>
                Current student progress.
              </h2>
            </div>

            <Link
              to="/classes"
              className="text-link"
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
                      students •{" "}
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
            <div className="empty-block dashboard-empty">

              <p className="zine-label">Classes</p>

              <strong>
                No classes yet.
              </strong>

              <p>
                Add a class to start tracking
                student progress.
              </p>

              <Link
                to="/classes"
                className="text-link"
              >
                Add Class →
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* RECENT ACTIVITY */}
      <section className="panel section-block">
        <div className="panel-header">
          <div>
            <p className="zine-label">
              RECENT ACTIVITY
            </p>

            <h2>
              Latest activity across your
              workspace.
            </h2>
          </div>

          <span className="ui-pill live-label">
            <span className="live-dot" aria-hidden="true"></span>
            Live workspace
          </span>
        </div>

        <div className="stack-3">

          {lessonPlans.length > 0 && (
            <div className="ui-card list-row dashboard-row">
              <div className="list-row-main">
                <strong>
                  Lesson plan created
                </strong>

                <p>
                  {getPlanTitle(
                    recentPlans[0]
                  )}
                </p>
              </div>

              <span className="text-muted">
                Recently
              </span>
            </div>
          )}

          {classes.length > 0 && (
            <div className="ui-card list-row dashboard-row">
              <div className="list-row-main">
                <strong>
                  Class available
                </strong>

                <p>
                  {firstClass.name ||
                    "Class"}
                </p>
              </div>

              <span className="text-muted">
                Recently
              </span>
            </div>
          )}

          {resources.length > 0 && (
            <div className="ui-card list-row dashboard-row">
              <div className="list-row-main">
                <strong>
                  Resource available
                </strong>

                <p>
                  {resources[0].title ||
                    resources[0].name ||
                    "Teaching Resource"}
                </p>
              </div>

              <span className="text-muted">
                Recently
              </span>
            </div>
          )}

          {quizzes.length > 0 && (
            <div className="ui-card list-row dashboard-row">
              <div className="list-row-main">
                <strong>
                  Quiz available
                </strong>

                <p>
                  {quizzes[0].title ||
                    quizzes[0].name ||
                    "Quiz"}
                </p>
              </div>

              <span className="text-muted">
                Recently
              </span>
            </div>
          )}

          {lessonPlans.length === 0 &&
            classes.length === 0 &&
            resources.length === 0 &&
            quizzes.length === 0 && (
              <div className="empty-block dashboard-empty">

                <p className="zine-label">Activity</p>

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

    </AppShell>
  );
}

export default Dashboard;
