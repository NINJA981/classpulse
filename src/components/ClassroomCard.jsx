'use client';

import React from 'react';

/**
 * Single classroom card recipe shared by the admin directory and the teacher
 * streams directory: badges → h3 → metric grid → full-width secondary action.
 * Presentation only; all behaviour is passed in by the parent.
 */
export const ClassroomCard = ({
  classroom,
  enrolledCount,
  onOpen,
  onDelete,
  actionLabel,
  showGrade = false,
}) => {
  return (
    <div
      onClick={onOpen}
      className="cp-card cp-card-interactive cursor-pointer flex flex-col justify-between gap-5"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="cp-badge">{classroom.room}</span>
            <span className="cp-badge is-ink">ACTIVE</span>
          </div>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="cp-icon-btn shrink-0"
              title="Delete Classroom"
              aria-label="Delete Classroom"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>

        <h3 className="cp-h3">{classroom.name}</h3>

        <div className="cp-metric-grid">
          <div>
            <span>Lead Instructor:</span>
            <strong>{classroom.leadTeacher}</strong>
          </div>
          {showGrade && (
            <div>
              <span>Grade Level:</span>
              <strong>{classroom.gradeLevel || 'Grade 10'}</strong>
            </div>
          )}
          <div>
            <span>Enrolled Roster:</span>
            <strong>{enrolledCount} Students</strong>
          </div>
        </div>
      </div>

      <div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="cp-btn cp-btn-secondary min-h-0 h-8 text-xs cp-btn-block"
        >
          <span>{actionLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
};
