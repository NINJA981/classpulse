'use client';

import React, { useState, useEffect } from 'react';
import { onboardingApi } from '../../mock/onboardingApi';

export const CourseSyllabusView = ({ onProceedToSections }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Upload Syllabus
  const [uploadModal, setUploadModal] = useState({
    isOpen: false,
    course: null,
    pdfName: '',
    copoName: '',
    isSubmitting: false,
    error: ''
  });

  // Drawer / Modal State for View Concepts
  const [conceptDrawer, setConceptDrawer] = useState({
    isOpen: false,
    course: null,
    concepts: [],
    loading: false
  });

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const data = await onboardingApi.getCourses();
      setCourses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Status Badge Helper adhering to Swiss monochrome One-Ink rule
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'validated':
        return (
          <span className="cp-badge is-ink inline-flex items-center gap-1.5 px-2.5 py-1">
            <span aria-hidden="true">✓</span> VALIDATED
          </span>
        );
      case 'parsed':
        return (
          <span className="cp-badge border border-border-strong bg-surface-sunken text-primary font-black inline-flex items-center gap-1.5 px-2.5 py-1">
            <span aria-hidden="true">▣</span> PARSED
          </span>
        );
      case 'uploaded':
        return (
          <span className="cp-badge is-outline border-border-strong text-primary inline-flex items-center gap-1.5 px-2.5 py-1">
            <span aria-hidden="true">●</span> UPLOADED
          </span>
        );
      case 'none':
      default:
        return (
          <span className="cp-badge is-muted text-muted inline-flex items-center gap-1.5 px-2.5 py-1">
            <span aria-hidden="true">○</span> NONE
          </span>
        );
    }
  };

  const handleOpenUpload = (course) => {
    setUploadModal({
      isOpen: true,
      course,
      pdfName: course.syllabusFileName || '',
      copoName: course.copoFileName || '',
      isSubmitting: false,
      error: ''
    });
  };

  const handleSubmitUpload = async (e) => {
    e.preventDefault();
    if (!uploadModal.pdfName && !uploadModal.copoName) {
      setUploadModal((prev) => ({
        ...prev,
        error: 'Please provide either a syllabus PDF or a CO-PO mapping sheet.'
      }));
      return;
    }

    setUploadModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      await onboardingApi.uploadSyllabus(uploadModal.course.id, {
        syllabusFileName: uploadModal.pdfName || 'Course_Syllabus.pdf',
        copoFileName: uploadModal.copoName || 'CO_PO_Matrix.xlsx'
      });
      await fetchCourses();
      setUploadModal({ isOpen: false, course: null, pdfName: '', copoName: '', isSubmitting: false, error: '' });
    } catch (err) {
      setUploadModal((prev) => ({ ...prev, isSubmitting: false, error: err.message }));
    }
  };

  const handleValidateCourse = async (courseId) => {
    try {
      await onboardingApi.validateCourseSyllabus(courseId);
      await fetchCourses();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenConcepts = async (course) => {
    setConceptDrawer({
      isOpen: true,
      course,
      concepts: [],
      loading: true
    });

    try {
      const list = await onboardingApi.getCourseConcepts(course.id);
      setConceptDrawer({
        isOpen: true,
        course,
        concepts: list,
        loading: false
      });
    } catch (err) {
      setConceptDrawer((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="cp-stack">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="cp-eyebrow">Curriculum Directory</span>
          <h2 className="cp-h2">Course Catalog & Syllabus Parsing</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="cp-badge is-outline">Curriculum Ingestion</span>
        </div>
      </div>

      {/* Main Course Table Panel */}
      <div className="cp-panel border border-border bg-surface p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <span className="cp-eyebrow">Curriculum Directory</span>
            <h3 className="cp-h3 mt-1">Institutional Courses & Outcomes</h3>
            <p className="cp-lead text-secondary text-xs mt-1">
              Upload course syllabi and CO–PO matrix mappings. Parsed concept hierarchies feed directly into real-time speech telemetry.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="cp-badge is-ink">{courses.length} Active Courses</span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted">Retrieving course directory...</div>
        ) : (
          <div className="cp-table-wrap overflow-x-auto">
            <table className="cp-table w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-border-strong bg-surface-sunken text-[10px] uppercase font-black tracking-wider">
                  <th className="p-3">Course Code</th>
                  <th className="p-3">Title & Department</th>
                  <th className="p-3">Credits</th>
                  <th className="p-3">Syllabus Status</th>
                  <th className="p-3">Concepts</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => {
                  const canViewConcepts = course.status === 'parsed' || course.status === 'validated';

                  return (
                    <tr key={course.id} className="border-b border-border-faint hover:bg-surface-hover">
                      <td className="p-3 font-mono font-bold text-xs text-primary">
                        {course.code}
                      </td>
                      <td className="p-3 text-xs">
                        <div className="font-bold text-primary">{course.title}</div>
                        <div className="text-muted text-[11px] mt-0.5">
                          {course.department} · {course.semester}
                        </div>
                        {course.syllabusFileName && (
                          <div className="text-[10px] text-secondary font-mono mt-1 flex items-center gap-2">
                            <span>📄 {course.syllabusFileName}</span>
                            {course.copoFileName && <span>· ▤ {course.copoFileName}</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs text-primary">
                        {course.credits} Cr
                      </td>
                      <td className="p-3 text-xs">
                        {renderStatusBadge(course.status)}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {canViewConcepts ? (
                          <span className="font-bold text-primary">{course.conceptCount || 14} nodes</span>
                        ) : (
                          <span className="text-muted text-[11px]">Unparsed</span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenUpload(course)}
                          className="cp-btn-secondary text-xs py-1 px-3"
                        >
                          {course.status === 'none' ? 'Upload Syllabus' : 'Re-Upload'}
                        </button>

                        <button
                          type="button"
                          disabled={!canViewConcepts}
                          onClick={() => handleOpenConcepts(course)}
                          className={`text-xs py-1 px-3 ${
                            canViewConcepts ? 'cp-btn-primary' : 'cp-btn-secondary opacity-50 cursor-not-allowed'
                          }`}
                          title={canViewConcepts ? 'Inspect generated concept graph' : 'Upload syllabus to view concepts'}
                        >
                          View Concepts
                        </button>

                        {course.status === 'parsed' && (
                          <button
                            type="button"
                            onClick={() => handleValidateCourse(course.id)}
                            className="cp-btn-ghost text-xs py-1 px-2 border-border-strong font-bold"
                            title="Sign-off on syllabus concepts"
                          >
                            Validate ✓
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <div className="text-xs text-muted">
            Status Legend: <strong>NONE</strong> (No file) → <strong>UPLOADED</strong> (Staged) → <strong>PARSED</strong> (AI Nodes Extracted) → <strong>VALIDATED</strong> (Ready for Classrooms)
          </div>

          {onProceedToSections && (
            <button
              type="button"
              onClick={onProceedToSections}
              className="cp-btn-primary"
            >
              Proceed to Section Management →
            </button>
          )}
        </div>
      </div>

      {/* MODAL: Upload Syllabus + CO-PO Mapping Sheet */}
      {uploadModal.isOpen && uploadModal.course && (
        <div className="cp-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="cp-modal w-full max-w-xl border border-border-strong bg-surface p-6 sm:p-8 shadow-modal">
            <div className="cp-modal-header flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="cp-eyebrow">Curriculum Ingestion</span>
                <h3 className="cp-h3 mt-1">Upload Course Syllabus & Outcome Sheet</h3>
                <p className="cp-lead text-secondary text-xs mt-1">
                  Target: <strong>{uploadModal.course.code}</strong> — {uploadModal.course.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadModal({ isOpen: false, course: null, pdfName: '', copoName: '', isSubmitting: false, error: '' })}
                className="text-lg font-bold text-muted hover:text-ink"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitUpload} className="cp-modal-body py-6 space-y-6">
              {uploadModal.error && (
                <div className="p-3 border border-border-strong bg-surface-sunken text-xs font-bold text-primary">
                  × {uploadModal.error}
                </div>
              )}

              {/* Syllabus PDF Upload */}
              <div className="space-y-2">
                <label className="cp-label block">
                  1. Official Syllabus Document (PDF) <span className="text-primary">*</span>
                </label>
                <div className="border border-dashed border-border-strong p-4 bg-surface-sunken space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-primary">
                      {uploadModal.pdfName || 'No PDF attached'}
                    </span>
                    <label className="cp-btn-secondary text-xs py-1 px-3 cursor-pointer">
                      Select PDF...
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setUploadModal((prev) => ({ ...prev, pdfName: file.name }));
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <span className="cp-caption text-muted block text-[10px]">
                    Accepts official university/college syllabus breakdown with units, topics, and lab experiments.
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setUploadModal((prev) => ({
                        ...prev,
                        pdfName: `${uploadModal.course.code}_Syllabus_Official_2026.pdf`
                      }))
                    }
                    className="text-[10px] text-secondary underline hover:text-ink"
                  >
                    + Use Standard Accredited PDF Template
                  </button>
                </div>
              </div>

              {/* CO-PO Mapping Sheet */}
              <div className="space-y-2">
                <label className="cp-label block">
                  2. CO–PO Attainment Matrix (Excel / CSV) <span className="text-primary">*</span>
                </label>
                <div className="border border-dashed border-border-strong p-4 bg-surface-sunken space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-primary">
                      {uploadModal.copoName || 'No Mapping Matrix attached'}
                    </span>
                    <label className="cp-btn-secondary text-xs py-1 px-3 cursor-pointer">
                      Select Matrix...
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setUploadModal((prev) => ({ ...prev, copoName: file.name }));
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <span className="cp-caption text-muted block text-[10px]">
                    Course Outcomes (CO1–CO5) mapped against Program Outcomes (PO1–PO12) and Bloom taxonomy levels.
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setUploadModal((prev) => ({
                        ...prev,
                        copoName: `${uploadModal.course.code}_CO_PO_Attainment_Sheet.xlsx`
                      }))
                    }
                    className="text-[10px] text-secondary underline hover:text-ink"
                  >
                    + Use Standard NBA/NAAC Outcome Matrix Template
                  </button>
                </div>
              </div>

              <div className="cp-modal-footer border-t border-border pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setUploadModal({ isOpen: false, course: null, pdfName: '', copoName: '', isSubmitting: false, error: '' })}
                  className="cp-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadModal.isSubmitting}
                  className="cp-btn-primary"
                >
                  {uploadModal.isSubmitting ? 'Parsing & Extracting Nodes...' : 'Upload & Parse Hierarchy →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: Read-only Concept Nodes List */}
      {conceptDrawer.isOpen && conceptDrawer.course && (
        <div className="cp-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="cp-modal w-full max-w-3xl border border-border-strong bg-surface p-6 sm:p-8 shadow-modal max-h-[90vh] flex flex-col">
            <div className="cp-modal-header flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="cp-eyebrow">Knowledge Graph Hierarchy</span>
                <h3 className="cp-h3 mt-1">
                  Concept Nodes: {conceptDrawer.course.code}
                </h3>
                <p className="cp-lead text-secondary text-xs mt-1">
                  {conceptDrawer.course.title} · {conceptDrawer.concepts.length} Structured Concept Nodes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConceptDrawer({ isOpen: false, course: null, concepts: [], loading: false })}
                className="text-lg font-bold text-muted hover:text-ink"
              >
                ×
              </button>
            </div>

            <div className="cp-modal-body py-4 overflow-y-auto flex-1 space-y-4">
              {conceptDrawer.loading ? (
                <div className="p-8 text-center text-xs text-muted">Retrieving concept graph...</div>
              ) : conceptDrawer.concepts.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">No concepts found for this syllabus.</div>
              ) : (
                <div className="space-y-4">
                  {/* Group concepts by unit */}
                  {Array.from(new Set(conceptDrawer.concepts.map((c) => c.unit))).map((unitName) => {
                    const unitConcepts = conceptDrawer.concepts.filter((c) => c.unit === unitName);
                    return (
                      <div key={unitName} className="border border-border bg-surface-sunken p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-border-soft pb-2">
                          <span className="cp-eyebrow text-primary font-black">{unitName}</span>
                          <span className="cp-badge">{unitConcepts.length} Concept Nodes</span>
                        </div>

                        <div className="space-y-2">
                          {unitConcepts.map((node) => (
                            <div
                              key={node.id}
                              className="border border-border bg-surface p-3 flex flex-wrap items-center justify-between gap-3"
                            >
                              <div className="flex items-start gap-3">
                                <span className="font-mono text-xs font-bold text-muted w-6">
                                  #{node.order}
                                </span>
                                <div>
                                  <div className="text-xs font-bold text-primary">{node.title}</div>
                                  <div className="text-[10px] text-muted font-mono mt-0.5">
                                    Node ID: {node.id}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="cp-badge border border-border-input bg-surface-sunken">
                                  {node.bloomLevel || 'L2 Understand'}
                                </span>
                                <div className="flex gap-1">
                                  {node.coTags?.map((co) => (
                                    <span key={co} className="cp-badge is-ink">
                                      {co}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="cp-modal-footer border-t border-border pt-4 flex items-center justify-between">
              <span className="text-[11px] text-muted">
                These nodes are monitored by boundary mics during lecture delivery.
              </span>
              <button
                type="button"
                onClick={() => setConceptDrawer({ isOpen: false, course: null, concepts: [], loading: false })}
                className="cp-btn-secondary text-xs"
              >
                Close Concept Hierarchy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
