import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

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


  const footer = (
    <>
      <div>
        <strong>TEACHER GUIDE</strong>

        <span>
          Plan better. Teach smarter. Track progress.
        </span>
      </div>

      <Link to="/" className="ui-button ui-button-secondary">
        Dashboard
      </Link>
    </>
  );

  return (
    <AppShell footer={footer}>
      <div className="saved-plans-container">
        <header className="page-header">
          <div className="page-header-copy">
            <p className="zine-label">
              LESSON LIBRARY
            </p>

            <h1>Saved Lesson Plans</h1>

            <p>
              View and manage all the lesson plans you have created.
            </p>
          </div>

          <div className="page-header-side">
            {plans.length > 0 && (
              <button
                type="button"
                className="ui-button ui-button-danger"
                onClick={deleteAllPlans}
              >
                Delete All
              </button>
            )}

            <Link
              to="/lesson-plan"
              className="ui-button ui-button-primary"
            >
              Create Lesson Plan
            </Link>
          </div>
        </header>

        <section className="stat-grid">
          <div className="hypercard-static stat-tile">
            <p className="zine-label">
              SAVED PLANS
            </p>

            <p className="stat-tile-value">{plans.length}</p>

            <p className="card-body">
              {plans.length === 1
                ? "Lesson plan"
                : "Lesson plans"}
            </p>
          </div>

          <div className="hypercard-static stat-tile">
            <p className="zine-label">
              LIBRARY STATUS
            </p>

            <p className="stat-tile-value">Ready</p>

            <p className="card-body">Stored in this browser</p>
          </div>
        </section>

        {plans.length === 0 ? (
          <section className="empty-block section-block">
            <p className="zine-label">
              EMPTY LIBRARY
            </p>

            <h2>No lesson plans yet</h2>

            <p>
              Create your first lesson plan and it will appear here.
            </p>

            <Link
              to="/lesson-plan"
              className="ui-button ui-button-primary"
            >
              Create Lesson Plan
            </Link>
          </section>
        ) : (
          <section className="card-grid section-block">
            {plans.map((plan, index) => (
              <article
                className="ui-card pad-6"
                key={
                  plan.id !== undefined
                    ? plan.id
                    : `plan-${index}`
                }
              >
                <div className="card-top">
                  <span className="ui-pill ui-pill-dark">
                    Saved
                  </span>
                </div>

                <p className="zine-label">
                  {plan.subject || "General"}
                </p>

                <h2 className="card-title">{getTitle(plan)}</h2>

                <p className="card-body">
                  {plan.topic || "No topic added"}
                </p>

                <div className="detail-grid">
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

                <div className="detail-section">
                  <span>Learning Objectives</span>

                  <p>{getObjectives(plan)}</p>
                </div>

                <div className="detail-section">
                  <span>Activities</span>

                  <p>{getActivities(plan)}</p>
                </div>

                <div className="detail-section">
                  <span>Assessment</span>

                  <p>{getAssessment(plan)}</p>
                </div>

                <div className="card-foot">
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={() => setSelectedPlan(plan)}
                  >
                    View Plan
                  </button>

                  <button
                    type="button"
                    className="ui-button ui-button-danger"
                    onClick={() => deletePlan(plan)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        <div className="back-row">
          <Link to="/" className="ui-button ui-button-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>

      {selectedPlan && (
        <div
          className="ui-modal-overlay"
          onClick={() => setSelectedPlan(null)}
        >
          <div
            className="ui-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ui-modal-header">
              <div>
                <p className="zine-label">
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
                className="ui-button ui-button-secondary ui-button-icon"
                aria-label="Close"
                onClick={() => setSelectedPlan(null)}
              >
                ×
              </button>
            </div>

            <div className="ui-modal-body">
              <div className="detail-grid">
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

              <div className="stack-3">
                <div className="detail-section">
                  <h3 className="zine-label">Main Topic</h3>

                  <p>
                    {selectedPlan.topic ||
                      "No topic added."}
                  </p>
                </div>

                <div className="detail-section">
                  <h3 className="zine-label">Learning Objectives</h3>

                  <p>{getObjectives(selectedPlan)}</p>
                </div>

                <div className="detail-section">
                  <h3 className="zine-label">Teaching Activities</h3>

                  <p>{getActivities(selectedPlan)}</p>
                </div>

                <div className="detail-section">
                  <h3 className="zine-label">Resources</h3>

                  <p>{getResources(selectedPlan)}</p>
                </div>

                <div className="detail-section">
                  <h3 className="zine-label">Assessment</h3>

                  <p>{getAssessment(selectedPlan)}</p>
                </div>

                <div className="detail-section">
                  <h3 className="zine-label">Teacher Notes</h3>

                  <p>{getNotes(selectedPlan)}</p>
                </div>
              </div>
            </div>

            <div className="ui-modal-footer">
              <button
                type="button"
                className="ui-button ui-button-danger"
                onClick={() => deletePlan(selectedPlan)}
              >
                Delete Plan
              </button>

              <button
                type="button"
                className="ui-button ui-button-secondary"
                onClick={() => setSelectedPlan(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default SavedPlans;
