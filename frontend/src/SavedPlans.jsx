import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function SavedPlans() {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    loadPlans();

    const handleStorageChange = () => {
      loadPlans();
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  function loadPlans() {
    try {
      const data =
        localStorage.getItem("teacherGuideLessonPlans") ||
        localStorage.getItem("teacherGuidePlans");

      if (!data) {
        setPlans([]);
        return;
      }

      const savedPlans = JSON.parse(data);

      if (!Array.isArray(savedPlans)) {
        setPlans([]);
        return;
      }

      setPlans(savedPlans);
    } catch (error) {
      console.error("Error loading lesson plans:", error);
      setPlans([]);
    }
  }

  function deletePlan(planToDelete) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this lesson plan?"
    );

    if (!confirmed) {
      return;
    }

    const updatedPlans = plans.filter((plan) => {
      if (planToDelete.id !== undefined && planToDelete.id !== null) {
        return plan.id !== planToDelete.id;
      }

      return plan !== planToDelete;
    });

    localStorage.setItem(
      "teacherGuideLessonPlans",
      JSON.stringify(updatedPlans)
    );

    localStorage.setItem(
      "teacherGuidePlans",
      JSON.stringify(updatedPlans)
    );

    setPlans(updatedPlans);
    setSelectedPlan(null);
  }

  function deleteAllPlans() {
    if (plans.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete all lesson plans?"
    );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem("teacherGuideLessonPlans");
    localStorage.removeItem("teacherGuidePlans");

    setPlans([]);
    setSelectedPlan(null);
  }

  function formatDate(plan) {
    const dateValue =
      plan.createdAt ||
      plan.savedAt ||
      plan.updatedAt;

    if (!dateValue) {
      return "Recently saved";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getTitle(plan) {
    return (
      plan.title ||
      plan.lessonTitle ||
      plan.name ||
      plan.topic ||
      "Untitled Lesson Plan"
    );
  }

  function getGrade(plan) {
    return (
      plan.grade ||
      plan.class ||
      plan.gradeClass ||
      "Not specified"
    );
  }

  function getDuration(plan) {
    if (!plan.duration) {
      return "Not specified";
    }

    if (
      typeof plan.duration === "string" &&
      plan.duration.toLowerCase().includes("minute")
    ) {
      return plan.duration;
    }

    return `${plan.duration} minutes`;
  }

  function getObjectives(plan) {
    return (
      plan.objectives ||
      plan.learningObjectives ||
      "No learning objectives added."
    );
  }

  function getActivities(plan) {
    return (
      plan.activities ||
      plan.teachingActivities ||
      "No activities added."
    );
  }

  function getResources(plan) {
    return (
      plan.resources ||
      plan.teachingResources ||
      "No resources added."
    );
  }

  function getAssessment(plan) {
    return (
      plan.assessment ||
      plan.assessmentMethod ||
      "No assessment added."
    );
  }

  function getNotes(plan) {
    return (
      plan.notes ||
      plan.teacherNotes ||
      "No teacher notes added."
    );
  }

  return (
    <div className="saved-plans-page">
      <header className="saved-plans-header">
        <div className="saved-plans-brand">
          <Link to="/" className="saved-plans-logo">
            TG
          </Link>

          <div>
            <Link to="/" className="saved-plans-brand-name">
              TEACHER GUIDE
            </Link>

            <span>TEACHER WORKSPACE</span>
          </div>
        </div>

        <nav className="saved-plans-nav">
          <Link to="/">Dashboard</Link>

          <Link to="/saved-plans" className="active">
            Lesson Plans
          </Link>

          <Link to="/classes">My Classes</Link>

          <Link to="/resources">Resources</Link>

          <Link to="/quizzes">Quizzes</Link>

          <Link to="/analytics">Analytics</Link>
        </nav>

        <div className="saved-plans-profile">
          <div className="saved-plans-avatar">T</div>

          <div>
            <strong>Teacher</strong>
            <span>Administrator</span>
          </div>
        </div>
      </header>

      <main className="saved-plans-container">
        <section className="saved-plans-hero">
          <div>
            <p className="saved-plans-eyebrow">
              LESSON LIBRARY
            </p>

            <h1>Saved Lesson Plans</h1>

            <p>
              View and manage all the lesson plans you have created.
            </p>
          </div>

          <div className="saved-plans-hero-actions">
            {plans.length > 0 && (
              <button
                type="button"
                className="delete-all-button"
                onClick={deleteAllPlans}
              >
                Delete All
              </button>
            )}

            <Link
              to="/lesson-plan"
              className="create-plan-button"
            >
              Create Lesson Plan
            </Link>
          </div>
        </section>

        <section className="saved-plans-summary">
          <div className="summary-box">
            <span className="summary-label">
              SAVED PLANS
            </span>

            <strong>{plans.length}</strong>

            <span>
              {plans.length === 1
                ? "Lesson plan"
                : "Lesson plans"}
            </span>
          </div>

          <div className="summary-box">
            <span className="summary-label">
              LIBRARY STATUS
            </span>

            <strong>Ready</strong>

            <span>Stored in this browser</span>
          </div>
        </section>

        {plans.length === 0 ? (
          <section className="empty-plans">
            <div className="empty-number">01</div>

            <div>
              <p className="saved-plans-eyebrow">
                EMPTY LIBRARY
              </p>

              <h2>No lesson plans yet</h2>

              <p>
                Create your first lesson plan and it will appear here.
              </p>

              <Link
                to="/lesson-plan"
                className="create-plan-button"
              >
                Create Lesson Plan
              </Link>
            </div>
          </section>
        ) : (
          <section className="saved-plans-list">
            {plans.map((plan, index) => (
              <article
                className="saved-plan-card"
                key={
                  plan.id !== undefined
                    ? plan.id
                    : `plan-${index}`
                }
              >
                <div className="saved-plan-number">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="saved-plan-main">
                  <div className="saved-plan-top">
                    <span className="plan-subject">
                      {plan.subject || "General"}
                    </span>

                    <span className="saved-badge">
                      Saved
                    </span>
                  </div>

                  <h2>{getTitle(plan)}</h2>

                  <p className="saved-plan-topic">
                    {plan.topic || "No topic added"}
                  </p>

                  <div className="saved-plan-details">
                    <div>
                      <span>Subject</span>

                      <strong>
                        {plan.subject || "Not specified"}
                      </strong>
                    </div>

                    <div>
                      <span>Class</span>

                      <strong>{getGrade(plan)}</strong>
                    </div>

                    <div>
                      <span>Duration</span>

                      <strong>{getDuration(plan)}</strong>
                    </div>

                    <div>
                      <span>Created</span>

                      <strong>{formatDate(plan)}</strong>
                    </div>
                  </div>

                  <div className="saved-plan-preview">
                    <div>
                      <span>Learning Objectives</span>

                      <p>{getObjectives(plan)}</p>
                    </div>

                    <div>
                      <span>Activities</span>

                      <p>{getActivities(plan)}</p>
                    </div>

                    <div>
                      <span>Assessment</span>

                      <p>{getAssessment(plan)}</p>
                    </div>
                  </div>
                </div>

                <div className="saved-plan-actions">
                  <button
                    type="button"
                    className="view-plan-button"
                    onClick={() => setSelectedPlan(plan)}
                  >
                    View Plan
                  </button>

                  <button
                    type="button"
                    className="delete-plan-button"
                    onClick={() => deletePlan(plan)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        <div className="saved-plans-back">
          <Link to="/">Back to Dashboard</Link>
        </div>
      </main>

      {selectedPlan && (
        <div
          className="plan-modal-overlay"
          onClick={() => setSelectedPlan(null)}
        >
          <div
            className="plan-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="plan-modal-header">
              <div>
                <p className="saved-plans-eyebrow">
                  SAVED LESSON PLAN
                </p>

                <h2>{getTitle(selectedPlan)}</h2>

                <p>
                  {selectedPlan.subject || "General"}
                  {" · "}
                  {getGrade(selectedPlan)}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() => setSelectedPlan(null)}
              >
                Close
              </button>
            </div>

            <div className="modal-details">
              <div>
                <span>Subject</span>

                <strong>
                  {selectedPlan.subject || "Not specified"}
                </strong>
              </div>

              <div>
                <span>Class</span>

                <strong>{getGrade(selectedPlan)}</strong>
              </div>

              <div>
                <span>Duration</span>

                <strong>{getDuration(selectedPlan)}</strong>
              </div>

              <div>
                <span>Created</span>

                <strong>{formatDate(selectedPlan)}</strong>
              </div>
            </div>

            <div className="modal-content">
              <div>
                <h3>Main Topic</h3>

                <p>
                  {selectedPlan.topic ||
                    "No topic added."}
                </p>
              </div>

              <div>
                <h3>Learning Objectives</h3>

                <p>{getObjectives(selectedPlan)}</p>
              </div>

              <div>
                <h3>Teaching Activities</h3>

                <p>{getActivities(selectedPlan)}</p>
              </div>

              <div>
                <h3>Resources</h3>

                <p>{getResources(selectedPlan)}</p>
              </div>

              <div>
                <h3>Assessment</h3>

                <p>{getAssessment(selectedPlan)}</p>
              </div>

              <div>
                <h3>Teacher Notes</h3>

                <p>{getNotes(selectedPlan)}</p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="delete-plan-button"
                onClick={() => deletePlan(selectedPlan)}
              >
                Delete Plan
              </button>

              <button
                type="button"
                className="view-plan-button"
                onClick={() => setSelectedPlan(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="saved-plans-footer">
        <div>
          <strong>TEACHER GUIDE</strong>

          <span>
            Plan better. Teach smarter. Track progress.
          </span>
        </div>

        <Link to="/">Dashboard</Link>
      </footer>
    </div>
  );
}

export default SavedPlans;