import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { DEFAULT_NAV_LINKS } from "./navLinks.js";

/* =========================================================
   APP SHELL — shared left-sidebar layout
   Presentation only. Same routes/links as the old inline
   headers; pages pass their own `links` list if it differs.
========================================================= */


function DefaultProfile() {
  const [showMenu, setShowMenu] = React.useState(false);
  const teacherName =
    localStorage.getItem("teacherGuideTeacherName") || "Prof. Priya Sharma";
  const institution = "Apex Institute of Tech";
  const initialLetter = teacherName.replace(/^Prof\.\s*|^Dr\.\s*/i, "")[0] || "T";

  const handleResetDemo = () => {
    if (window.confirm("Reset account claim state to test the first-run onboarding flow again?")) {
      localStorage.removeItem("teacherGuide_claimStatus");
      localStorage.removeItem("teacherGuideClaimed");
      window.location.href = "/claim";
    }
  };

  return (
    <div className="app-profile" style={{ position: "relative" }}>
      <div className="app-profile-avatar">{initialLetter}</div>
      <div className="app-profile-info">
        <strong>{teacherName}</strong>
        <span>{institution}</span>
      </div>
      <button
        className="app-profile-menu"
        type="button"
        aria-label="Profile menu"
        onClick={() => setShowMenu(!showMenu)}
      >
        ⌄
      </button>

      {showMenu && (
        <div
          className="ui-card pad-4"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            marginBottom: "8px",
            background: "var(--surface)",
            border: "1.5px solid var(--border-strong)",
            boxShadow: "var(--shadow-md)",
            zIndex: 100,
          }}
        >
          <p className="zine-label" style={{ marginBottom: "6px" }}>ACCOUNT</p>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              localStorage.removeItem("teacherGuideLoggedIn");
              window.location.href = "/login";
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              fontSize: "13px",
              cursor: "pointer",
              padding: "4px 0 8px",
              border: "none",
              background: "none",
            }}
          >
            ← Log Out
          </button>

          <p className="zine-label" style={{ margin: "6px 0 4px", borderTop: "1px solid var(--border)", paddingTop: "6px" }}>DEMO CONTROLS</p>
          <button
            type="button"
            className="text-link"
            onClick={handleResetDemo}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              fontSize: "13px",
              color: "#990000",
              cursor: "pointer",
              padding: "4px 0",
              border: "none",
              background: "none",
            }}
          >
            ↺ Reset Claim (Test Flow)
          </button>
        </div>
      )}
    </div>
  );
}

function AppShell({
  links = DEFAULT_NAV_LINKS,
  brand = "Teacher Guide",
  eyebrow = "TEACHER WORKSPACE",
  aside = null,
  footer = null,
  className = "",
  children,
}) {
  const profileComponent = aside !== null ? aside : <DefaultProfile />;

  const { pathname } = useLocation();

  return (
    <div className={`app-shell tactile-paper ${className}`.trim()}>
      <aside className="app-sidebar">
        <Link to="/" className="app-brand">
          <p className="zine-label">{eyebrow}</p>
          <span className="app-brand-name">{brand}</span>
        </Link>

        <nav className="app-nav" aria-label="Main navigation">
          {links.map((link) => {
            const alsoActive = (link.also || []).some((prefix) =>
              pathname.startsWith(prefix)
            );

            return (
              <NavLink
                key={link.to + link.label}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  isActive || alsoActive
                    ? "sidebar-link sidebar-link-active"
                    : "sidebar-link"
                }
              >
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        {profileComponent}

        <div className="app-sidebar-footer">
          <p className="zine-caption">Minimal teaching workspace</p>
        </div>
      </aside>

      <main className="app-main">
        {children}
        {footer ? <footer className="app-footer">{footer}</footer> : null}
      </main>
    </div>
  );
}

export default AppShell;
