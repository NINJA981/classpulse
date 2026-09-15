import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

function MyClasses() {
  const [classes, setClasses] = useState([]);

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    grade: "",
    subject: "",
    students: "",
    description: ""
  });

  useEffect(() => {
    const savedClasses =
      JSON.parse(localStorage.getItem("teacherGuideClasses")) || [];

    setClasses(savedClasses);
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const addClass = (e) => {
    e.preventDefault();

    if (
      !form.name ||
      !form.grade ||
      !form.subject ||
      !form.students
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    const newClass = {
      id: Date.now(),
      name: form.name,
      grade: form.grade,
      subject: form.subject,
      students: form.students,
      description: form.description,
      createdAt: new Date().toLocaleDateString()
    };

    const updatedClasses = [
      ...classes,
      newClass
    ];

    localStorage.setItem(
      "teacherGuideClasses",
      JSON.stringify(updatedClasses)
    );

    setClasses(updatedClasses);

    setForm({
      name: "",
      grade: "",
      subject: "",
      students: "",
      description: ""
    });

    setShowForm(false);
  };

  const deleteClass = (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this class?"
    );

    if (!confirmDelete) return;

    const updatedClasses = classes.filter(
      (item) => item.id !== id
    );

    localStorage.setItem(
      "teacherGuideClasses",
      JSON.stringify(updatedClasses)
    );

    setClasses(updatedClasses);
  };


  return (
    <AppShell>

      {/* HEADER */}

      <header className="page-header">

        <div className="page-header-copy">

          <p className="zine-label">
            TEACHER WORKSPACE
          </p>

          <h1>
            My<br />
            Classes.
          </h1>

          <p>
            Organize your classes, students and
            teaching activities in one place.
          </p>

        </div>

        {/* ADD BUTTON */}

        <div className="page-header-side">

          <button
            type="button"
            className="ui-button ui-button-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm
              ? "× Close"
              : "+ Add New Class"}
          </button>

        </div>

      </header>


      {/* ADD CLASS FORM */}

      {showForm && (

        <section className="panel">

          <div className="panel-header">

            <div>

              <p className="zine-label">
                NEW CLASS
              </p>

              <h2>
                Add a Class
              </h2>

            </div>

          </div>

          <form onSubmit={addClass} className="form-stack">

            <div className="form-grid">

              <div className="form-field">

                <label className="form-label">
                  Class Name *
                </label>

                <input
                  type="text"
                  name="name"
                  placeholder="Example: Class A"
                  value={form.name}
                  onChange={handleChange}
                />

              </div>


              <div className="form-field">

                <label className="form-label">
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


              <div className="form-field">

                <label className="form-label">
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


              <div className="form-field">

                <label className="form-label">
                  Number of Students *
                </label>

                <input
                  type="number"
                  name="students"
                  placeholder="Example: 30"
                  min="1"
                  value={form.students}
                  onChange={handleChange}
                />

              </div>

            </div>


            <div className="form-field">

              <label className="form-label">
                Class Description
              </label>

              <textarea
                name="description"
                placeholder="Write a short description about this class..."
                value={form.description}
                onChange={handleChange}
                rows="5"
              />

            </div>


            <div className="form-actions">

              <button
                type="submit"
                className="ui-button ui-button-primary"
              >
                Save Class →
              </button>

            </div>

          </form>

        </section>

      )}


      {/* CLASSES */}

      {classes.length === 0 ? (

        <section className="empty-block section-block">
          <p className="zine-label">
            NO CLASSES
          </p>

          <h2>
            No classes added yet.
          </h2>

          <p>
            Add your first class to start
            managing your students.
          </p>

        </section>

      ) : (

        <section className="card-grid section-block">

          {classes.map((item) => (

            <div
              className="ui-card pad-6 groupb-card"
              key={item.id}
            >

              <div className="card-top">
                <span className="ui-pill">
                  {item.createdAt}
                </span>

              </div>


              <h2 className="card-title">
                {item.name}
              </h2>


              <p className="text-muted">
                {item.subject} · {item.grade}
              </p>


              <p className="card-body">
                {item.students} Students
              </p>


              <div className="card-foot">

                <Link
                  to={`/class-view/${item.id}`}
                  className="ui-button ui-button-secondary"
                >
                  View →
                </Link>

                <button
                  type="button"
                  className="ui-button ui-button-danger"
                  onClick={() =>
                    deleteClass(item.id)
                  }
                >
                  Delete
                </button>

              </div>

            </div>

          ))}

        </section>

      )}

    </AppShell>
  );
}

export default MyClasses;
