import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

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


  const footer = (
    <>
      <div>

        <strong>
          Teacher Guide
        </strong>

        <p>
          Intelligent workspace for modern teaching.
        </p>

      </div>

      <Link
        to="/analytics"
        className="ui-button ui-button-secondary"
      >
        Explore Analytics →
      </Link>
    </>
  );

  const stats = [
    {
      label: "TOTAL RESOURCES",
      value: resources.length,
      detail: "Teaching materials",
    },
    {
      label: "WORKSHEETS",
      value: resources.filter(
        (item) => item.type === "Worksheet"
      ).length,
      detail: "Practice materials",
    },
    {
      label: "NOTES",
      value: resources.filter(
        (item) => item.type === "Notes"
      ).length,
      detail: "Subject notes",
    },
    {
      label: "LIBRARY STATUS",
      value: resources.length > 0 ? "ON" : "—",
      detail: "Stored in this browser",
    },
  ];

  return (
    <AppShell footer={footer}>

      {/* HEADER */}

      <header className="page-header">

        <div className="page-header-copy">

          <p className="zine-label">
            RESOURCE LIBRARY
          </p>

          <h1>
            Teaching
            <br />
            <span>Resources.</span>
          </h1>

          <p>
            Keep worksheets, notes, documents and other
            teaching materials organized in one place.
          </p>

        </div>

        <div className="page-header-side">

          <button
            type="button"
            className="ui-button ui-button-primary"
            onClick={() => setShowForm(!showForm)}
          >
            <span>+</span>
            Add Resource
          </button>

        </div>

      </header>

      {/* SUMMARY */}

      <section className="stat-grid">

        {stats.map((stat) => (

          <div
            className="hypercard-static stat-tile"
            key={stat.label}
          >

            <p className="zine-label">
              {stat.label}
            </p>

            <p className="stat-tile-value">
              {stat.value}
            </p>

            <div className="stat-tile-foot">
              <span>
                {stat.detail}
              </span>
            </div>

          </div>

        ))}

      </section>

      {/* ADD FORM */}

      {showForm && (

        <section className="panel groupb-form-section">

          <div className="panel-header">

            <div>

              <p className="zine-label">
                NEW RESOURCE
              </p>

              <h2>
                Add teaching material.
              </h2>

            </div>

          </div>

          <form
            className="form-stack"
            onSubmit={addResource}
          >

            <div className="form-grid">

              <label className="form-field">
                <span className="form-label form-label-recase">
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

              <label className="form-field">
                <span className="form-label form-label-recase">
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

              <label className="form-field">
                <span className="form-label form-label-recase">
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

              <label className="form-field">
                <span className="form-label form-label-recase">
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

            <div className="form-actions">

              <button
                type="submit"
                className="ui-button ui-button-primary"
              >
                Save Resource
              </button>

              <button
                type="button"
                className="ui-button ui-button-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

            </div>

          </form>

        </section>

      )}

      {/* RESOURCE LIST */}

      <section className="section-block">

        <div className="section-header">

          <div className="section-header-copy">

            <p className="zine-label">
              YOUR LIBRARY
            </p>

            <h2>
              Available teaching materials.
            </h2>

          </div>

          <span className="ui-pill">
            {resources.length}
          </span>

        </div>

        {resources.length === 0 ? (

          <section className="empty-block">
            <p className="zine-label">
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
              className="ui-button ui-button-primary"
              onClick={() => setShowForm(true)}
            >
              ＋ Add First Resource
            </button>

          </section>

        ) : (

          <div className="card-grid">

            {resources.map((resource) => (

              <article
                className="ui-card pad-6 groupb-card"
                key={resource.id}
              >

                <div className="card-top">
                  <span className="ui-pill ui-pill-dark">
                    {resource.type}
                  </span>

                </div>

                <h3 className="card-title">
                  {resource.title}
                </h3>

                <p className="text-muted">
                  {resource.subject}
                </p>

                <p className="card-body">
                  {resource.description}
                </p>

                <div className="card-foot">

                  <span>
                    Added
                  </span>

                  <button
                    type="button"
                    className="ui-button ui-button-danger"
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

      <div className="back-row">
        <Link
          to="/"
          className="ui-button ui-button-secondary"
        >
          ← Back to Dashboard
        </Link>
      </div>

    </AppShell>
  );
}

export default Resources;
