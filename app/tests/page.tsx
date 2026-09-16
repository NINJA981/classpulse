"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck2,
  Timer,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import {
  diagnosticApi,
  CourseTest,
  CourseContent,
} from "@/lib/diagnosticApi";

export default function TestsPage() {
  const [courseContent, setCourseContent] = useState<CourseContent>(() => {
    return diagnosticApi.getCourseContent();
  });

  const [tests, setTests] = useState<CourseTest[]>(() => {
    return diagnosticApi.getCourseContent().tests;
  });

  const [filter, setFilter] = useState("All");

  useEffect(() => {
    function refreshData() {
      const content = diagnosticApi.getCourseContent();
      setCourseContent(content);
      setTests(content.tests);
    }
    refreshData();
    window.addEventListener("storage", refreshData);
    return () => window.removeEventListener("storage", refreshData);
  }, []);

  const filteredTests =
    filter === "All"
      ? tests
      : tests.filter((test) => test.status === filter);

  const upcomingCount = tests.filter(
    (test) => test.status === "Upcoming"
  ).length;

  const completedCount = tests.filter(
    (test) => test.status === "Completed"
  ).length;

  return (
    <DashboardShell footerNote="Test schedule">

      {/* Hero (acts as the page header) */}
      <header className="cp-hero cp-hero--yellow cp-tape-top">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <p className="cp-sticker">
              Assessments • {courseContent.code}
            </p>

            <h2 className="cp-h-hero">
              Tests
            </h2>

            <p className="cp-hero__sub">
              Scheduled evaluations for <strong className="text-ink font-bold">{courseContent.courseTitle}</strong> with {courseContent.teacherName}.
            </p>
          </div>

          <div className="cp-hero__pills">
            <span className="ui-pill ui-pill-sky">
              {upcomingCount} Upcoming
            </span>

            <span className="ui-pill ui-pill-dark">
              {completedCount} Completed
            </span>
          </div>
        </div>
      </header>

      {/* Summary */}
      <section className="cp-grid-3" aria-label="Summary">

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Total Tests</p>
            <span className="cp-stat__icon cp-stat__icon--yellow" aria-hidden="true">
              <FileCheck2 />
            </span>
          </div>

          <p className="cp-stat__value">
            {tests.length}
          </p>
          <p className="cp-stat__caption">
            All scheduled tests
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Upcoming</p>
            <span className="cp-stat__icon cp-stat__icon--sky" aria-hidden="true">
              <CalendarDays />
            </span>
          </div>

          <p className="cp-stat__value">
            {upcomingCount}
          </p>
          <p className="cp-stat__caption">
            Prepare for these
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Completed</p>
            <span className="cp-stat__icon cp-stat__icon--mint" aria-hidden="true">
              <CheckCircle2 />
            </span>
          </div>

          <p className="cp-stat__value">
            {completedCount}
          </p>
          <p className="cp-stat__caption">
            Finished tests
          </p>
        </div>

      </section>

      {/* Tests list */}
      <section className="cp-section" aria-labelledby="tests-title">

        <div className="cp-section__head">
          <div className="cp-section__heading">
            <p className="zine-label">
              <CalendarDays aria-hidden="true" />
              Test List
            </p>

            <h3 id="tests-title" className="cp-section__title">
              {filter === "All"
                ? "All Tests"
                : `${filter} Tests`}
            </h3>
          </div>

          <div className="cp-section__tools">
            <div className="cp-segment" role="group" aria-label="Filter tests">
              {["All", "Upcoming", "Completed"].map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  aria-pressed={filter === item}
                  className="ui-filter"
                >
                  {item}
                </button>
              ))}
            </div>

            <span className="ui-pill ui-pill-sky">
              {filteredTests.length} items
            </span>
          </div>
        </div>

        <div className="cp-section__list">

          {filteredTests.map((test) => (
            <div
              key={test.id}
              className={
                test.status === "Upcoming"
                  ? "cp-row cp-row--sky"
                  : "cp-row cp-row--white"
              }
            >
              <div className="cp-row__main">
                <div className="cp-row__tags">
                  <p className="cp-sticker">
                    {test.subject}
                  </p>
                </div>

                <h3 className="cp-row__title">
                  {test.title}
                </h3>

                <p className="cp-row__meta">
                  <span className="cp-row__meta-item">
                    <CalendarDays aria-hidden="true" />
                    Date: {test.date}
                  </span>

                  <span className="cp-row__meta-item">
                    <Clock aria-hidden="true" />
                    Time: {test.time}
                  </span>

                  <span className="cp-row__meta-item">
                    <Timer aria-hidden="true" />
                    Duration: {test.duration}
                  </span>
                </p>
              </div>

              <div className="cp-row__side">
                {test.status === "Upcoming" ? (
                  <span className="ui-pill ui-pill-sky">
                    Upcoming
                  </span>
                ) : (
                  <span className="ui-pill ui-pill-mint">
                    ✓ Completed
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredTests.length === 0 && (
            <div className="cp-empty">
              <p className="cp-sticker">
                Nothing here
              </p>

              <h3 className="cp-h-card mt-3">
                No tests found
              </h3>

              <p className="cp-empty__hand mt-2">
                Try another filter.
              </p>
            </div>
          )}

        </div>
      </section>

    </DashboardShell>
  );
}
