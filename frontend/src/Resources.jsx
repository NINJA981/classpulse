import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Resources() {
  const [resources, setResources] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    title: "",
    type: "Worksheet",
    subject: "Mathematics",
    description: "",
  });

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = () => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("teacherGuideResources") || "[]"
      );

      setResources(Array.isArray(saved) ? saved : []);
    } catch (error) {
      console.error("Error loading resources:", error);
      setResources([]);
    }
  };

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  };

  const addResource = (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("Please enter a resource title.");
      return;
    }

    const newResource = {
      id: Date.now().toString(),
      title: form.title.trim(),
      type: form.type,
      subject: form.subject,
      description:
        form.description.trim() || "Teaching material",
      createdAt: new Date().toISOString(),
    };

    const updatedResources = [newResource, ...resources];

    localStorage.setItem(
      "teacherGuideResources",
      JSON.stringify(updatedResources)
    );

    setResources(updatedResources);

    setForm({
      title: "",
      type: "Worksheet",
      subject: "Mathematics",
      description: "",
    });

    setShowForm(false);
  };

  const deleteResource = (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this resource?"
    );

    if (!confirmed) {
      return;
    }

    const updatedResources = resources.filter(
      (resource) => resource.id !== id
    );

    localStorage.setItem(
      "teacherGuideResources",
      JSON.stringify(updatedResources)
    );

    setResources(updatedResources);
  };

  return (
    <div className="dashboard-page">

      {/* HEADER */}

      <header className="topbar">

        <Link to="/" className="brand-area">

          <div className="brand-mark">
            TG
          </div>

          <div>
            <div className="brand">
              TEACHER GUIDE
            </div>

            <div className="brand-subtitle">
              TEACHER WORKSPACE
            </div>
          </div>

        </Link>

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

          <Link
            to="/resources"
            className="active"
          >
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

          <div className="profile-avatar">
            H
          </div>

          <div className="profile-info">

            <strong>
              Teacher
            </strong>

            <span>
              Administrator
            </span>

          </div>

        </div>

      </header>

      {/* MAIN */}

      <main className="dashboard-content">

        <section className="welcome-section">

          <div className="welcome-copy">

            <p className="eyebrow">
              RESOURCE LIBRARY
            </p>

            <h1>
              Teaching
              <br />
              <span>Resources.</span>
            </h1>

            <p className="welcome-text">
              Keep worksheets, notes, documents and other
              teaching materials organized in one place.
            </p>

          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setShowForm(!showForm)}
          >
            <span>＋</span>
            Add Resource
          </button>

        </section>

        {/* SUMMARY */}

        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                □
              </div>
            </div>

            <div className="stat-label">
              TOTAL RESOURCES
            </div>

            <div className="stat-value">
              {resources.length}
            </div>

            <div className="stat-detail">
              Teaching materials
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                ▤
              </div>
            </div>

            <div className="stat-label">
              WORKSHEETS
            </div>

            <div className="stat-value">
              {
                resources.filter(
                  (item) => item.type === "Worksheet"
                ).length
              }
            </div>

            <div className="stat-detail">
              Practice materials
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                ▣
              </div>
            </div>

            <div className="stat-label">
              NOTES
            </div>

            <div className="stat-value">
              {
                resources.filter(
                  (item) => item.type === "Notes"
                ).length
              }
            </div>

            <div className="stat-detail">
              Subject notes
            </div>

          </div>

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                ✓
              </div>
            </div>

            <div className="stat-label">
              LIBRARY STATUS
            </div>

            <div className="stat-value">
              {resources.length > 0 ? "ON" : "—"}
            </div>

            <div className="stat-detail">
              Stored in this browser
            </div>

          </div>

        </section>

        {/* ADD FORM */}

        {showForm && (

          <section className="panel resource-form-panel">

            <div className="panel-header">

              <div>

                <p className="eyebrow">
                  NEW RESOURCE
                </p>

                <h2>
                  Add teaching material.
                </h2>

              </div>

            </div>

            <form
              className="resource-form"
              onSubmit={addResource}
            >

              <div className="resource-form-grid">

                <label>
                  <span>
                    RESOURCE TITLE
                  </span>

                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Example: Algebra Worksheet"
                  />
                </label>

                <label>
                  <span>
                    TYPE
                  </span>

                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                  >
                    <option>
                      Worksheet
                    </option>

                    <option>
                      Notes
                    </option>

                    <option>
                      Document
                    </option>

                    <option>
                      Presentation
                    </option>

                    <option>
                      Other
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    SUBJECT
                  </span>

                  <input
                    type="text"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="Mathematics"
                  />
                </label>

                <label>
                  <span>
                    DESCRIPTION
                  </span>

                  <input
                    type="text"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Short description"
                  />
                </label>

              </div>

              <div className="resource-form-actions">

                <button
                  type="submit"
                  className="primary-button"
                >
                  Save Resource
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

              </div>

            </form>

          </section>

        )}

        {/* RESOURCE LIST */}

        <section className="section">

          <div className="section-heading">

            <div>

              <p className="eyebrow">
                YOUR LIBRARY
              </p>

              <h2>
                Available teaching materials.
              </h2>

            </div>

          </div>

          {resources.length === 0 ? (

            <section className="empty-state">

              <div className="empty-icon">
                □
              </div>

              <p className="eyebrow">
                EMPTY LIBRARY
              </p>

              <h2>
                No resources yet.
              </h2>

              <p>
                Add your first worksheet, note or teaching
                material to build your resource library.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() => setShowForm(true)}
              >
                ＋ Add First Resource
              </button>

            </section>

          ) : (

            <div className="resource-grid">

              {resources.map((resource, index) => (

                <article
                  className="resource-card"
                  key={resource.id}
                >

                  <div className="resource-card-top">

                    <span className="resource-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="status">
                      {resource.type}
                    </span>

                  </div>

                  <div className="resource-icon">
                    □
                  </div>

                  <h3>
                    {resource.title}
                  </h3>

                  <p className="resource-subject">
                    {resource.subject}
                  </p>

                  <p className="resource-description">
                    {resource.description}
                  </p>

                  <div className="resource-footer">

                    <span>
                      Added
                    </span>

                    <button
                      type="button"
                      className="delete-button"
                      onClick={() =>
                        deleteResource(resource.id)
                      }
                    >
                      Delete
                    </button>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

        <div className="workspace-back-container">
          <Link
            to="/"
            className="workspace-back"
          >
            ← Back to Dashboard
          </Link>
        </div>

      </main>

      <footer className="footer">

        <div className="footer-brand">

          <div className="footer-mark">
            TG
          </div>

          <div>

            <strong>
              Teacher Guide
            </strong>

            <p>
              Intelligent workspace for modern teaching.
            </p>

          </div>

        </div>

        <Link
          to="/analytics"
          className="footer-button"
        >
          Explore Analytics →
        </Link>

      </footer>

    </div>
  );
}

export default Resources;