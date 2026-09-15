'use client';

import React, { useState, useEffect } from 'react';
import { onboardingApi } from '../../mock/onboardingApi';

const CSV_SLOTS = [
  {
    id: 'departments',
    fileName: 'departments.csv',
    title: 'Department Registry',
    expectedCols: 'code, name, hodEmail, building',
    sampleRows: 'CSE, Computer Science & Engineering, hod.cse@apex.edu, Alan Turing Block'
  },
  {
    id: 'courses',
    fileName: 'courses.csv',
    title: 'Course Catalog',
    expectedCols: 'courseCode, title, departmentCode, credits, semester',
    sampleRows: 'CS301, Data Structures & Algorithms, CSE, 4, Semester 3'
  },
  {
    id: 'sections',
    fileName: 'sections.csv',
    title: 'Sections & Classrooms',
    expectedCols: 'sectionName, courseCode, academicYear, roomNumber',
    sampleRows: 'SEC-A, CS301, 2026-2027, Science Lab 2'
  },
  {
    id: 'students',
    fileName: 'students.csv',
    title: 'Student Enrollments',
    expectedCols: 'rollNumber, name, email, sectionNames',
    sampleRows: '21CS042, Aarav Nair, aarav.n@apex.edu, SEC-A'
  }
];

export const RosterImportView = ({ onProceedToCourses }) => {
  // Upload slots state: { [slotId]: { file: File | string, size: string, isUploaded: boolean } }
  const [uploadedSlots, setUploadedSlots] = useState({
    departments: null,
    courses: null,
    sections: null,
    students: null
  });

  // Stage: 'upload' | 'job_status' | 'review' | 'confirmed'
  const [stage, setStage] = useState('upload');
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState('pending'); // 'pending' | 'processing' | 'done'
  const [jobProgressPercent, setJobProgressPercent] = useState(15);
  const [jobData, setJobData] = useState(null);

  // Errors state with inline editing capabilities
  const [errorsList, setErrorsList] = useState([]);
  const [inlineEdits, setInlineEdits] = useState({}); // { [errorIndex]: value }
  const [fixStatus, setFixStatus] = useState({}); // { [errorIndex]: { loading, message, resolved } }
  
  // Acknowledgment toggle required before confirming
  const [errorsAcknowledged, setErrorsAcknowledged] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);

  // Check if any slot is populated
  const allSlotsFilled = CSV_SLOTS.every((slot) => !!uploadedSlots[slot.id]);
  const someSlotsFilled = CSV_SLOTS.some((slot) => !!uploadedSlots[slot.id]);

  const handleFileSelect = (slotId, e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedSlots((prev) => ({
        ...prev,
        [slotId]: {
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          isUploaded: true
        }
      }));
    }
  };

  const handleLoadSampleCSVs = () => {
    setUploadedSlots({
      departments: { name: 'departments.csv', size: '14.2 KB', isUploaded: true },
      courses: { name: 'courses.csv', size: '28.6 KB', isUploaded: true },
      sections: { name: 'sections.csv', size: '18.1 KB', isUploaded: true },
      students: { name: 'students.csv', size: '94.8 KB', isUploaded: true }
    });
  };

  const handleClearSlot = (slotId) => {
    setUploadedSlots((prev) => ({ ...prev, [slotId]: null }));
  };

  const handleStartImport = async () => {
    setStage('job_status');
    setJobStatus('pending');
    setJobProgressPercent(20);

    try {
      const { importJobId } = await onboardingApi.uploadRoster(uploadedSlots);
      setJobId(importJobId);

      // Simulate pipeline: pending -> processing -> done
      setTimeout(async () => {
        setJobStatus('processing');
        setJobProgressPercent(65);
        await onboardingApi.advanceJobProgress(importJobId, 'processing');

        setTimeout(async () => {
          setJobStatus('done');
          setJobProgressPercent(100);
          await onboardingApi.advanceJobProgress(importJobId, 'done');
          const details = await onboardingApi.getImportStatus(importJobId);
          setJobData(details);
          setErrorsList(details.errors || []);
          // Transition to review after a brief pause
          setTimeout(() => {
            setStage('review');
          }, 800);
        }, 1200);
      }, 900);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInlineChange = (index, value) => {
    setInlineEdits((prev) => ({ ...prev, [index]: value }));
  };

  const handleFixAndRecheck = async (index, err) => {
    const editVal = inlineEdits[index] !== undefined ? inlineEdits[index] : (err.suggestedValue || err.value);
    setFixStatus((prev) => ({ ...prev, [index]: { loading: true, message: 'Validating against schema...' } }));

    try {
      const res = await onboardingApi.fixImportRow(jobId || 'job-init-101', err.row, err.field, editVal);
      if (res.resolved) {
        setFixStatus((prev) => ({
          ...prev,
          [index]: { loading: false, message: '✓ Resolved & verified', resolved: true }
        }));
        // Update local error list
        setErrorsList((prev) => prev.filter((item) => !(item.row === err.row && item.field === err.field)));
        if (jobData) {
          setJobData({
            ...jobData,
            successCount: (jobData.successCount || 144) + 1
          });
        }
      } else {
        setFixStatus((prev) => ({
          ...prev,
          [index]: { loading: false, message: `× ${res.message}`, resolved: false }
        }));
      }
    } catch (apiErr) {
      setFixStatus((prev) => ({
        ...prev,
        [index]: { loading: false, message: '× Error re-checking row.', resolved: false }
      }));
    }
  };

  const handleConfirmImport = async () => {
    if (errorsList.length > 0 && !errorsAcknowledged) {
      return;
    }
    setIsConfirming(true);
    try {
      const result = await onboardingApi.confirmImport(jobId || 'job-init-101');
      setConfirmResult(result);
      setStage('confirmed');
    } catch (err) {
      console.error(err);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="cp-stack">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="cp-eyebrow">Roster Management</span>
          <h2 className="cp-h2">Roster & Academic Schema Import</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="cp-badge is-outline">Roster Ingestion</span>
        </div>
      </div>

      {/* Stage 1: File Upload Slots */}
      {stage === 'upload' && (
        <div className="cp-panel border border-border bg-surface p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <span className="cp-eyebrow">Data Provisioning Slots</span>
              <h3 className="cp-h3 mt-1">Multi-File Roster Intake</h3>
              <p className="cp-lead text-secondary text-xs mt-1">
                Provide the four foundational CSV datasets. You may upload custom exports or pre-fill with verified sample schemas.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadSampleCSVs}
              className="cp-btn-secondary text-xs"
            >
              ▤ Pre-populate Demo CSVs
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CSV_SLOTS.map((slot) => {
              const fileInfo = uploadedSlots[slot.id];
              return (
                <div
                  key={slot.id}
                  className={`border p-4 transition-colors ${
                    fileInfo ? 'border-border-strong bg-surface-sunken' : 'border-border bg-surface'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="cp-badge is-ink">{slot.fileName}</span>
                        {fileInfo && <span className="cp-badge">Staged</span>}
                      </div>
                      <h4 className="cp-h4 font-bold text-sm text-primary">{slot.title}</h4>
                    </div>
                    {fileInfo ? (
                      <button
                        type="button"
                        onClick={() => handleClearSlot(slot.id)}
                        className="text-xs font-bold text-muted hover:text-ink"
                        title="Remove file"
                      >
                        × Remove
                      </button>
                    ) : (
                      <label
                        htmlFor={`file-${slot.id}`}
                        className="cp-btn-secondary text-xs py-1 px-3 cursor-pointer"
                      >
                        Browse...
                      </label>
                    )}
                    <input
                      id={`file-${slot.id}`}
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleFileSelect(slot.id, e)}
                      className="hidden"
                    />
                  </div>

                  {fileInfo ? (
                    <div className="mt-3 pt-3 border-t border-border-soft flex items-center justify-between text-xs">
                      <span className="font-mono text-primary font-bold">{fileInfo.name}</span>
                      <span className="text-muted">{fileInfo.size}</span>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-border-soft space-y-1 text-xs">
                      <div className="text-secondary font-mono text-[11px]">
                        <strong>Expected:</strong> {slot.expectedCols}
                      </div>
                      <div className="text-muted text-[10px]">
                        e.g. {slot.sampleRows}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <div className="text-xs text-muted">
              {allSlotsFilled
                ? 'All 4 files staged and ready for schema parsing.'
                : someSlotsFilled
                ? 'Some files staged. Ready to run partial or complete ingest.'
                : 'Select files or click "Pre-populate Demo CSVs" to begin.'}
            </div>

            <button
              type="button"
              disabled={!someSlotsFilled}
              onClick={handleStartImport}
              className="cp-btn-primary"
            >
              Initiate Roster Parsing Pipeline →
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: In-Flight Job Status Pipeline */}
      {stage === 'job_status' && (
        <div className="cp-panel border border-border-strong bg-surface p-8 shadow-hard space-y-8">
          <div className="border-b border-border-soft pb-4">
            <span className="cp-eyebrow">Ingestion Pipeline Monitor</span>
            <h3 className="cp-h3 mt-1">Import Job In Progress</h3>
            <p className="cp-caption text-muted">Transaction ID: {jobId || 'Allocating Job ID...'}</p>
          </div>

          {/* Pipeline Monitor Display */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`p-4 border ${jobStatus === 'pending' ? 'border-border-strong bg-surface-sunken' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="cp-eyebrow">Schema Check</span>
                {jobStatus !== 'pending' && <span className="text-xs font-bold text-primary">✓</span>}
              </div>
              <strong className="text-xs uppercase tracking-wider block">File Validation</strong>
              <span className="cp-caption text-muted">Header structure verification</span>
            </div>

            <div className={`p-4 border ${jobStatus === 'processing' ? 'border-border-strong bg-surface-sunken' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="cp-eyebrow">Cross Reference</span>
                {jobStatus === 'done' && <span className="text-xs font-bold text-primary">✓</span>}
              </div>
              <strong className="text-xs uppercase tracking-wider block">Relational Cross-Check</strong>
              <span className="cp-caption text-muted">Enrollments & Course FK check</span>
            </div>

            <div className={`p-4 border ${jobStatus === 'done' ? 'border-border-strong bg-surface-sunken' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="cp-eyebrow">Summary Compile</span>
                {jobStatus === 'done' && <span className="text-xs font-bold text-primary">✓</span>}
              </div>
              <strong className="text-xs uppercase tracking-wider block">Ingestion Summary</strong>
              <span className="cp-caption text-muted">Compiling anomaly matrix</span>
            </div>
          </div>

          {/* Progress Bar (Editorial 7px ink progress) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="uppercase tracking-widest text-muted">Status: {jobStatus.toUpperCase()}</span>
              <span>{jobProgressPercent}%</span>
            </div>
            <div className="cp-progress w-full h-[7px] bg-[#e8e8e3]">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${jobProgressPercent}%` }}
              />
            </div>
          </div>

          <div className="text-center py-2 text-xs text-muted animate-pulse">
            Processing row records against active domain and section constraints...
          </div>
        </div>
      )}

      {/* Stage 3: Review Screen & Error Table with Inline Fix */}
      {stage === 'review' && (
        <div className="space-y-6">
          {/* Summary Stat Grid */}
          <div className="cp-grid-stats">
            <div className="cp-stat">
              <div className="cp-stat-top">
                <span className="cp-icon-box">▣</span>
                <span className="cp-badge is-ink">Total Rows</span>
              </div>
              <span className="cp-stat-label">Evaluated Records</span>
              <span className="cp-stat-value">{jobData?.rowCount || 148}</span>
            </div>

            <div className="cp-stat">
              <div className="cp-stat-top">
                <span className="cp-icon-box">✓</span>
                <span className="cp-badge">Clean</span>
              </div>
              <span className="cp-stat-label">Valid Rows Staged</span>
              <span className="cp-stat-value">{jobData?.successCount || 144}</span>
            </div>

            <div className="cp-stat">
              <div className="cp-stat-top">
                <span className="cp-icon-box">×</span>
                <span className="cp-badge is-outline">{errorsList.length} Flagged</span>
              </div>
              <span className="cp-stat-label">Schema Anomalies</span>
              <span className="cp-stat-value">{errorsList.length}</span>
            </div>

            <div className="cp-stat">
              <div className="cp-stat-top">
                <span className="cp-icon-box">↗</span>
              </div>
              <span className="cp-stat-label">Validation Yield</span>
              <span className="cp-stat-value is-sm">
                {Math.round(((jobData?.successCount || 144) / (jobData?.rowCount || 148)) * 100)}%
              </span>
            </div>
          </div>

          {/* Anomaly Table */}
          <div className="cp-panel border border-border bg-surface p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <span className="cp-eyebrow">Anomaly Correction Hub</span>
                <h3 className="cp-h3 mt-1">Per-Row Ingestion Exceptions</h3>
                <p className="cp-lead text-secondary text-xs mt-1">
                  Correct values directly inline to verify against validation schemas before committing the roster.
                </p>
              </div>
              <div className="text-xs">
                {errorsList.length === 0 ? (
                  <span className="cp-badge is-ink">ALL ANOMALIES RESOLVED</span>
                ) : (
                  <span className="cp-badge is-outline">{errorsList.length} UNRESOLVED ROWS</span>
                )}
              </div>
            </div>

            {errorsList.length === 0 ? (
              <div className="p-8 border border-border-strong bg-surface-sunken text-center space-y-2">
                <div className="text-2xl font-black">✓ 100% CLEAN ROSTER</div>
                <p className="text-xs text-secondary">
                  All rows have been successfully validated. You may now confirm and persist the institutional roster.
                </p>
              </div>
            ) : (
              <div className="cp-table-wrap overflow-x-auto">
                <table className="cp-table w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border-strong bg-surface-sunken text-[10px] uppercase font-black tracking-wider">
                      <th className="p-3">Row #</th>
                      <th className="p-3">Target Field</th>
                      <th className="p-3">Detected Anomaly</th>
                      <th className="p-3">Inline Fix & Schema Re-Check</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorsList.map((err, idx) => {
                      const currentVal =
                        inlineEdits[idx] !== undefined
                          ? inlineEdits[idx]
                          : err.suggestedValue || err.value;
                      const statusObj = fixStatus[idx];

                      return (
                        <tr key={`${err.row}-${err.field}`} className="border-b border-border-faint hover:bg-surface-hover">
                          <td className="p-3 font-mono font-bold text-xs">
                            Row {err.row}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <span className="cp-badge is-outline">{err.field}</span>
                          </td>
                          <td className="p-3 text-xs max-w-[280px]">
                            <div className="font-semibold text-primary">{err.message}</div>
                            <div className="text-muted font-mono text-[10px] mt-0.5">
                              Current: &quot;{err.value || '[EMPTY]'}&quot;
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={currentVal}
                                onChange={(e) => handleInlineChange(idx, e.target.value)}
                                className="cp-input text-xs py-1 px-2.5 h-[34px] w-full max-w-[260px] font-mono"
                                placeholder="Enter valid replacement..."
                              />
                            </div>
                            {statusObj && (
                              <div
                                className={`text-[10px] mt-1 font-bold ${
                                  statusObj.resolved ? 'text-primary' : 'text-secondary'
                                }`}
                              >
                                {statusObj.message}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              disabled={statusObj?.loading}
                              onClick={() => handleFixAndRecheck(idx, err)}
                              className="cp-btn-secondary text-xs py-1 px-3 h-[34px]"
                            >
                              {statusObj?.loading ? 'Checking...' : 'Fix & Re-Check'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Error Acknowledgment & Confirmation Gating */}
            <div className="border-t border-border pt-6 space-y-4">
              {errorsList.length > 0 && (
                <div className="p-4 border border-border-strong bg-surface-sunken flex items-start gap-3">
                  <input
                    id="ack-errors"
                    type="checkbox"
                    checked={errorsAcknowledged}
                    onChange={(e) => setErrorsAcknowledged(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded-none accent-ink cursor-pointer"
                  />
                  <label htmlFor="ack-errors" className="text-xs text-primary font-semibold cursor-pointer">
                    I acknowledge that <strong>{errorsList.length} rows</strong> contain validation exceptions and will be quarantined for manual remediation. Proceed with importing the remaining <strong>{jobData?.successCount || 144} verified records</strong>.
                  </label>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStage('upload')}
                  className="cp-btn-secondary text-xs"
                >
                  ← Staging Slots
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={errorsList.length > 0 && !errorsAcknowledged}
                    onClick={handleConfirmImport}
                    className="cp-btn-primary"
                  >
                    {isConfirming
                      ? 'Committing Records...'
                      : `Confirm & Commit ${jobData?.successCount || 144} Records →`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage 4: Confirmed State */}
      {stage === 'confirmed' && (
        <div className="cp-panel border border-border-strong bg-surface p-8 shadow-hard-lg space-y-6">
          <div className="flex items-center gap-3 border-b border-border-soft pb-4">
            <span className="cp-badge is-ink">TRANSACTION COMMITTED</span>
            <span className="cp-caption text-muted">Ref: {jobId || 'REC-101'}</span>
          </div>

          <div>
            <span className="cp-eyebrow">Institutional Roster Provisioned</span>
            <h3 className="cp-display text-3xl font-black mt-1">Academic Roster Online</h3>
            <p className="cp-lead text-secondary text-sm mt-2">
              Successfully enrolled <strong>{confirmResult?.importedCount || 144} student and course associations</strong> into the ClassPulse local ledger.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border-soft">
            <div className="p-4 border border-border-soft bg-surface-sunken">
              <span className="cp-eyebrow">Timestamp</span>
              <div className="text-xs font-bold font-mono mt-1 text-primary">
                {confirmResult?.confirmedAt || new Date().toISOString()}
              </div>
            </div>
            <div className="p-4 border border-border-soft bg-surface-sunken">
              <span className="cp-eyebrow">Enrolled Records</span>
              <div className="text-lg font-black mt-1 text-primary">
                {confirmResult?.importedCount || 144} Records
              </div>
            </div>
            <div className="p-4 border border-border-soft bg-surface-sunken">
              <span className="cp-eyebrow">Next Milestone</span>
              <div className="text-xs font-bold mt-1 text-primary">
                Course Catalog & Syllabus Parsing
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => {
                setStage('upload');
                setErrorsAcknowledged(false);
              }}
              className="cp-btn-secondary text-xs"
            >
              Upload Additional Batches
            </button>

            {onProceedToCourses && (
              <button
                type="button"
                onClick={onProceedToCourses}
                className="cp-btn-primary"
              >
                Proceed to Course & Syllabus List →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
