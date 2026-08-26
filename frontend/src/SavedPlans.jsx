import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Analytics() {
  const [analytics, setAnalytics] = useState({
    students: 0,
    classes: 0,
    lessonPlans: 0,
    resources: 0,
    quizzes: 0,
    quizAttempts: 0,
    averageScore: 0,
  });

  const loadAnalytics = () => {
    try {
      const classes = JSON.parse(
        localStorage.getItem("teacherGuideClasses") || "[]"
      );

      const plans = JSON.parse(
        localStorage.getItem("teacherGuidePlans") || "[]"
      );

      const resources = JSON.parse(
        localStorage.getItem("teacherGuideResources") || "[]"
      );

      const quizzes = JSON.parse(
        localStorage.getItem("teacherGuideQuizzes") || "[]"
      );

      const attempts = JSON.parse(
        localStorage.getItem("teacherGuideQuizAttempts") || "[]"
      );

      const totalStudents = classes.reduce(
        (total, item) => total + (Number(item.students) || 0),
        0
      );

      const totalAttempts = attempts.length;

      const averageScore =
        totalAttempts > 0
          ? Math.round(
              attempts.reduce(
                (total, attempt) =>
                  total + (Number(attempt.percentage) || 0),
                0
              ) / totalAttempts
            )
          : 0;

      setAnalytics({
        students: totalStudents,
        classes: classes.length,
        lessonPlans: plans.length,
        resources: resources.length,
        quizzes: quizzes.length,
        quizAttempts: totalAttempts,
        averageScore,
      });
    } catch (error) {
      console.error("Unable to load analytics:", error);

      setAnalytics({
        students: 0,
        classes: 0,
        lessonPlans: 0,
        resources: 0,
        quizzes: 0,
        quizAttempts: 0,
        averageScore: 0,
      });
    }
  };

  useEffect(() => {
    loadAnalytics();

    const handleStorageChange = () => {
      loadAnalytics();
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const stats = [
    {
      number: "01",
      title: "Students",
      description: "Students registered across your classes.",
      value: analytics.students,
    },
    {
      number: "02",
      title: "Classes",
      description: "Classes currently managed in Teacher Guide.",
      value: analytics.classes,
    },
    {
      number: "03",
      title: "Lesson Plans",
      description: "Lesson plans created and saved.",
      value: analytics.lessonPlans,
    },
    {
      number: "04",
      title: "Resources",
      description: "Teaching materials available.",
      value: analytics.resources,
    },
    {
      number: "05",
      title: "Quizzes",
      description: "Assessments created for students.",
      value: analytics.quizzes,
    },
    {
      number: "06",
      title: "Quiz Attempts",
      description: "Completed quiz attempts recorded.",
      value: analytics.quizAttempts,
    },
    {
      number: "07",
      title: "Average Score",
      description: "Average score from completed quizzes.",
      value: `${analytics.averageScore}%`,
    },
  ];

  return (
    <div className="lesson-page">

      {/* HEADER */}

      <header className="topbar">

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

        <button
          className="profile"
          type="button"
        >
          Teacher
        </button>

      </header>


      {/* MAIN */}

      <main className="lesson-main">

        {/* PAGE HEADING */}

        <div className="page-heading">

          <p className="eyebrow">
            TEACHER ANALYTICS
          </p>

          <h1>
            Track. Understand.
          </h1>

          <p className="page-description">
            Monitor classroom activity, assessments and
            teaching resources from one place.
          </p>

        </div>


        {/* STATISTICS */}

        <section className="analytics-grid">

          {stats.map((stat) => (

            <article
              className="analytics-card"
              key={stat.number}
            >

              <div className="analytics-card-top">

                <span className="number">
                  {stat.number}
                </span>

              </div>

              <h3>
                {stat.title}
              </h3>

              <p>
                {stat.description}
              </p>

              <h2 className="analytics-value">
                {stat.value}
              </h2>

            </article>

          ))}

        </section>


        {/* CLASSROOM OVERVIEW */}

        <section className="analytics-overview">

          <div className="page-heading">

            <p className="eyebrow">
              CLASSROOM OVERVIEW
            </p>

            <h2>
              Teaching Activity
            </h2>

          </div>


          <div className="activity-list">

            <div className="activity-row">

              <span className="number">
                01
              </span>

              <div>
                <h3>
                  Lesson Planning
                </h3>

                <p>
                  {analytics.lessonPlans} plans created
                </p>
              </div>

            </div>


            <div className="activity-row">

              <span className="number">
                02
              </span>

              <div>
                <h3>
                  Classroom Management
                </h3>

                <p>
                  {analytics.classes} classes managed
                </p>
              </div>

            </div>


            <div className="activity-row">

              <span className="number">
                03
              </span>

              <div>
                <h3>
                  Teaching Materials
                </h3>

                <p>
                  {analytics.resources} resources available
                </p>
              </div>

            </div>


            <div className="activity-row">

              <span className="number">
                04
              </span>

              <div>
                <h3>
                  Student Management
                </h3>

                <p>
                  {analytics.students} students registered
                </p>
              </div>

            </div>


            <div className="activity-row">

              <span className="number">
                05
              </span>

              <div>
                <h3>
                  Assessments
                </h3>

                <p>
                  {analytics.quizzes} quizzes created
                </p>
              </div>

            </div>


            <div className="activity-row">

              <span className="number">
                06
              </span>

              <div>
                <h3>
                  Student Performance
                </h3>

                <p>
                  {analytics.averageScore}% average score
                </p>
              </div>

            </div>

          </div>

        </section>


        {/* QUICK ACTIONS */}

        <section className="quick-actions">

          <div className="page-heading">

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
              className="quick-action-card"
            >

              <span className="number">
                01
              </span>

              <h3>
                Create Lesson Plan
              </h3>

              <p>
                Plan your next lesson →
              </p>

            </Link>


            <Link
              to="/classes"
              className="quick-action-card"
            >

              <span className="number">
                02
              </span>

              <h3>
                Manage Classes
              </h3>

              <p>
                View your classes →
              </p>

            </Link>


            <Link
              to="/quizzes"
              className="quick-action-card"
            >

              <span className="number">
                03
              </span>

              <h3>
                Manage Quizzes
              </h3>

              <p>
                Create and review assessments →
              </p>

            </Link>


            <Link
              to="/resources"
              className="quick-action-card"
            >

              <span className="number">
                04
              </span>

              <h3>
                Manage Resources
              </h3>

              <p>
                View teaching materials →
              </p>

            </Link>

          </div>

        </section>


        {/* BACK */}

        <div className="back-link-container">

          <Link
            to="/"
            className="back-link"
          >
            ← Back to Dashboard
          </Link>

        </div>

      </main>

    </div>
  );
}

export default Analytics;