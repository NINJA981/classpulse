import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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

  return (
    <div className="lesson-page">
      <header className="lesson-topbar">
        <Link to="/" className="lesson-brand">
          <span className="lesson-logo">TG</span>

          <span className="lesson-brand-text">
            <strong>TEACHER GUIDE</strong>
            <small>TEACHER WORKSPACE</small>
          </span>
        </Link>

        <Link to="/" className="lesson-back">
          ← Back to Dashboard
        </Link>
      </header>

      <main className="lesson-container">
        <section className="lesson-hero">
          <div>
            <p className="lesson-eyebrow">LESSON PLANNER</p>

            <h1>Create Lesson Plan</h1>

            <p>
              Build a structured lesson with clear objectives,
              engaging activities, useful resources and assessment.
            </p>
          </div>

          <div className="lesson-status">
            <span className="status-dot"></span>
            {saved ? "Saved" : "Draft"}
          </div>
        </section>

        {error && (
          <div className="lesson-error">
            {error}
          </div>
        )}

        {saved && (
          <div className="lesson-success">
            <strong>Lesson plan saved successfully.</strong>
            <span>Opening Saved Lesson Plans...</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <section className="lesson-card">
            <div className="lesson-card-heading">
              <span className="lesson-step">01</span>

              <div>
                <p>LESSON DETAILS</p>
                <h2>Start with the basics</h2>
                <span>
                  Add the basic information students need to
                  understand the lesson.
                </span>
              </div>
            </div>

            <div className="lesson-form-grid">
              <div className="lesson-field full">
                <label htmlFor="title">Lesson title</label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Example: Introduction to Algebra"
                />
              </div>

              <div className="lesson-field">
                <label htmlFor="subject">Subject</label>

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

              <div className="lesson-field">
                <label htmlFor="grade">Grade / Class</label>

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

              <div className="lesson-field">
                <label htmlFor="duration">Duration</label>

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

              <div className="lesson-field">
                <label htmlFor="topic">Main topic</label>

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

          <section className="lesson-card">
            <div className="lesson-card-heading">
              <span className="lesson-step">02</span>

              <div>
                <p>LEARNING OBJECTIVES</p>
                <h2>What will students learn?</h2>
                <span>
                  Define the knowledge or skills students should gain.
                </span>
              </div>
            </div>

            <div className="lesson-field">
              <label htmlFor="objectives">
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

          <section className="lesson-card">
            <div className="lesson-card-heading">
              <span className="lesson-step">03</span>

              <div>
                <p>TEACHING ACTIVITIES</p>
                <h2>Plan the lesson flow</h2>
                <span>
                  Describe how you will introduce, teach and
                  reinforce the topic.
                </span>
              </div>
            </div>

            <div className="lesson-field">
              <label htmlFor="activities">Activities</label>

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

          <section className="lesson-card">
            <div className="lesson-card-heading">
              <span className="lesson-step">04</span>

              <div>
                <p>RESOURCES</p>
                <h2>Teaching materials</h2>
                <span>
                  Add books, worksheets, presentations or other materials.
                </span>
              </div>
            </div>

            <div className="lesson-field">
              <label htmlFor="resources">Resources</label>

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

          <section className="lesson-card">
            <div className="lesson-card-heading">
              <span className="lesson-step">05</span>

              <div>
                <p>ASSESSMENT</p>
                <h2>Check student understanding</h2>
                <span>
                  Describe how you will evaluate learning during
                  or after the lesson.
                </span>
              </div>
            </div>

            <div className="lesson-field">
              <label htmlFor="assessment">
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

          <section className="lesson-card">
            <div className="lesson-card-heading">
              <span className="lesson-step">06</span>

              <div>
                <p>TEACHER NOTES</p>
                <h2>Additional notes</h2>
                <span>
                  Keep reminders, differentiation ideas or follow-up actions.
                </span>
              </div>
            </div>

            <div className="lesson-field">
              <label htmlFor="notes">Notes</label>

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

          <div className="lesson-actions">
            <button
              type="button"
              className="lesson-secondary"
              onClick={clearForm}
              disabled={saving}
            >
              Clear
            </button>

            <button
              type="button"
              className="lesson-secondary"
              onClick={cancelForm}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="lesson-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Lesson Plan"}
              <span>→</span>
            </button>
          </div>
        </form>
      </main>

      <footer className="lesson-footer">
        <strong>TEACHER GUIDE</strong>

        <span>
          Plan better. Teach smarter. Track progress.
        </span>
      </footer>

      <style>{`
        .lesson-page {
          min-height: 100vh;
          background: #f5f5f2;
          color: #111;
        }

        .lesson-topbar {
          min-height: 76px;
          padding: 0 42px;
          background: #fff;
          border-bottom: 1px solid #d7d7d2;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .lesson-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lesson-logo {
          width: 40px;
          height: 40px;
          border: 1px solid #111;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 900;
        }

        .lesson-brand-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .lesson-brand-text strong {
          font-size: 15px;
          letter-spacing: 1px;
        }

        .lesson-brand-text small {
          color: #777;
          font-size: 8px;
          letter-spacing: 1.7px;
        }

        .lesson-back {
          font-size: 11px;
          font-weight: 800;
          border-bottom: 1px solid #111;
          padding-bottom: 4px;
        }

        .lesson-container {
          width: min(1050px, calc(100% - 40px));
          margin: 0 auto;
          padding: 55px 0 70px;
        }

        .lesson-hero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 30px;
        }

        .lesson-eyebrow {
          margin: 0 0 12px;
          color: #777;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .lesson-hero h1 {
          margin: 0;
          font-size: clamp(44px, 7vw, 72px);
          line-height: .92;
          letter-spacing: -4px;
        }

        .lesson-hero p:last-child {
          max-width: 650px;
          margin: 20px 0 0;
          color: #666;
          font-size: 13px;
          line-height: 1.7;
        }

        .lesson-status {
          min-width: 90px;
          height: 38px;
          padding: 0 13px;
          border: 1px solid #cfcfca;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 10px;
          font-weight: 800;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #111;
        }

        .lesson-error,
        .lesson-success {
          margin-bottom: 18px;
          padding: 14px 17px;
          background: #fff;
          border: 1px solid #111;
          font-size: 11px;
        }

        .lesson-success {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .lesson-success span {
          color: #777;
        }

        .lesson-card {
          margin-bottom: 16px;
          padding: 30px;
          background: #fff;
          border: 1px solid #d6d6d1;
        }

        .lesson-card-heading {
          display: flex;
          gap: 18px;
          padding-bottom: 20px;
          margin-bottom: 25px;
          border-bottom: 1px solid #e5e5e0;
        }

        .lesson-step {
          color: #888;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .lesson-card-heading p {
          margin: 0 0 7px;
          color: #777;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.8px;
        }

        .lesson-card-heading h2 {
          margin: 0 0 7px;
          font-size: 21px;
          letter-spacing: -.5px;
        }

        .lesson-card-heading span:not(.lesson-step) {
          color: #777;
          font-size: 11px;
          line-height: 1.5;
        }

        .lesson-form-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .lesson-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .lesson-field.full {
          grid-column: 1 / -1;
        }

        .lesson-field label {
          color: #444;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .lesson-field input,
        .lesson-field select,
        .lesson-field textarea {
          width: 100%;
          padding: 12px 13px;
          border: 1px solid #cfcfc9;
          background: #fff;
          color: #111;
          outline: none;
          font-size: 12px;
        }

        .lesson-field input,
        .lesson-field select {
          height: 44px;
        }

        .lesson-field textarea {
          min-height: 130px;
          resize: vertical;
          line-height: 1.55;
        }

        .lesson-field input:focus,
        .lesson-field select:focus,
        .lesson-field textarea:focus {
          border-color: #111;
          box-shadow: 4px 4px 0 #ddd;
        }

        .lesson-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }

        .lesson-primary,
        .lesson-secondary {
          min-height: 44px;
          padding: 0 20px;
          border: 1px solid #111;
          font-size: 11px;
          font-weight: 900;
        }

        .lesson-primary {
          background: #111;
          color: #fff;
          display: inline-flex;
          align-items: center;
          gap: 14px;
        }

        .lesson-primary:hover {
          background: #333;
        }

        .lesson-secondary {
          background: #fff;
          color: #111;
        }

        .lesson-secondary:hover {
          background: #eee;
        }

        .lesson-primary:disabled,
        .lesson-secondary:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .lesson-footer {
          min-height: 85px;
          padding: 20px 42px;
          background: #fff;
          border-top: 1px solid #d7d7d2;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .lesson-footer strong {
          font-size: 10px;
          letter-spacing: 1.5px;
        }

        .lesson-footer span {
          color: #777;
          font-size: 10px;
        }

        @media (max-width: 800px) {
          .lesson-topbar {
            padding: 15px 20px;
          }

          .lesson-container {
            width: calc(100% - 30px);
            padding-top: 35px;
          }

          .lesson-hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .lesson-form-grid {
            grid-template-columns: 1fr;
          }

          .lesson-field.full {
            grid-column: auto;
          }

          .lesson-card {
            padding: 22px;
          }

          .lesson-actions {
            flex-direction: column;
          }

          .lesson-actions button {
            width: 100%;
          }

          .lesson-footer {
            padding: 20px;
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}

export default LessonPlan;