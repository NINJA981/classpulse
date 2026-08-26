import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

function LessonView() {
  const { id } = useParams();

  const [plan, setPlan] = useState(null);

  useEffect(() => {
    const savedPlans =
      JSON.parse(localStorage.getItem("teacherGuidePlans")) || [];

    const selectedPlan = savedPlans.find(
      (item) => String(item.id) === String(id)
    );

    setPlan(selectedPlan);
  }, [id]);

  if (!plan) {
    return (
      <div className="lesson-page">

        <header className="topbar">

          <div className="logo">
            TEACHER GUIDE
          </div>

          <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/saved-plans">Lesson Plans</Link>
            <a href="#">My Classes</a>
            <a href="#">Resources</a>
          </nav>

          <button className="profile">
            Teacher
          </button>

        </header>

        <main className="lesson-main">

          <div className="page-heading">

            <p className="eyebrow">
              LESSON PLAN
            </p>

            <h1>
              Plan Not Found
            </h1>

            <p className="page-description">
              This lesson plan could not be found.
            </p>

          </div>

          <Link
            to="/saved-plans"
            className="generate"
          >
            ← Back to Lesson Plans
          </Link>

        </main>

      </div>
    );
  }

  return (
    <div className="lesson-page">

      {/* HEADER */}

      <header className="topbar">

        <div className="logo">
          TEACHER GUIDE
        </div>

        <nav>
          <Link to="/">Dashboard</Link>

          <Link to="/saved-plans">
            Lesson Plans
          </Link>

          <a href="#">
            My Classes
          </a>

          <a href="#">
            Resources
          </a>
        </nav>

        <button className="profile">
          Teacher
        </button>

      </header>


      {/* MAIN */}

      <main className="lesson-main">

        <section className="generated-plan">

          {/* TITLE */}

          <div className="page-heading">

            <p className="eyebrow">
              SAVED LESSON PLAN
            </p>

            <h1>
              {plan.topic}
            </h1>

            <p className="page-description">
              {plan.subject} · {plan.grade} · {plan.duration}
            </p>

          </div>


          {/* LESSON SECTIONS */}

          <div className="plan-grid">

            {/* OBJECTIVES */}

            <div className="plan-section">

              <span className="number">
                01
              </span>

              <h2>
                Learning Objectives
              </h2>

              <p>
                {plan.objectives}
              </p>

            </div>


            {/* INTRODUCTION */}

            <div className="plan-section">

              <span className="number">
                02
              </span>

              <h2>
                Introduction
              </h2>

              <p>
                {plan.introduction}
              </p>

            </div>


            {/* ACTIVITIES */}

            <div className="plan-section">

              <span className="number">
                03
              </span>

              <h2>
                Teaching Activities
              </h2>

              <p>
                {plan.activities}
              </p>

            </div>


            {/* ASSESSMENT */}

            <div className="plan-section">

              <span className="number">
                04
              </span>

              <h2>
                Assessment
              </h2>

              <p>
                {plan.assessment}
              </p>

            </div>


            {/* HOMEWORK */}

            <div className="plan-section">

              <span className="number">
                05
              </span>

              <h2>
                Homework
              </h2>

              <p>
                {plan.homework}
              </p>

            </div>

          </div>


          {/* BACK BUTTON */}

          <Link
            to="/saved-plans"
            className="generate"
          >
            ← Back to Lesson Plans
          </Link>

        </section>

      </main>

    </div>
  );
}

export default LessonView;