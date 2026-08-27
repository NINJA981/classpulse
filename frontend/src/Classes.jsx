import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Classes() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);

  const loadClasses = () => {
    try {
      const savedClasses = JSON.parse(
        localStorage.getItem("teacherGuideClasses") || "[]"
      );

      setClasses(
        Array.isArray(savedClasses) ? savedClasses : []
      );
    } catch (error) {
      console.error("Error loading classes:", error);
      setClasses([]);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const addClass = () => {
    const newClass = {
      id: Date.now().toString(),
      name: `Class ${String.fromCharCode(65 + classes.length)}`,
      subject: "Mathematics",
      grade: "Grade 8",
      students: 0,
      description: "Mathematics learning group",
      createdAt: new Date().toISOString(),
    };

    const updatedClasses = [...classes, newClass];

    localStorage.setItem(
      "teacherGuideClasses",
      JSON.stringify(updatedClasses)
    );

    setClasses(updatedClasses);
  };

  const deleteClass = (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this class?"
    );

    if (!confirmed) {
      return;
    }

    const updatedClasses = classes.filter(
      (item) => String(item.id) !== String(id)
    );

    localStorage.setItem(
      "teacherGuideClasses",
      JSON.stringify(updatedClasses)
    );

    setClasses(updatedClasses);

    try {
      const savedStudents = JSON.parse(
        localStorage.getItem("teacherGuideStudents") || "[]"
      );

      if (Array.isArray(savedStudents)) {
        const updatedStudents = savedStudents.filter(
          (student) =>
            String(student.classId) !== String(id)
        );

        localStorage.setItem(
          "teacherGuideStudents",
          JSON.stringify(updatedStudents)
        );
      }
    } catch (error) {
      console.error("Error removing students:", error);
    }
  };

  const openClass = (id) => {
    navigate(`/class-view/${id}`);
  };

  return (
    <div className="app">

      <header className="navbar">

        <div className="logo">
          TEACHER GUIDE
        </div>

        <nav>
          <Link to="/">Dashboard</Link>

          <Link to="/saved-plans">
            Lesson Plans
          </Link>

          <Link to="/classes">
            My Classes
          </Link>

          <Link to="/resources">
            Resources
          </Link>

          <Link to="/quizzes">
            Quizzes
          </Link>

          <Link to="/analytics">
            Analytics
          </Link>
        </nav>

        <div className="teacher">
          Teacher
        </div>

      </header>

      <main className="dashboard">

        <section className="hero">

          <p className="eyebrow">
            TEACHER WORKSPACE
          </p>

          <h1>
            My Classes.
          </h1>

          <p className="hero-text">
            Organize your classes, students and teaching
            activities in one place.
          </p>

          <div className="hero-buttons">

            <button
              type="button"
              className="primary-button"
              onClick={addClass}
            >
              + Add New Class
            </button>

          </div>

        </section>

        {classes.length === 0 ? (

          <section className="empty-state">

            <div className="empty-number">
              00
            </div>

            <h2>
              No classes added yet.
            </h2>

            <p>
              Add your first class to start managing your students.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={addClass}
            >
              + Add New Class
            </button>

          </section>

        ) : (

          <section className="items-grid">

            {classes.map((item, index) => (

              <article
                className="item-card"
                key={item.id}
              >

                <div className="item-top">

                  <span className="number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => deleteClass(item.id)}
                  >
                    Delete
                  </button>

                </div>

                <h2>
                  {item.name}
                </h2>

                <p className="item-meta">
                  {item.subject || "Mathematics"} ·{" "}
                  {item.grade || "Grade 8"}
                </p>

                <p className="item-description">
                  {item.description ||
                    "Mathematics learning group"}
                </p>

                <div className="item-bottom">

                  <span>
                    {Number(item.students || 0)}{" "}
                    {Number(item.students || 0) === 1
                      ? "Student"
                      : "Students"}
                  </span>

                  <button
                    type="button"
                    className="open-button"
                    onClick={() => openClass(item.id)}
                  >
                    View →
                  </button>

                </div>

              </article>

            ))}

          </section>

        )}

        <section className="quick-actions">

          <div className="quick-actions-header">

            <p className="eyebrow">
              QUICK ACTIONS
            </p>

            <h2>
              Continue Teaching
            </h2>

          </div>

          <div className="quick-actions-grid">

            <Link
              to="/lesson-plan"
              className="quick-action"
            >
              <span>
                Create Lesson Plan
              </span>

              <strong>
                01
              </strong>
            </Link>

            <Link
              to="/classes"
              className="quick-action"
            >
              <span>
                Manage Classes
              </span>

              <strong>
                02
              </strong>
            </Link>

            <Link
              to="/quizzes"
              className="quick-action"
            >
              <span>
                Manage Quizzes
              </span>

              <strong>
                03
              </strong>
            </Link>

            <Link
              to="/resources"
              className="quick-action"
            >
              <span>
                Manage Resources
              </span>

              <strong>
                04
              </strong>
            </Link>

          </div>

        </section>

        <footer className="dashboard-footer">

          <div>
            TEACHER GUIDE
          </div>

          <p>
            Intelligent workspace for modern teaching.
          </p>

        </footer>

      </main>

    </div>
  );
}

export default Classes;
