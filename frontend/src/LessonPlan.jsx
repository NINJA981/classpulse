import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

const EMPTY_FORM = {
  title: "",
  subject: "",
  grade: "",
  duration: "45",
  topic: "",
  objectives: "",
  activities: "",
  resources: "",
  assessment: "",
  notes: "",
};

function LessonPlan() {
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const name = event.target.name;
    const value = event.target.value;

    setForm(function (current) {
      return {
        ...current,
        [name]: value,
      };
    });

    setSaved(false);
    setError("");
  }

  function getSavedPlans() {
    try {
      const stored = localStorage.getItem("teacherGuideLessonPlans");

      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");
    setSaved(false);

    if (!form.title.trim()) {
      setError("Please enter the lesson title.");
      return;
    }

    if (!form.subject) {
      setError("Please select a subject.");
      return;
    }

    if (!form.grade) {
      setError("Please select a grade or class.");
      return;
    }

    if (!form.topic.trim()) {
      setError("Please enter the main topic.");
      return;
    }

    if (!form.objectives.trim()) {
      setError("Please enter the learning objectives.");
      return;
    }

    if (!form.activities.trim()) {
      setError("Please enter the teaching activities.");
      return;
    }

    if (!form.assessment.trim()) {
      setError("Please enter the assessment method.");
      return;
    }

    setSaving(true);

    try {
      const plans = getSavedPlans();

      const newPlan = {
        id: String(Date.now()) + "-" + String(Math.random()).slice(2, 8),
        title: form.title.trim(),
        subject: form.subject,
        grade: form.grade,
        duration: form.duration,
        topic: form.topic.trim(),
        objectives: form.objectives.trim(),
        activities: form.activities.trim(),
        resources: form.resources.trim(),
        assessment: form.assessment.trim(),
        notes: form.notes.trim(),
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(
        "teacherGuideLessonPlans",
        JSON.stringify(plans.concat(newPlan))
      );

      localStorage.removeItem("teacherGuidePlans");

      setSaved(true);

      window.setTimeout(function () {
        navigate("/saved-plans");
      }, 700);
    } catch (error) {
      console.error(error);
      setError("Unable to save the lesson plan.");
    } finally {
      setSaving(false);
    }
  }

  function clearForm() {
    if (saving) {
      return;
    }

    setForm(EMPTY_FORM);
    setSaved(false);
    setError("");
  }

  function cancelForm() {
    if (saving) {
      return;
    }

    navigate("/");
  }

  const footer = (
    <>
      <div>
        <strong>TEACHER GUIDE</strong>

        <span>
          Plan better. Teach smarter. Track progress.
        </span>
      </div>
    </>
  );

  return (
    <AppShell footer={footer}>
      <div className="lesson-container">
        <header className="page-header">
          <div className="page-header-copy">
            <p className="zine-label">LESSON PLANNER</p>

            <h1>Create Lesson Plan</h1>

            <p>
              Build a structured lesson with clear objectives,
              engaging activities, useful resources and assessment.
            </p>
          </div>

          <div className="page-header-side">
            <span className="ui-pill live-label">
              {saved ? <span className="live-dot" aria-hidden="true"></span> : null}
              {saved ? "Saved" : "Draft"}
            </span>

            <Link to="/" className="ui-button ui-button-secondary">
              ← Back to Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <div className="form-notice form-notice-error lessonplan-notice">
            {error}
          </div>
        )}

        {saved && (
          <div className="form-notice form-notice-success lessonplan-notice">
            <strong>Lesson plan saved successfully.</strong>
            <span>Opening Saved Lesson Plans...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-stack">
          <section className="panel">
            <div className="lessonplan-heading">
              <span className="index-circle index-circle-sm">01</span>

              <div className="lessonplan-heading-copy">
                <p className="zine-label">LESSON DETAILS</p>
                <h2 className="text-card-title">Start with the basics</h2>
                <span className="text-muted">
                  Add the basic information students need to
                  understand the lesson.
                </span>
              </div>
            </div>

            <div className="form-grid form-grid-3">
              <div className="form-field form-span-2">
                <label className="form-label" htmlFor="title">Lesson title</label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Example: Introduction to Algebra"
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="subject">Subject</label>

                <select
                  id="subject"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                >
                  <option value="">Select subject</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="English">English</option>
                  <option value="Computer Science">
                    Computer Science
                  </option>
                  <option value="Social Science">
                    Social Science
                  </option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="grade">Grade / Class</label>

                <select
                  id="grade"
                  name="grade"
                  value={form.grade}
                  onChange={handleChange}
                >
                  <option value="">Select class</option>
                  <option value="Grade 6">Grade 6</option>
                  <option value="Grade 7">Grade 7</option>
                  <option value="Grade 8">Grade 8</option>
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                  <option value="College">College</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="duration">Duration</label>

                <select
                  id="duration"
                  name="duration"
                  value={form.duration}
                  onChange={handleChange}
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                  <option value="120">120 minutes</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="topic">Main topic</label>

                <input
                  id="topic"
                  name="topic"
                  type="text"
                  value={form.topic}
                  onChange={handleChange}
                  placeholder="Example: Linear equations"
                />
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="lessonplan-heading">
              <span className="index-circle index-circle-sm">02</span>

              <div className="lessonplan-heading-copy">
                <p className="zine-label">LEARNING OBJECTIVES</p>
                <h2 className="text-card-title">What will students learn?</h2>
                <span className="text-muted">
                  Define the knowledge or skills students should gain.
                </span>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="objectives">
                Learning objectives
              </label>

              <textarea
                id="objectives"
                name="objectives"
                value={form.objectives}
                onChange={handleChange}
                placeholder="Students will be able to identify, explain and solve basic linear equations."
                rows={6}
              />
            </div>
          </section>

          <section className="panel">
            <div className="lessonplan-heading">
              <span className="index-circle index-circle-sm">03</span>

              <div className="lessonplan-heading-copy">
                <p className="zine-label">TEACHING ACTIVITIES</p>
                <h2 className="text-card-title">Plan the lesson flow</h2>
                <span className="text-muted">
                  Describe how you will introduce, teach and
                  reinforce the topic.
                </span>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="activities">Activities</label>

              <textarea
                id="activities"
                name="activities"
                value={form.activities}
                onChange={handleChange}
                placeholder={"1. Warm-up question\n2. Explain the concept\n3. Guided practice\n4. Individual activity\n5. Class discussion"}
                rows={8}
              />
            </div>
          </section>

          <section className="panel">
            <div className="lessonplan-heading">
              <span className="index-circle index-circle-sm">04</span>

              <div className="lessonplan-heading-copy">
                <p className="zine-label">RESOURCES</p>
                <h2 className="text-card-title">Teaching materials</h2>
                <span className="text-muted">
                  Add books, worksheets, presentations or other materials.
                </span>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="resources">Resources</label>

              <textarea
                id="resources"
                name="resources"
                value={form.resources}
                onChange={handleChange}
                placeholder="Example: Textbook chapter, worksheet, presentation slides."
                rows={6}
              />
            </div>
          </section>

          <section className="panel">
            <div className="lessonplan-heading">
              <span className="index-circle index-circle-sm">05</span>

              <div className="lessonplan-heading-copy">
                <p className="zine-label">ASSESSMENT</p>
                <h2 className="text-card-title">Check student understanding</h2>
                <span className="text-muted">
                  Describe how you will evaluate learning during
                  or after the lesson.
                </span>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="assessment">
                Assessment method
              </label>

              <textarea
                id="assessment"
                name="assessment"
                value={form.assessment}
                onChange={handleChange}
                placeholder="Example: Five-question exit quiz and observation during guided practice."
                rows={6}
              />
            </div>
          </section>

          <section className="panel">
            <div className="lessonplan-heading">
              <span className="index-circle index-circle-sm">06</span>

              <div className="lessonplan-heading-copy">
                <p className="zine-label">TEACHER NOTES</p>
                <h2 className="text-card-title">Additional notes</h2>
                <span className="text-muted">
                  Keep reminders, differentiation ideas or follow-up actions.
                </span>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="notes">Notes</label>

              <textarea
                id="notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Add any additional notes for this lesson..."
                rows={6}
              />
            </div>
          </section>

          <div className="form-actions">
            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={clearForm}
              disabled={saving}
            >
              Clear
            </button>

            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={cancelForm}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="ui-button ui-button-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Lesson Plan"}
              <span>→</span>
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export default LessonPlan;