import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function ClassView() {
  const { id } = useParams();

  const [classData, setClassData] = useState(null);

  useEffect(() => {
    const classes =
      JSON.parse(
        localStorage.getItem("teacherGuideClasses")
      ) || [];

    const selectedClass = classes.find(
      (item) => String(item.id) === String(id)
    );

    setClassData(selectedClass);
  }, [id]);

  if (!classData) {
    return (
      <div className="lesson-page">

        <header className="topbar">

          <div className="logo">
            TEACHER GUIDE
          </div>

          <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/saved-plans">Lesson Plans</Link>
            <Link to="/classes">My Classes</Link>
            <a href="#">Resources</a>
          </nav>

          <button className="profile">
            Teacher
          </button>

        </header>

        <main className="lesson-main">

          <div className="page-heading">

            <p className="eyebrow">
              MY CLASS
            </p>

            <h1>
              Class Not Found
            </h1>

          </div>

          <Link
            to="/classes"
            className="generate"
          >
            ← Back to My Classes
          </Link>

        </main>

      </div>
    );
  }

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

          <a href="#">
            Resources
          </a>

        </nav>

        <button className="profile">
          Teacher
        </button>

      </header>


      <main className="lesson-main">

        <div className="page-heading">

          <p className="eyebrow">
            CLASS DETAILS
          </p>

          <h1>
            {classData.name}
          </h1>

          <p className="page-description">
            {classData.subject} · {classData.grade}
          </p>

        </div>


        <section className="class-details">

          <div className="detail-card">

            <span className="number">
              01
            </span>

            <h2>
              Class / Grade
            </h2>

            <p>
              {classData.grade}
            </p>

          </div>


          <div className="detail-card">

            <span className="number">
              02
            </span>

            <h2>
              Subject
            </h2>

            <p>
              {classData.subject}
            </p>

          </div>


          <div className="detail-card">

            <span className="number">
              03
            </span>

            <h2>
              Students
            </h2>

            <p>
              {classData.students} Students
            </p>

          </div>


          <div className="detail-card">

            <span className="number">
              04
            </span>

            <h2>
              Description
            </h2>

            <p>
              {classData.description ||
                "No description added."}
            </p>

          </div>

        </section>


        <Link
          to="/classes"
          className="generate"
        >
          ← Back to My Classes
        </Link>

      </main>

    </div>
  );
}

export default ClassView;