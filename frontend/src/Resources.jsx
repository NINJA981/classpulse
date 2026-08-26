import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Resources() {
  const [resources, setResources] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    title: "",
    type: "",
    subject: "",
    grade: "",
    description: "",
    link: ""
  });

  useEffect(() => {
    const savedResources =
      JSON.parse(localStorage.getItem("teacherGuideResources")) || [];

    setResources(savedResources);
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const addResource = (e) => {
    e.preventDefault();

    if (
      !form.title ||
      !form.type ||
      !form.subject ||
      !form.grade
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    const newResource = {
      id: Date.now(),
      title: form.title,
      type: form.type,
      subject: form.subject,
      grade: form.grade,
      description: form.description,
      link: form.link,
      createdAt: new Date().toLocaleDateString()
    };

    const updatedResources = [
      ...resources,
      newResource
    ];

    localStorage.setItem(
      "teacherGuideResources",
      JSON.stringify(updatedResources)
    );

    setResources(updatedResources);

    setForm({
      title: "",
      type: "",
      subject: "",
      grade: "",
      description: "",
      link: ""
    });

    setShowForm(false);
  };

  const deleteResource = (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this resource?"
    );

    if (!confirmDelete) return;

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
    <div className="lesson-page">

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

        </nav>

        <button className="profile">
          Teacher
        </button>

      </header>


      <main className="lesson-main">

        <div className="page-heading">

          <p className="eyebrow">
            TEACHING MATERIALS
          </p>

          <h1>
            Resources.
          </h1>

          <p className="page-description">
            Manage your worksheets, notes,
            presentations and teaching materials.
          </p>

        </div>


        <div className="new-plan-container">

          <button
            className="generate"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm
              ? "× Close"
              : "+ Add New Resource"}
          </button>

        </div>


        {showForm && (

          <section className="class-form-section">

            <p className="eyebrow">
              NEW RESOURCE
            </p>

            <h2>
              Add a Resource
            </h2>

            <form onSubmit={addResource}>

              <div className="form-grid">

                <div className="form-group">

                  <label>
                    Resource Title *
                  </label>

                  <input
                    type="text"
                    name="title"
                    placeholder="Example: Algebra Worksheet"
                    value={form.title}
                    onChange={handleChange}
                  />

                </div>


                <div className="form-group">

                  <label>
                    Resource Type *
                  </label>

                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                  >

                    <option value="">
                      Select Type
                    </option>

                    <option value="Worksheet">
                      Worksheet
                    </option>

                    <option value="Notes">
                      Notes
                    </option>

                    <option value="Presentation">
                      Presentation
                    </option>

                    <option value="Assignment">
                      Assignment
                    </option>

                    <option value="Reference">
                      Reference
                    </option>

                  </select>

                </div>


                <div className="form-group">

                  <label>
                    Subject *
                  </label>

                  <input
                    type="text"
                    name="subject"
                    placeholder="Example: Mathematics"
                    value={form.subject}
                    onChange={handleChange}
                  />

                </div>


                <div className="form-group">

                  <label>
                    Class / Grade *
                  </label>

                  <input
                    type="text"
                    name="grade"
                    placeholder="Example: Grade 8"
                    value={form.grade}
                    onChange={handleChange}
                  />

                </div>

              </div>


              <div className="form-group">

                <label>
                  Description
                </label>

                <textarea
                  name="description"
                  placeholder="Describe this teaching resource..."
                  value={form.description}
                  onChange={handleChange}
                  rows="5"
                />

              </div>


              <div className="form-group">

                <label>
                  Resource Link
                </label>

                <input
                  type="url"
                  name="link"
                  placeholder="https://example.com"
                  value={form.link}
                  onChange={handleChange}
                />

              </div>


              <button
                type="submit"
                className="primary-form-button"
              >
                Save Resource →
              </button>

            </form>

          </section>

        )}


        {resources.length === 0 ? (

          <section className="empty-plans">

            <h2>
              No resources added yet.
            </h2>

            <p>
              Add your first teaching resource
              to organize your materials.
            </p>

          </section>

        ) : (

          <section className="saved-plans-grid">

            {resources.map((resource, index) => (

              <div
                className="saved-plan-card"
                key={resource.id}
              >

                <div className="saved-plan-top">

                  <span className="number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="saved-date">
                    {resource.createdAt}
                  </span>

                </div>


                <h2>
                  {resource.title}
                </h2>


                <p className="plan-meta">
                  {resource.type} · {resource.subject}
                </p>


                <p className="plan-duration">
                  {resource.grade}
                </p>


                <div className="saved-plan-actions">

                  <Link
                    to={`/resource-view/${resource.id}`}
                    className="view-button"
                  >
                    View →
                  </Link>

                  <button
                    className="delete-button"
                    onClick={() =>
                      deleteResource(resource.id)
                    }
                  >
                    Delete
                  </button>

                </div>

              </div>

            ))}

          </section>

        )}

      </main>

    </div>
  );
}

export default Resources;