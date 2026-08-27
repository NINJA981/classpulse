import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
    <div className="lesson-page">

      {/* HEADER */}

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

          <a href="#">
            Resources
          </a>

        </nav>

        <button className="profile">
          Teacher
        </button>

      </header>


      {/* MAIN */}

      <main className="lesson-main">

        <div className="page-heading">

          <p className="eyebrow">
            TEACHER WORKSPACE
          </p>

          <h1>
            My<br />
            Classes.
          </h1>

          <p className="page-description">
            Organize your classes, students and
            teaching activities in one place.
          </p>

        </div>


        {/* ADD BUTTON */}

        <div className="new-plan-container">

          <button
            className="generate"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm
              ? "× Close"
              : "+ Add New Class"}
          </button>

        </div>


        {/* ADD CLASS FORM */}

        {showForm && (

          <section className="class-form-section">

            <p className="eyebrow">
              NEW CLASS
            </p>

            <h2>
              Add a Class
            </h2>

            <form onSubmit={addClass}>

              <div className="form-grid">

                <div className="form-group">

                  <label>
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


              <div className="form-group">

                <label>
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


              <button
                type="submit"
                className="primary-form-button"
              >
                Save Class →
              </button>

            </form>

          </section>

        )}


        {/* CLASSES */}

        {classes.length === 0 ? (

          <section className="empty-plans">

            <h2>
              No classes added yet.
            </h2>

            <p>
              Add your first class to start
              managing your students.
            </p>

          </section>

        ) : (

          <section className="saved-plans-grid">

            {classes.map((item, index) => (

              <div
                className="saved-plan-card"
                key={item.id}
              >

                <div className="saved-plan-top">

                  <span className="number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="saved-date">
                    {item.createdAt}
                  </span>

                </div>


                <h2>
                  {item.name}
                </h2>


                <p className="plan-meta">
                  {item.subject} · {item.grade}
                </p>


                <p className="plan-duration">
                  {item.students} Students
                </p>


                <div className="saved-plan-actions">

                  <Link
                    to={`/class-view/${item.id}`}
                    className="view-button"
                  >
                    View →
                  </Link>

                  <button
                    className="delete-button"
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

      </main>

    </div>
  );
}

export default MyClasses;
