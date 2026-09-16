import React from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

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
      <AppShell>
        <div className="tg-content">
          <div className="page-center">
            <div className="empty-block">
              <p className="zine-label">Lesson plan</p>
              <h1>Lesson plan not found.</h1>
              <p>
                This lesson plan may have been deleted or does not exist.
              </p>

              <Link to="/saved-plans" className="ui-button ui-button-primary">
                ← Back to Lesson Plans
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }


  const footer = (
    <>
      <div>
        <strong>TEACHER GUIDE</strong>
        <span>Plan better. Teach smarter. Track progress.</span>
      </div>

      <span>© 2026</span>
    </>
  );

  return (
    <AppShell footer={footer}>
      <div className="tg-content">
        <header className="page-header">
          <div className="page-header-copy">
            <p className="zine-label">LESSON PLAN</p>

            <h1>{plan.title || "Untitled Lesson"}</h1>

            <p>
              {plan.subject || "Subject"} •{" "}
              {plan.grade || "Class"} •{" "}
              {plan.duration
                ? `${plan.duration} minutes`
                : "Duration not specified"}
            </p>
          </div>

          <div className="page-header-side">
            <Link to="/saved-plans" className="ui-button ui-button-secondary">
              ← Back to Lesson Plans
            </Link>
          </div>
        </header>

        <section className="card-grid card-grid-2">
          <LessonSection
            number="01"
            title="Lesson Details"
            value={plan.topic}
            featured
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
      </div>
    </AppShell>
  );
}

function LessonSection({ number, title, value, featured = false }) {
  return (
    <section
      className={featured ? "stack-card pad-6" : "ui-card pad-6"}
    >
      <div className="lessonview-card-top">
        {number ? <span className="index-circle index-circle-sm">{number}</span> : null}
        <p className="zine-label">{title}</p>
      </div>

      <div className="lessonview-card-content">
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
          <p className="lessonview-empty">No information added.</p>
        )}
      </div>
    </section>
  );
}

export default LessonView;
