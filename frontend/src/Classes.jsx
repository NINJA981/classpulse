import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

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


  const footer = (
    <>
      <div>
        <strong>TEACHER GUIDE</strong>
        <p>Intelligent workspace for modern teaching.</p>
      </div>
    </>
  );

  return (
    <AppShell footer={footer}>

      <header className="page-header">

        <div className="page-header-copy">

          <p className="zine-label">
            TEACHER WORKSPACE
          </p>

          <h1>
            My Classes.
          </h1>

          <p>
            Organize your classes, students and teaching
            activities in one place.
          </p>

        </div>

        <div className="page-header-side">

          <button
            type="button"
            className="ui-button ui-button-primary"
            onClick={addClass}
          >
            + Add New Class
          </button>

        </div>

      </header>

      {classes.length === 0 ? (

        <section className="empty-block">
          <p className="zine-label">
            NO CLASSES
          </p>

          <h2>
            No classes added yet.
          </h2>

          <p>
            Add your first class to start managing your students.
          </p>

          <button
            type="button"
            className="ui-button ui-button-primary"
            onClick={addClass}
          >
            + Add New Class
          </button>

        </section>

      ) : (

        <section className="card-grid">

          {classes.map((item) => (

            <article
              className="ui-card pad-6 groupb-card"
              key={item.id}
            >

              <div className="card-top">
                <button
                  type="button"
                  className="ui-button ui-button-danger"
                  onClick={() => deleteClass(item.id)}
                >
                  Delete
                </button>

              </div>

              <h2 className="card-title">
                {item.name}
              </h2>

              <p className="text-muted">
                {item.subject || "Mathematics"} •{" "}
                {item.grade || "Grade 8"}
              </p>

              <p className="card-body">
                {item.description ||
                  "Mathematics learning group"}
              </p>

              <div className="card-foot">

                <span>
                  {Number(item.students || 0)}{" "}
                  {Number(item.students || 0) === 1
                    ? "Student"
                    : "Students"}
                </span>

                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={() => openClass(item.id)}
                >
                  View →
                </button>

              </div>

            </article>

          ))}

        </section>

      )}

      <section className="section-block">

        <div className="section-header">

          <div className="section-header-copy">

            <p className="zine-label">
              QUICK ACTIONS
            </p>

            <h2>
              Continue Teaching
            </h2>

          </div>

        </div>

        <div className="card-grid card-grid-4">

          <Link
            to="/lesson-plan"
            className="hypercard stat-tile action-tile"
          >
            <p className="zine-label">01</p>

            <h3 className="card-title">
              Create Lesson Plan
            </h3>

            <div className="stat-tile-foot">
              <span className="text-link">Open →</span>
            </div>
          </Link>

          <Link
            to="/classes"
            className="hypercard stat-tile action-tile"
          >
            <p className="zine-label">02</p>

            <h3 className="card-title">
              Manage Classes
            </h3>

            <div className="stat-tile-foot">
              <span className="text-link">Open →</span>
            </div>
          </Link>

          <Link
            to="/quizzes"
            className="hypercard stat-tile action-tile"
          >
            <p className="zine-label">03</p>

            <h3 className="card-title">
              Manage Quizzes
            </h3>

            <div className="stat-tile-foot">
              <span className="text-link">Open →</span>
            </div>
          </Link>

          <Link
            to="/resources"
            className="hypercard stat-tile action-tile"
          >
            <p className="zine-label">04</p>

            <h3 className="card-title">
              Manage Resources
            </h3>

            <div className="stat-tile-foot">
              <span className="text-link">Open →</span>
            </div>
          </Link>

        </div>

      </section>

    </AppShell>
  );
}

export default Classes;
