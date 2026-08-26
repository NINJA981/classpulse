import { useEffect, useState } from "react";
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

  const readStorage = (key) => {
    try {
      const data = localStorage.getItem(key);

      if (!data) {
        return [];
      }

      const parsed = JSON.parse(data);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return [];
    }
  };

  const loadAnalytics = () => {
    try {
      // ==============================
      // CLASSES
      // ==============================

      const classes = readStorage("teacherGuideClasses");

      const totalStudents = classes.reduce(
        (total, currentClass) => {
          const studentCount = Number(currentClass?.students) || 0;

          return total + studentCount;
        },
        0
      );

      // ==============================
      // LESSON PLANS
      // ==============================

      const lessonPlans = readStorage(
        "teacherGuidePlans"
      );

      // ==============================
      // RESOURCES
      // ==============================

      const resources = readStorage(
        "teacherGuideResources"
      );

      // ==============================
      // QUIZZES
      // ==============================

      const quizzes = readStorage(
        "teacherGuideQuizzes"
      );

      // ==============================
      // QUIZ ATTEMPTS
      // ==============================

      const attempts = readStorage(
        "teacherGuideQuizAttempts"
      );

      // ==============================
      // AVERAGE SCORE
      // ==============================

      let averageScore = 0;

      if (attempts.length > 0) {
        const validScores = attempts
          .map((attempt) => {
            const percentage = Number(
              attempt?.percentage
            );

            return Number.isFinite(percentage)
              ? percentage
              : null;
          })
          .filter((score) => score !== null);

        if (validScores.length > 0) {
          const totalScore = validScores.reduce(
            (total, score) => total + score,
            0
          );

          averageScore = Math.round(
            totalScore / validScores.length
          );
        }
      }

      // ==============================
      // UPDATE
      // ==============================

      setAnalytics({
        students: totalStudents,
        classes: classes.length,
        lessonPlans: lessonPlans.length,
        resources: resources.length,
        quizzes: quizzes.length,
        quizAttempts: attempts.length,
        averageScore: averageScore,
      });
    } catch (error) {
      console.error(
        "Unable to load analytics:",
        error
      );

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

  // ==============================
  // LOAD ANALYTICS
  // ==============================

  useEffect(() => {
    loadAnalytics();

    const handleStorageChange = () => {
      loadAnalytics();
    };

    const handleFocus = () => {
      loadAnalytics();
    };

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    window.addEventListener(
      "focus",
      handleFocus
    );

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

  return (
    <div className="lesson-page">

      {/* =====================================
          HEADER
      ===================================== */}

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

        <div className="profile">
          Teacher
        </div>

      </header>


      {/* =====================================
          MAIN
      ===================================== */}

      <main className="lesson-main">

        {/* =====================================
            PAGE HEADER
        ===================================== */}

        <section className="page-heading">

          <p className="eyebrow">
            TEACHER ANALYTICS
          </p>

          <h1>
            Track.
            <br />
            Understand.
          </h1>

          <p className="page-description">
            Monitor classroom activity, assessments
            and teaching resources from one place.
          </p>

        </section>


        {/* =====================================
            ANALYTICS
        ===================================== */}

        <section className="saved-plans-grid">

          {/* STUDENTS */}

          <article className="saved-plan-card">

            <div className="saved-plan-top">

              <span className="number">
                01
              </span>

            </div>

            <h2>
              Students
            </h2>

            <p className="plan-meta">
              Students registered across your classes.
            </p>

            <p className="analytics-number">
              {analytics.students}
            </p>

          </article>


          {/* CLASSES */}

          <article className="saved-plan-card">

            <div className="saved-plan-top">

              <span className="number">
                02
              </span>

            </div>

            <h2>
              Classes
            </h2>

            <p className="plan-meta">
              Classes currently managed in Teacher Guide.
            </p>

            <p className="analytics-number">
              {analytics.classes}
            </p>

          </article>


          {/* LESSON PLANS */}

          <article className="saved-plan-card">

            <div className="saved-plan-top">

              <span className="number">
                03
              </span>

            </div>

            <h2>
              Lesson Plans
            </h2>

            <p className="plan-meta">
              Lesson plans created and saved.
            </p>

            <p className="analytics-number">
              {analytics.lessonPlans}
            </p>

          </article>


          {/* RESOURCES */}

          <article className="saved-plan-card">

            <div className="saved-plan-top">

              <span className="number">
                04
              </span>

            </div>

            <h2>
              Resources
            </h2>

            <p className="plan-meta">
              Teaching materials available.
            </p>

            <p className="analytics-number">
              {analytics.resources}
            </p>

          </article>


          {/* QUIZZES */}

          <article className="saved-plan-card">

            <div className="saved-plan-top">

              <span className="number">
                05
              </span>

            </div>

            <h2>
              Quizzes
            </h2>

            <p className="plan-meta">
              Assessments created for students.
            </p>

            <p className="analytics-number">
              {analytics.quizzes}
            </p>

          </article>


          {/* QUIZ ATTEMPTS */}

          <article className="saved-plan-card">

            <div className="saved-plan-top">

              <span className="number">
                06
              </span>

            </div>

            <h2>
              Quiz Attempts
            </h2>

            <p className="plan-meta">
              Completed quiz attempts recorded.
            </p>

            <p className="analytics-number">
              {analytics.quizAttempts}
            </p>

          </article>


          {/* AVERAGE SCORE */}

          <article className="saved-plan-card">

            <div className="saved-plan-top">

              <span className="number">
                07
              </span>

            </div>

            <h2>
              Average Score
            </h2>

            <p className="plan-meta">
              Average score from completed quizzes.
            </p>

            <p className="analytics-number">
              {analytics.averageScore}%
            </p>

          </article>

        </section>


        {/* =====================================
            CLASSROOM OVERVIEW
        ===================================== */}

        <section className="analytics-overview">

          <div className="page-heading">

            <p className="eyebrow">
              CLASSROOM OVERVIEW
            </p>

            <h2>
              Teaching Activity
            </h2>

          </div>


          <section className="saved-plans-grid">

            {/* LESSON PLANNING */}

            <article className="saved-plan-card">

              <span className="number">
                01
              </span>

              <h2>
                Lesson Planning
              </h2>

              <p className="plan-meta">
                {analytics.lessonPlans}{" "}
                {analytics.lessonPlans === 1
                  ? "plan"
                  : "plans"}{" "}
                created
              </p>

            </article>


            {/* CLASSROOM MANAGEMENT */}

            <article className="saved-plan-card">

              <span className="number">
                02
              </span>

              <h2>
                Classroom Management
              </h2>

              <p className="plan-meta">
                {analytics.classes}{" "}
                {analytics.classes === 1
                  ? "class"
                  : "classes"}{" "}
                managed
              </p>

            </article>


            {/* TEACHING MATERIALS */}

            <article className="saved-plan-card">

              <span className="number">
                03
              </span>

              <h2>
                Teaching Materials
              </h2>

              <p className="plan-meta">
                {analytics.resources}{" "}
                {analytics.resources === 1
                  ? "resource"
                  : "resources"}{" "}
                available
              </p>

            </article>


            {/* STUDENT MANAGEMENT */}

            <article className="saved-plan-card">

              <span className="number">
                04
              </span>

              <h2>
                Student Management
              </h2>

              <p className="plan-meta">
                {analytics.students} students
                registered
              </p>

            </article>


            {/* ASSESSMENTS */}

            <article className="saved-plan-card">

              <span className="number">
                05
              </span>

              <h2>
                Assessments
              </h2>

              <p className="plan-meta">
                {analytics.quizzes}{" "}
                {analytics.quizzes === 1
                  ? "quiz"
                  : "quizzes"}{" "}
                created
              </p>

            </article>


            {/* STUDENT PERFORMANCE */}

            <article className="saved-plan-card">

              <span className="number">
                06
              </span>

              <h2>
                Student Performance
              </h2>

              <p className="plan-meta">
                {analytics.averageScore}%
                average score
              </p>

            </article>

          </section>

        </section>


        {/* =====================================
            QUICK ACTIONS
        ===================================== */}

        <section className="quick-actions">

          <div className="page-heading">

            <p className="eyebrow">
              QUICK ACTIONS
            </p>

            <h2>
              Continue Teaching
            </h2>

          </div>


          <section className="saved-plans-grid">

            {/* CREATE LESSON PLAN */}

            <Link
              to="/lesson-plan"
              className="saved-plan-card quick-action-card"
            >

              <span className="number">
                01
              </span>

              <h2>
                Create Lesson Plan
              </h2>

              <p className="plan-meta">
                Plan your next lesson →
              </p>

            </Link>


            {/* MANAGE CLASSES */}

            <Link
              to="/classes"
              className="saved-plan-card quick-action-card"
            >

              <span className="number">
                02
              </span>

              <h2>
                Manage Classes
              </h2>

              <p className="plan-meta">
                View your classes →
              </p>

            </Link>


            {/* MANAGE QUIZZES */}

            <Link
              to="/quizzes"
              className="saved-plan-card quick-action-card"
            >

              <span className="number">
                03
              </span>

              <h2>
                Manage Quizzes
              </h2>

              <p className="plan-meta">
                Create and review assessments →
              </p>

            </Link>


            {/* MANAGE RESOURCES */}

            <Link
              to="/resources"
              className="saved-plan-card quick-action-card"
            >

              <span className="number">
                04
              </span>

              <h2>
                Manage Resources
              </h2>

              <p className="plan-meta">
                View teaching materials →
              </p>

            </Link>

          </section>

        </section>


        {/* =====================================
            BACK TO DASHBOARD
        ===================================== */}

        <div className="new-plan-container">

          <Link
            to="/"
            className="generate"
          >
            ← Back to Dashboard
          </Link>

        </div>

      </main>

    </div>
  );
}

export default Analytics;