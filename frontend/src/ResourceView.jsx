import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function ResourceView() {
  const { id } = useParams();

  const [resource, setResource] = useState(null);

  useEffect(() => {
    const savedResources =
      JSON.parse(
        localStorage.getItem("teacherGuideResources")
      ) || [];

    const foundResource = savedResources.find(
      (item) => String(item.id) === String(id)
    );

    setResource(foundResource);
  }, [id]);

  if (!resource) {
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
            <Link to="/resources">Resources</Link>
          </nav>

          <button className="profile">
            Teacher
          </button>

        </header>

        <main className="lesson-main">

          <div className="page-heading">

            <p className="eyebrow">
              RESOURCE
            </p>

            <h1>
              Resource Not Found
            </h1>

            <p className="page-description">
              The resource you are looking for does not exist.
            </p>

          </div>

          <Link
            to="/resources"
            className="generate"
          >
            ← Back to Resources
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
          <Link to="/">Dashboard</Link>
          <Link to="/saved-plans">Lesson Plans</Link>
          <Link to="/classes">My Classes</Link>
          <Link to="/resources">Resources</Link>
        </nav>

        <button className="profile">
          Teacher
        </button>

      </header>

      <main className="lesson-main">

        <div className="page-heading">

          <p className="eyebrow">
            SAVED RESOURCE
          </p>

          <h1>
            {resource.title}
          </h1>

          <p className="page-description">
            {resource.type} · {resource.subject} ·{" "}
            {resource.grade}
          </p>

        </div>

        <section className="class-details">

          <div className="detail-card">

            <span className="number">
              01
            </span>

            <h2>
              Resource Type
            </h2>

            <p>
              {resource.type}
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
              {resource.subject}
            </p>

          </div>

          <div className="detail-card">

            <span className="number">
              03
            </span>

            <h2>
              Class / Grade
            </h2>

            <p>
              {resource.grade}
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
              {resource.description ||
                "No description added."}
            </p>

          </div>

        </section>

        {resource.link && (
          <div className="resource-link-box">

            <h2>
              Resource Link
            </h2>

            <a
              href={resource.link}
              target="_blank"
              rel="noreferrer"
            >
              Open Resource →
            </a>

          </div>
        )}

        <Link
          to="/resources"
          className="generate"
        >
          ← Back to Resources
        </Link>

      </main>

    </div>
  );
}

export default ResourceView;
