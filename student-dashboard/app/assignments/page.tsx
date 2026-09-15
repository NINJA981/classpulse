"use client";

import { FormEvent, useState, useEffect } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import {
  diagnosticApi,
  CourseAssignment,
  CourseContent,
} from "@/lib/diagnosticApi";

export default function AssignmentsPage() {
  const [courseContent, setCourseContent] = useState<CourseContent>(() => {
    return diagnosticApi.getCourseContent();
  });

  const [assignments, setAssignments] = useState<CourseAssignment[]>(() => {
    return diagnosticApi.getCourseContent().assignments;
  });

  const [filter, setFilter] = useState("All");

  const [uploadAssignment, setUploadAssignment] =
    useState<CourseAssignment | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [comment, setComment] = useState("");

  useEffect(() => {
    function refreshData() {
      const content = diagnosticApi.getCourseContent();
      setCourseContent(content);
      setAssignments(content.assignments);
    }
    refreshData();
    window.addEventListener("storage", refreshData);
    return () => window.removeEventListener("storage", refreshData);
  }, []);

  const filteredAssignments =
    filter === "All"
      ? assignments
      : assignments.filter(
          (assignment) => assignment.status === filter
        );

  const pendingCount = assignments.filter(
    (assignment) => assignment.status === "Pending"
  ).length;

  const submittedCount = assignments.filter(
    (assignment) => assignment.status === "Submitted"
  ).length;

  function closeUpload() {
    setUploadAssignment(null);
    setSelectedFile(null);
    setComment("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!uploadAssignment || !selectedFile) {
      return;
    }

    diagnosticApi.submitAssignment(uploadAssignment.id, selectedFile.name, comment);

    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === uploadAssignment.id
          ? {
              ...assignment,
              status: "Submitted",
              fileName: selectedFile.name,
              comment,
            }
          : assignment
      )
    );

    closeUpload();
  }

  return (
    <DashboardShell footerNote="Assignment workspace">

      {/* Hero (acts as the page header) */}
      <header className="cp-hero cp-hero--pink cp-tape-top">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <p className="cp-sticker">
              Coursework • {courseContent.code}
            </p>

            <h2 className="cp-h-hero">
              Assignments
            </h2>

            <p className="cp-hero__sub">
              Coursework for <strong className="text-ink font-bold">{courseContent.courseTitle}</strong> with {courseContent.teacherName}.
            </p>
          </div>

          <div className="cp-hero__pills">
            <span className="ui-pill ui-pill-pink">
              {pendingCount} Pending
            </span>

            <span className="ui-pill ui-pill-dark">
              {submittedCount} Submitted
            </span>
          </div>
        </div>
      </header>

      {/* Summary */}
      <section className="cp-grid-3" aria-label="Summary">

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Total</p>
            <span className="cp-stat__icon cp-stat__icon--pink" aria-hidden="true">
              <ClipboardList />
            </span>
          </div>

          <p className="cp-stat__value">
            {assignments.length}
          </p>
          <p className="cp-stat__caption">
            Assigned tasks
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Pending</p>
            <span className="cp-stat__icon cp-stat__icon--yellow" aria-hidden="true">
              <Hourglass />
            </span>
          </div>

          <p className="cp-stat__value">
            {pendingCount}
          </p>
          <p className="cp-stat__caption">
            Need submission
          </p>
        </div>

        <div className="hypercard-static cp-stat">
          <div className="cp-stat__head">
            <p className="cp-sticker">Submitted</p>
            <span className="cp-stat__icon cp-stat__icon--mint" aria-hidden="true">
              <CheckCircle2 />
            </span>
          </div>

          <p className="cp-stat__value">
            {submittedCount}
          </p>
          <p className="cp-stat__caption">
            Completed work
          </p>
        </div>

      </section>

      {/* Assignment List */}
      <section className="cp-section" aria-labelledby="assignments-title">

        <div className="cp-section__head">
          <div className="cp-section__heading">
            <p className="zine-label">
              <ClipboardList aria-hidden="true" />
              Assignment List
            </p>

            <h3 id="assignments-title" className="cp-section__title">
              {filter === "All"
                ? "All Assignments"
                : `${filter} Assignments`}
            </h3>
          </div>

          <div className="cp-section__tools">
            <div className="cp-segment" role="group" aria-label="Filter assignments">
              {["All", "Pending", "Submitted"].map((item) => (
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
              {filteredAssignments.length} items
            </span>
          </div>
        </div>

        <div className="cp-section__list">

          {filteredAssignments.map((assignment) => (
            <div
              key={assignment.id}
              className={
                assignment.status === "Pending"
                  ? "cp-row cp-row--yellow"
                  : "cp-row cp-row--white"
              }
            >
              <div className="cp-row__main">
                <div className="cp-row__tags">
                  <p className="cp-sticker">
                    {assignment.subject}
                  </p>
                </div>

                <h3 className="cp-row__title">
                  {assignment.title}
                </h3>

                <p className="cp-row__meta">
                  <span className="cp-row__meta-item">
                    <CalendarDays aria-hidden="true" />
                    Due {assignment.due}
                  </span>
                </p>

                {assignment.fileName && (
                  <p className="cp-row__meta">
                    <span className="cp-row__meta-item">
                      <Paperclip aria-hidden="true" />
                      Submitted file:{" "}
                      <span className="cp-chip cp-chip--white">
                        {assignment.fileName}
                      </span>
                    </span>
                  </p>
                )}
              </div>

              <div className="cp-row__side">
                {assignment.status === "Pending" ? (
                  <span className="ui-pill ui-pill-yellow">
                    {assignment.status}
                  </span>
                ) : null}
                {assignment.status === "Pending" ? (
                  <button
                    onClick={() =>
                      setUploadAssignment(assignment)
                    }
                    className="ui-button ui-button-primary ui-button-sm"
                  >
                    <Upload aria-hidden="true" />
                    Submit Assignment
                  </button>
                ) : (
                  <span className="ui-pill ui-pill-mint">
                    ✓ Submitted
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredAssignments.length === 0 && (
            <div className="cp-empty">
              <p className="cp-sticker">
                Nothing here
              </p>

              <h3 className="cp-h-card mt-3">
                No assignments found
              </h3>

              <p className="cp-empty__hand mt-2">
                Try another filter.
              </p>
            </div>
          )}

        </div>
      </section>

      {/* Upload Modal */}
      {uploadAssignment && (
        <div className="ui-modal-overlay">

          <div className="ui-modal">

            {/* Modal Header */}
            <div className="cp-modal__head">

              <div className="min-w-0">
                <p className="cp-sticker">
                  Assignment Submission
                </p>

                <h2 className="cp-h-card-sm mt-2">
                  Submit Assignment
                </h2>

                <p className="cp-caption mt-1">
                  {uploadAssignment.title}
                </p>
              </div>

              <button
                type="button"
                onClick={closeUpload}
                className="ui-button ui-button-icon shrink-0"
              >
                <X aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* File */}
              <div>
                <label htmlFor="assignment-file" className="ui-label mb-2">
                  <Upload aria-hidden="true" />
                  Upload file
                </label>

                <div className="cp-inset border-0 bg-transparent p-0">

                  <input
                    id="assignment-file"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    required
                    onChange={(event) =>
                      setSelectedFile(
                        event.target.files?.[0] || null
                      )
                    }
                    className="ui-input"
                  />

                  <p className="cp-caption mt-3">
                    Accepted formats: PDF, DOC, DOCX
                  </p>

                  {selectedFile && (
                    <div className="mt-4 border-t-2 border-ink pt-4">

                      <p className="zine-label">
                        Selected file
                      </p>

                      <p className="cp-body mt-2 break-all">
                        {selectedFile.name}
                      </p>

                    </div>
                  )}

                </div>
              </div>

              {/* Comment */}
              <div>
                <label htmlFor="assignment-comment" className="ui-label mb-2">
                  Comment
                  <span className="cp-caption">
                    (optional)
                  </span>
                </label>

                <textarea
                  id="assignment-comment"
                  value={comment}
                  onChange={(event) =>
                    setComment(event.target.value)
                  }
                  rows={4}
                  placeholder="Add a note for your faculty..."
                  className="ui-textarea"
                />
              </div>

              {/* Buttons */}
              <div className="cp-modal__foot">

                <button
                  type="button"
                  onClick={closeUpload}
                  className="ui-button ui-button-secondary"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ui-button ui-button-primary"
                >
                  Submit
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

    </DashboardShell>
  );
}
