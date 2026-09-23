'use client';

import React, { useState, useEffect } from 'react';
import { onboardingApi } from '../../lib/onboardingApi';

export const CourseSyllabusView = ({ onProceedToSections }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Upload Syllabus
  const [uploadModal, setUploadModal] = useState({
    isOpen: false,
    course: null,
    pdfName: '',
    pdfFile: null,
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
      pdfFile: null,
      copoName: course.copoFileName || '',
      isSubmitting: false,
      error: ''
    });
  };

  const handleSubmitUpload = async (e) => {
    e.preventDefault();
    if (!uploadModal.pdfFile) {
      setUploadModal((prev) => ({
        ...prev,
        error:
          'Attach a syllabus CSV with unit, order, title, coTags and bloomLevel columns. ' +
          'The server stores concepts, so a PDF cannot be parsed here yet.'
      }));
      return;
    }

    setUploadModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      await onboardingApi.uploadSyllabus(uploadModal.course.id, {
        syllabusFile: uploadModal.pdfFile,
        syllabusFileName: uploadModal.pdfName || 'syllabus.csv'
      });
      await fetchCourses();
      setUploadModal({ isOpen: false, course: null, pdfName: '', pdfFile: null, copoName: '', isSubmitting: false, error: '' });
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
    <div className="space-y-4">
      {/* Top Heading & Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <span className="cp-eyebrow">Curriculum Directory</span>
          <h2 className="cp-h2 mt-0.5">Course Catalog & Syllabus</h2>
          <p className="cp-lead text-secondary text-xs mt-1">
            Upload course syllabi and CO–PO matrix mappings. Parsed concept hierarchies feed directly into real-time speech telemetry.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="cp-caption">
            Total: <strong className="text-ink">{courses.length}</strong> courses
          </div>
        </div>
      </div>

      {/* Main Course Table Container */}
      <div className="border border-border bg-surface shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted">Retrieving course directory...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="cp-table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-sunken">
                  <th className="py-2.5 px-4">Course Code</th>
                  <th className="py-2.5 px-4">Title & Department</th>
                  <th className="py-2.5 px-4">Credits</th>
                  <th className="py-2.5 px-4">Syllabus Status</th>
                  <th className="py-2.5 px-4">Concepts</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => {
                  const canViewConcepts = course.status === 'parsed' || course.status === 'validated';

                  return (
                    <tr key={course.id} className="hover:bg-surface-hover border-b border-border-faint last:border-b-0">
                      <td className="py-2.5 px-4 font-mono font-bold text-xs text-primary whitespace-nowrap">
                        {course.code}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        <div className="font-bold text-primary leading-snug">{course.title}</div>
                        <div className="text-muted text-[11px] mt-0.5">
                          {course.department} · {course.semester}
                        </div>
                        {course.syllabusFileName && (
                          <div className="text-[10px] text-secondary font-mono mt-0.5 flex items-center gap-2">
                            <span>▤ {course.syllabusFileName}</span>
                            {course.copoFileName && <span>· CO-PO: {course.copoFileName}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-primary whitespace-nowrap">
                        {course.credits} Cr
                      </td>
                      <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                        {renderStatusBadge(course.status)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs whitespace-nowrap">
                        {canViewConcepts ? (
                          <span className="font-bold text-primary">{course.conceptCount || 14} nodes</span>
                        ) : (
                          <span className="text-muted text-[11px]">Unparsed</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenUpload(course)}
                            className="cp-btn cp-btn-secondary text-[11px] min-h-0 h-7 px-2.5 py-0"
                          >
                            {course.status === 'none' ? 'Upload' : 'Re-Upload'}
                          </button>

                          <button
                            type="button"
                            disabled={!canViewConcepts}
                            onClick={() => handleOpenConcepts(course)}
                            className={`text-[11px] min-h-0 h-7 px-2.5 py-0 ${
                              canViewConcepts ? 'cp-btn cp-btn-primary' : 'cp-btn cp-btn-secondary opacity-40 cursor-not-allowed'
                            }`}
                            title={canViewConcepts ? 'Inspect generated concept graph' : 'Upload syllabus to view concepts'}
                          >
                            Concepts
                          </button>

                          {course.status === 'parsed' && (
                            <button
                              type="button"
                              onClick={() => handleValidateCourse(course.id)}
                              className="cp-btn cp-btn-ghost text-[11px] min-h-0 h-7 px-2 py-0 border border-border-strong font-bold"
                              title="Sign-off on syllabus concepts"
                            >
                              Validate ✓
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3.5 bg-surface-sunken">
          <div className="text-[11px] text-muted">
            Status: <strong className="text-ink">NONE</strong> → <strong className="text-ink">UPLOADED</strong> → <strong className="text-ink">PARSED</strong> → <strong className="text-ink">VALIDATED</strong>
          </div>

          {onProceedToSections && (
            <button
              type="button"
              onClick={onProceedToSections}
              className="cp-btn cp-btn-primary min-h-0 h-8 px-3 text-xs"
            >
              Proceed to Section Management →
            </button>
          )}
        </div>
      </div>

      {/* MODAL: Upload Syllabus + CO-PO Mapping Sheet */}
      {uploadModal.isOpen && uploadModal.course && (
        <div className="cp-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="cp-modal w-full max-w-lg border border-border-strong bg-surface p-5 sm:p-6 shadow-modal">
            <div className="cp-modal-header flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="cp-eyebrow">Curriculum Ingestion</span>
                <h3 className="cp-h3 mt-0.5">Upload Course Syllabus & Outcome Sheet</h3>
                <p className="cp-lead text-secondary text-xs mt-0.5">
                  Target: <strong>{uploadModal.course.code}</strong> — {uploadModal.course.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadModal({ isOpen: false, course: null, pdfName: '', pdfFile: null, copoName: '', isSubmitting: false, error: '' })}
                className="text-lg font-bold text-muted hover:text-ink leading-none p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitUpload} className="cp-modal-body pt-3.5 space-y-3.5">
              {uploadModal.error && (
                <div className="p-2.5 border border-border-strong bg-surface-sunken text-xs font-bold text-primary">
                  × {uploadModal.error}
                </div>
              )}

              {/* Syllabus PDF Upload */}
              <div className="space-y-1.5">
                <label className="cp-label block">
                  1. Official Syllabus Document (PDF) <span className="text-primary">*</span>
                </label>
                <div className="border border-dashed border-border-strong p-3 bg-surface-sunken space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-primary truncate">
                      {uploadModal.pdfName || 'No PDF attached'}
                    </span>
                    <label className="cp-btn cp-btn-secondary text-xs min-h-0 h-7 px-2.5 py-0 cursor-pointer shrink-0">
                      Select PDF...
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setUploadModal((prev) => ({ ...prev, pdfName: file.name, pdfFile: file }));
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <span className="cp-caption text-muted block text-[10px]">
                    Accepts official syllabus breakdown with units, topics, and lab experiments.
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setUploadModal((prev) => ({
                        ...prev,
                        pdfName: `${uploadModal.course.code}_concepts.csv`,
                        // A real file, so the demo path exercises the same parse + upload.
                        pdfFile: new File(
                          [
                            'unit,order,title,coTags,bloomLevel\n' +
                              'Unit 1: Foundations,1,Core Axioms & Scope,CO1,L2 Understand\n' +
                              'Unit 1: Foundations,2,Mathematical Formulations,CO1|CO2,L3 Apply\n' +
                              'Unit 2: Applied,3,Algorithmic Optimization,CO3,L4 Analyze\n'
                          ],
                          `${uploadModal.course.code}_concepts.csv`,
                          { type: 'text/csv' }
                        )
                      }))
                    }
                    className="text-[10px] text-secondary underline hover:text-ink"
                  >
                    + Use Standard Accredited PDF Template
                  </button>
                </div>
              </div>

              {/* CO-PO Mapping Sheet */}
              <div className="space-y-1.5">
                <label className="cp-label block">
                  2. CO–PO Attainment Matrix (Excel / CSV) <span className="text-primary">*</span>
                </label>
                <div className="border border-dashed border-border-strong p-3 bg-surface-sunken space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-primary truncate">
                      {uploadModal.copoName || 'No Mapping Matrix attached'}
                    </span>
                    <label className="cp-btn cp-btn-secondary text-xs min-h-0 h-7 px-2.5 py-0 cursor-pointer shrink-0">
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

              <div className="cp-modal-footer border-t border-border pt-3.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setUploadModal({ isOpen: false, course: null, pdfName: '', pdfFile: null, copoName: '', isSubmitting: false, error: '' })}
                  className="cp-btn cp-btn-secondary min-h-0 h-8 px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadModal.isSubmitting}
                  className="cp-btn cp-btn-primary min-h-0 h-8 px-3 text-xs"
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
          <div className="cp-modal w-full max-w-2xl border border-border-strong bg-surface p-5 sm:p-6 shadow-modal max-h-[85vh] flex flex-col">
            <div className="cp-modal-header flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="cp-eyebrow">Knowledge Graph Hierarchy</span>
                <h3 className="cp-h3 mt-0.5">
                  Concept Nodes: {conceptDrawer.course.code}
                </h3>
                <p className="cp-lead text-secondary text-xs mt-0.5">
                  {conceptDrawer.course.title} · {conceptDrawer.concepts.length} Structured Concept Nodes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConceptDrawer({ isOpen: false, course: null, concepts: [], loading: false })}
                className="text-lg font-bold text-muted hover:text-ink leading-none p-1"
              >
                ×
              </button>
            </div>

            <div className="cp-modal-body py-3 overflow-y-auto flex-1 space-y-3">
              {conceptDrawer.loading ? (
                <div className="p-6 text-center text-xs text-muted">Retrieving concept graph...</div>
              ) : conceptDrawer.concepts.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted">No concepts found for this syllabus.</div>
              ) : (
                <div className="space-y-3">
                  {/* Group concepts by unit */}
                  {Array.from(new Set(conceptDrawer.concepts.map((c) => c.unit))).map((unitName) => {
                    const unitConcepts = conceptDrawer.concepts.filter((c) => c.unit === unitName);
                    return (
                      <div key={unitName} className="border border-border bg-surface-sunken p-3 space-y-2">
                        <div className="flex items-center justify-between border-b border-border-soft pb-1.5">
                          <span className="cp-eyebrow text-primary font-black">{unitName}</span>
                          <span className="cp-badge text-[10px]">{unitConcepts.length} Concept Nodes</span>
                        </div>

                        <div className="space-y-1.5">
                          {unitConcepts.map((node) => (
                            <div
                              key={node.id}
                              className="border border-border bg-surface p-2 px-2.5 flex flex-wrap items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono text-xs font-bold text-muted w-5">
                                  #{node.order}
                                </span>
                                <div>
                                  <div className="text-xs font-bold text-primary leading-tight">{node.title}</div>
                                  <div className="text-[10px] text-muted font-mono">
                                    ID: {node.id}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="cp-badge border border-border-input bg-surface-sunken text-[10px]">
                                  {node.bloomLevel || 'L2 Understand'}
                                </span>
                                <div className="flex gap-1">
                                  {node.coTags?.map((co) => (
                                    <span key={co} className="cp-badge is-ink text-[10px]">
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

            <div className="cp-modal-footer border-t border-border pt-3 flex items-center justify-between">
              <span className="text-[10px] text-muted">
                Monitored by boundary mics during lecture delivery.
              </span>
              <button
                type="button"
                onClick={() => setConceptDrawer({ isOpen: false, course: null, concepts: [], loading: false })}
                className="cp-btn cp-btn-secondary min-h-0 h-8 px-3 text-xs"
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
