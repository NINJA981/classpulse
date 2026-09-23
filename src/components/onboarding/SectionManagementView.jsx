'use client';

import React, { useState, useEffect } from 'react';
import { onboardingApi } from '../../lib/onboardingApi';

export const SectionManagementView = () => {
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Rotate Code Confirmation Dialog State
  const [rotateConfirm, setRotateConfirm] = useState({
    isOpen: false,
    section: null,
    isRotating: false,
    successMessage: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [coursesList, sectionsList] = await Promise.all([
        onboardingApi.getCourses(),
        onboardingApi.getSections()
      ]);
      setCourses(coursesList);
      setSections(sectionsList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenRotateConfirm = (section) => {
    setRotateConfirm({
      isOpen: true,
      section,
      isRotating: false,
      successMessage: ''
    });
  };

  const handleExecuteRotateCode = async () => {
    if (!rotateConfirm.section) return;
    setRotateConfirm((prev) => ({ ...prev, isRotating: true }));

    try {
      const updated = await onboardingApi.rotateSectionCode(rotateConfirm.section.id);
      setSections((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
      );
      setRotateConfirm({
        isOpen: true,
        section: updated,
        isRotating: false,
        successMessage: `Join code regenerated: ${updated.joinCode}`
      });

      setTimeout(() => {
        setRotateConfirm({ isOpen: false, section: null, isRotating: false, successMessage: '' });
      }, 1400);
    } catch (err) {
      console.error(err);
      setRotateConfirm((prev) => ({ ...prev, isRotating: false }));
    }
  };

  const filteredSections =
    selectedCourseId === 'ALL'
      ? sections
      : sections.filter((s) => s.courseId === selectedCourseId);

  const getCourseCode = (courseId) => {
    const found = courses.find((c) => c.id === courseId);
    return found ? found.code : courseId.toUpperCase();
  };

  const getCourseTitle = (courseId) => {
    const found = courses.find((c) => c.id === courseId);
    return found ? found.title : '';
  };

  // Helper to format expiry nicely
  const formatExpiry = (isoString) => {
    if (!isoString) return 'No expiry set';
    try {
      const expDate = new Date(isoString);
      const now = new Date();
      const diffMs = expDate.getTime() - now.getTime();
      if (diffMs <= 0) return 'Expired';
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `Expires in ${hours}h ${mins}m (${expDate.toLocaleDateString()} ${expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="cp-stack">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="cp-eyebrow">Section Registry</span>
          <h2 className="cp-h2">Section Management & Join Codes</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="cp-badge is-outline">Cohort Tokens</span>
        </div>
      </div>

      {/* Main Panel */}
      <div className="border border-border bg-surface shadow-sm">
        {/* Header & Course Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-surface">
          <div>
            <span className="cp-eyebrow">Classroom Cohorts</span>
            <h3 className="cp-h3 mt-0.5">Section Tokens & Faculty Linkage</h3>
            <p className="cp-lead text-secondary text-xs mt-0.5">
              Distribute randomized student join tokens. Rotate codes on demand to prevent unauthorized admittance.
            </p>
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="course-filter" className="cp-label text-[9px] uppercase tracking-wider text-muted">
              Filter Course:
            </label>
            <select
              id="course-filter"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="cp-select text-xs py-1 px-3 h-8"
            >
              <option value="ALL">All Enrolled Courses ({sections.length} Sections)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section Table */}
        {loading ? (
          <div className="p-8 text-center text-xs text-muted">Loading section rosters...</div>
        ) : filteredSections.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted border-b border-border bg-surface-sunken">
            No sections found for the selected course.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="cp-table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-[10px] uppercase font-black tracking-wider text-muted">
                  <th className="py-2.5 px-4">Course / Cohort</th>
                  <th className="py-2.5 px-4">Section Name</th>
                  <th className="py-2.5 px-4">Active Join Code</th>
                  <th className="py-2.5 px-4">Code Validity / Expiry</th>
                  <th className="py-2.5 px-4">Assigned Teacher(s)</th>
                  <th className="py-2.5 px-4">Enrolled</th>
                  <th className="py-2.5 px-4 text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody>
                {filteredSections.map((sec) => (
                  <tr key={sec.id} className="border-b border-border-faint last:border-b-0 hover:bg-surface-hover">
                    <td className="py-2.5 px-4 text-xs">
                      <span className="cp-badge is-ink font-mono font-bold">
                        {getCourseCode(sec.courseId)}
                      </span>
                      <div className="text-[11px] text-muted truncate max-w-[180px] mt-0.5">
                        {getCourseTitle(sec.courseId)}
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-xs font-bold text-primary">
                      {sec.name}
                    </td>

                    <td className="py-2.5 px-4 text-xs">
                      <span className="font-mono font-bold text-primary bg-surface-sunken px-2 py-0.5 border border-border">
                        {sec.joinCode}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-xs">
                      <div className="font-mono text-[11px] text-primary">
                        {new Date(sec.joinCodeExpiresAt).toLocaleDateString()} · {new Date(sec.joinCodeExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span className="cp-caption text-muted block text-[10px] mt-0.5">
                        24h Rolling Window
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-xs">
                      <div className="text-primary font-semibold">
                        {sec.teacherNames?.join(', ') || 'Unassigned'}
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-xs font-mono">
                      <span className="font-bold text-primary">{sec.enrolledCount}</span> students
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenRotateConfirm(sec)}
                        className="cp-btn cp-btn-secondary text-[11px] min-h-0 h-7 px-2.5 py-0"
                      >
                        Rotate Code
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3.5 bg-surface-sunken">
          <div className="text-[11px] text-muted">
            Join codes are entered by students in the Student Portal to register their personal device into this lecture group.
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL: Rotate Join Code */}
      {rotateConfirm.isOpen && rotateConfirm.section && (
        <div className="cp-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="cp-modal w-full max-w-lg border border-border-strong bg-surface p-6 sm:p-8 shadow-modal space-y-6">
            <div className="cp-modal-header flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="cp-eyebrow">Security Operation</span>
                <h3 className="cp-h3 mt-1">Rotate Section Join Code</h3>
              </div>
              <button
                type="button"
                onClick={() => setRotateConfirm({ isOpen: false, section: null, isRotating: false, successMessage: '' })}
                className="text-lg font-bold text-muted hover:text-ink"
              >
                ×
              </button>
            </div>

            <div className="cp-modal-body space-y-4">
              {rotateConfirm.successMessage ? (
                <div className="p-6 border border-border-strong bg-surface-sunken text-center space-y-2">
                  <div className="text-lg font-black text-primary">✓ CODE ROTATED SUCCESSFULLY</div>
                  <div className="font-mono text-2xl font-black tracking-widest py-2">
                    {rotateConfirm.section.joinCode}
                  </div>
                  <p className="text-xs text-secondary">
                    All previous invitations have been revoked. New expiry is set to 24 hours from now.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-secondary leading-relaxed">
                    Are you sure you want to invalidate the active join code for{' '}
                    <strong className="text-primary">{rotateConfirm.section.name}</strong> (Course:{' '}
                    <strong className="text-primary">{getCourseCode(rotateConfirm.section.courseId)}</strong>)?
                  </p>

                  <div className="p-4 border border-border-strong bg-surface-sunken space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted uppercase font-bold">Current Code:</span>
                      <span className="font-mono font-bold text-primary">{rotateConfirm.section.joinCode}</span>
                    </div>
                    <div className="text-[11px] text-secondary">
                      Warning: Any student actively in the process of onboarding with this code will need the new replacement code.
                    </div>
                  </div>
                </>
              )}
            </div>

            {!rotateConfirm.successMessage && (
              <div className="cp-modal-footer border-t border-border pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRotateConfirm({ isOpen: false, section: null, isRotating: false, successMessage: '' })}
                  className="cp-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={rotateConfirm.isRotating}
                  onClick={handleExecuteRotateCode}
                  className="cp-btn-danger text-xs font-bold"
                >
                  {rotateConfirm.isRotating ? 'Rotating Code...' : 'Revoke & Generate New Code'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
