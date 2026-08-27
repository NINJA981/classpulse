import React from "react";
import { Link, useParams } from "react-router-dom";

function LessonView() {
  const { id } = useParams();
  const [plan, setPlan] = React.useState(null);

  React.useEffect(() => {
    try {
      const savedPlans =
        JSON.parse(localStorage.getItem("teacherGuideLessonPlans")) || [];

      const foundPlan = savedPlans.find(
        (item) => String(item.id) === String(id)
      );

      setPlan(foundPlan || null);
    } catch (error) {
      console.error("Unable to load lesson plan:", error);
      setPlan(null);
    }
  }, [id]);

  if (!plan) {
    return (
      <div className="tg-page">
        <header className="tg-header">
          <Link to="/" className="tg-brand">
            <span className="tg-logo">TG</span>
            <span className="tg-brand-text">
              <strong>TEACHER GUIDE</strong>
              <small>TEACHER WORKSPACE</small>
            </span>
          </Link>

          <nav className="tg-nav">
            <Link to="/">Dashboard</Link>
            <Link to="/saved-plans">Lesson Plans</Link>
            <Link to="/classes">My Classes</Link>
            <Link to="/resources">Resources</Link>
            <Link to="/quizzes">Quizzes</Link>
            <Link to="/analytics">Analytics</Link>
          </nav>
        </header>

        <main className="tg-content">
          <div className="tg-not-found">
            <span>404</span>
            <h1>Lesson plan not found.</h1>
            <p>
              This lesson plan may have been deleted or does not exist.
            </p>

            <Link to="/saved-plans" className="tg-primary">
              ← Back to Lesson Plans
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="tg-page">
      <header className="tg-header">
        <Link to="/" className="tg-brand">
          <span className="tg-logo">TG</span>

          <span className="tg-brand-text">
            <strong>TEACHER GUIDE</strong>
            <small>TEACHER WORKSPACE</small>
          </span>
        </Link>

        <nav className="tg-nav">
          <Link to="/">Dashboard</Link>
          <Link className="active" to="/saved-plans">
            Lesson Plans
          </Link>
          <Link to="/classes">My Classes</Link>
          <Link to="/resources">Resources</Link>
          <Link to="/quizzes">Quizzes</Link>
          <Link to="/analytics">Analytics</Link>
        </nav>

        <div className="tg-profile">
          <span className="tg-avatar">T</span>
          <span>
            <strong>Teacher</strong>
            <small>Administrator</small>
          </span>
        </div>
      </header>

      <main className="tg-content">
        <section className="tg-lesson-hero">
          <p className="tg-eyebrow">LESSON PLAN</p>

          <h1>{plan.title || "Untitled Lesson"}</h1>

          <p className="tg-subtitle">
            {plan.subject || "Subject"} ·{" "}
            {plan.grade || "Class"} ·{" "}
            {plan.duration
              ? `${plan.duration} minutes`
              : "Duration not specified"}
          </p>

          <div className="tg-actions">
            <Link to="/saved-plans" className="tg-secondary">
              ← Back to Lesson Plans
            </Link>
          </div>
        </section>

        <section className="tg-lesson-grid">
          <LessonSection
            number="01"
            title="Lesson Details"
            value={plan.topic}
          />

          <LessonSection
            number="02"
            title="Learning Objectives"
            value={plan.objectives}
          />

          <LessonSection
            number="03"
            title="Teaching Activities"
            value={plan.activities}
          />

          <LessonSection
            number="04"
            title="Resources"
            value={plan.resources}
          />

          <LessonSection
            number="05"
            title="Assessment"
            value={plan.assessment}
          />

          <LessonSection
            number="06"
            title="Teacher Notes"
            value={plan.notes}
          />
        </section>
      </main>

      <footer className="tg-footer">
        <div>
          <strong>TEACHER GUIDE</strong>
          <span>Plan better. Teach smarter. Track progress.</span>
        </div>

        <span>© 2026</span>
      </footer>
    </div>
  );
}

function LessonSection({ number, title, value }) {
  return (
    <section className="tg-lesson-card">
      <div className="tg-card-number">{number}</div>

      <div>
        <p className="tg-eyebrow">{title}</p>

        <div className="tg-card-content">
          {value ? (
            Array.isArray(value) ? (
              <ul>
                {value.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>{value}</p>
            )
          ) : (
            <p className="tg-empty">No information added.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default LessonView;