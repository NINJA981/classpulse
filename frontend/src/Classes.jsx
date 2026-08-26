import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Classes() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);

  useEffect(() => {
    const savedClasses = JSON.parse(
      localStorage.getItem("teacherGuideClasses") || "[]"
    );

    setClasses(savedClasses);
  }, []);

  const addClass = () => {
    const newClass = {
      id: Date.now().toString(),
      name: `Class ${String.fromCharCode(65 + classes.length)}`,
      subject: "Mathematics",
      grade: "Grade 8",
      students: 30,
      description: "Mathematics learning group",
    };

    const updatedClasses = [...classes, newClass];

    localStorage.setItem(
      "teacherGuideClasses",
      JSON.stringify(updatedClasses)
    );

    setClasses(updatedClasses);
  };

  const deleteClass = (id) => {
    const updatedClasses = classes.filter((item) => item.id !== id);

    localStorage.setItem(
      "teacherGuideClasses",
      JSON.stringify(updatedClasses)
    );

    setClasses(updatedClasses);
  };

  return (
    <div className="app">

      <header className="navbar">
        <div className="logo">TEACHER GUIDE</div>

        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/saved-plans">Lesson Plans</Link>
          <Link to="/classes">My Classes</Link>
          <Link to="/resources">Resources</Link>
        </nav>

        <div className="teacher">Teacher</div>
      </header>

      <main className="page-container">

        <div className="page-header">
          <div>
            <p className="eyebrow">TEACHER WORKSPACE</p>

            <h1>My Classes.</h1>

            <p className="page-description">
              Organize your classes, students and teaching activities in one
              place.
            </p>
          </div>

          <button className="primary-button" onClick={addClass}>
            + Add New Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-number">00</div>

            <h2>No classes added yet.</h2>

            <p>
              Add your first class to start managing your students.
            </p>

            <button className="primary-button" onClick={addClass}>
              + Add New Class
            </button>
          </div>
        ) : (
          <section className="items-grid">

            {classes.map((item, index) => (
              <div className="item-card" key={item.id}>

                <div className="item-top">
                  <span className="number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <button
                    className="delete-button"
                    onClick={() => deleteClass(item.id)}
                  >
                    Delete
                  </button>
                </div>

                <h2>{item.name}</h2>

                <p className="item-meta">
                  {item.subject} · {item.grade}
                </p>

                <p className="item-description">
                  {item.description}
                </p>

                <div className="item-bottom">
                  <span>{item.students} Students</span>

                  <button
                    className="open-button"
                    onClick={() =>
                      navigate(`/class-view/${item.id}`)
                    }
                  >
                    View →
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

export default Classes;