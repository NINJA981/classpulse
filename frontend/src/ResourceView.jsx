import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

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
      <AppShell>

        <div className="page-center">

          <div className="empty-block">
            <p className="zine-label">
              RESOURCE
            </p>

            <h1>
              Resource Not Found
            </h1>

            <p>
              The resource you are looking for does not exist.
            </p>

            <Link
              to="/resources"
              className="ui-button ui-button-primary"
            >
              ← Back to Resources
            </Link>

          </div>

        </div>

      </AppShell>
    );
  }

  return (
    <AppShell>

      <header className="page-header">

        <div className="page-header-copy">

          <p className="zine-label">
            SAVED RESOURCE
          </p>

          <h1>
            {resource.title}
          </h1>

          <p>
            {resource.type} · {resource.subject} •{" "}
            {resource.grade}
          </p>

        </div>

      </header>

      <section className="stack-card pad-8">

        <p className="zine-label">
          RESOURCE DETAILS
        </p>

        <div className="detail-grid">

          <div>
            <span>
              Resource Type
            </span>

            <strong>
              {resource.type}
            </strong>
          </div>

          <div>
            <span>
              Subject
            </span>

            <strong>
              {resource.subject}
            </strong>
          </div>

          <div>
            <span>
              Class / Grade
            </span>

            <strong>
              {resource.grade}
            </strong>
          </div>

        </div>

        <div className="detail-section">

          <span>
            Description
          </span>

          <p>
            {resource.description ||
              "No description added."}
          </p>

        </div>

      </section>

      {resource.link && (
        <div className="ui-card pad-5 groupb-link-box">

          <div>

            <p className="zine-label">
              LINK
            </p>

            <h2 className="text-row-title">
              Resource Link
            </h2>

          </div>

          <a
            href={resource.link}
            target="_blank"
            rel="noreferrer"
            className="ui-button ui-button-secondary"
          >
            Open Resource →
          </a>

        </div>
      )}

      <div className="back-row">
        <Link
          to="/resources"
          className="ui-button ui-button-secondary"
        >
          ← Back to Resources
        </Link>
      </div>

    </AppShell>
  );
}

export default ResourceView;
