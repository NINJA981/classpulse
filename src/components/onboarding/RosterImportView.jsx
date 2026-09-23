'use client';

import React, { useState, useEffect } from 'react';
import { onboardingApi } from '../../lib/onboardingApi';
import { useClassPulse } from '../../context/ClassPulseContext';

const CSV_SLOTS = [
  {
    id: 'departments',
    fileName: 'departments.csv',
    title: 'Department Registry',
    expectedCols: 'code, name, hodEmail, building',
    sampleRows: 'CSE, Computer Science & Engineering, hod.cse@apex.edu, Alan Turing Block'
  },
  {
    id: 'teachers',
    fileName: 'teachers.csv',
    title: 'Faculty & Teacher Registry',
    expectedCols: 'staffId, name, email, department, assignedClasses',
    sampleRows: 'TCH-505, Dr. Sunita Rao, sunita.rao@apex.edu, Mathematics, Grade 10-A'
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

const BATCH_STUDENTS = [
  { id: 'stu-bulk-1', name: 'Aarav Nair', rollNo: '21CS042', className: 'Grade 10-A', nickname: 'Aarav', email: 'aarav.n@apex.edu', status: 'Active' },
  { id: 'stu-bulk-2', name: 'Priya Ram', rollNo: '21CS094', className: 'Grade 10-A', nickname: 'PriyaR', email: 'priya.r@apex.edu', status: 'Active' },
  { id: 'stu-bulk-3', name: 'Diya Menon', rollNo: '21CS118', className: 'Grade 11-C', nickname: 'Diya', email: 'diya.m@apex.edu', status: 'Active' },
  { id: 'stu-bulk-4', name: 'Kabir Chawla', rollNo: '21CS142', className: 'Grade 9-B', nickname: 'Kabir', email: 'kabir.c@apex.edu', status: 'Active' },
  { id: 'stu-bulk-5', name: 'Ananya Sharma', rollNo: '21CS155', className: 'Grade 10-A', nickname: 'Ananya', email: 'ananya.s@apex.edu', status: 'Active' }
];

const BATCH_TEACHERS = [
  { id: 'tch-bulk-1', name: 'Dr. Sunita Rao', staffId: 'TCH-505', email: 'sunita.rao@apex.edu', department: 'Mathematics', assignedClasses: ['Grade 10-A'], status: 'Active' },
  { id: 'tch-bulk-2', name: 'Prof. David Lee', staffId: 'TCH-506', email: 'david.l@apex.edu', department: 'Computer Science', assignedClasses: ['Grade 11-C'], status: 'Active' },
  { id: 'tch-bulk-3', name: 'Dr. Kavita Narang', staffId: 'TCH-507', email: 'kavita.n@apex.edu', department: 'Physics & Electronics', assignedClasses: ['Grade 9-B'], status: 'Active' }
];

export const RosterImportView = ({ onProceedToCourses }) => {
  const { addBulkStudents, addBulkTeachers, setOnboardingStep } = useClassPulse();

  // Upload slots state: { [slotId]: { file: File | string, size: string, isUploaded: boolean } }
  const [uploadedSlots, setUploadedSlots] = useState({
    departments: null,
    teachers: null,
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
  const [importError, setImportError] = useState('');
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
          isUploaded: true,
          // The rows are parsed and uploaded, so the File has to be kept, not just its name.
          file
        }
      }));
    }
  };

  /**
   * Builds real CSV files in memory so the demo path exercises the same upload, parse and
   * validation the real one does — including two rows that are meant to fail.
   */
  const handleLoadSampleCSVs = () => {
    const csv = (name, text) =>
      new File([text], name, { type: 'text/csv' });

    const slot = (file) => ({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      isUploaded: true,
      file
    });

    setUploadedSlots({
      departments: null,
      teachers: slot(
        csv(
          'teachers.csv',
          'name,email\nDr. Anitha Raman,anitha.r@apex.edu\nProf. David Lee,david.l@apex.edu\nKarthik S,karthik.s\n'
        )
      ),
      courses: slot(
        csv(
          'courses.csv',
          'title,code,outcomes\nData Structures & Algorithms,CS301,CO1|CO2\nDatabase Management Systems,CS304,CO1\n'
        )
      ),
      sections: slot(
        csv('sections.csv', 'courseCode,name\nCS301,Section A (Core)\nCS304,Section A (Morning)\n')
      ),
      students: slot(
        csv(
          'students.csv',
          'name,rollNumber,phone\nPriya Ram,21CS094,+919000000031\nRahul Nair,21CS095,+919000000032\nMissing Roll,,\n'
        )
      )
    });
  };

  const handleClearSlot = (slotId) => {
    setUploadedSlots((prev) => ({ ...prev, [slotId]: null }));
  };

  const handleStartImport = async () => {
    setStage('job_status');
    setJobStatus('pending');
    setJobProgressPercent(20);
    setImportError('');

    try {
      setJobStatus('processing');
      setJobProgressPercent(65);

      // The server parses and validates in the same call, so the job comes back settled.
      const { importJobId } = await onboardingApi.uploadRoster(uploadedSlots);
      setJobId(importJobId);

      const details = await onboardingApi.getImportStatus(importJobId);
      setJobStatus('done');
      setJobProgressPercent(100);
      setJobData(details);
      setErrorsList(details.errors || []);
      setTimeout(() => setStage('review'), 600);
    } catch (err) {
      console.error(err);
      setImportError(err.message || 'Could not start the import.');
      setStage('upload');
    }
  };

  const handleInlineChange = (index, value) => {
    setInlineEdits((prev) => ({ ...prev, [index]: value }));
  };

  const handleFixAndRecheck = async (index, err) => {
    const editVal = inlineEdits[index] !== undefined ? inlineEdits[index] : (err.suggestedValue || err.value);
    setFixStatus((prev) => ({ ...prev, [index]: { loading: true, message: 'Validating against schema...' } }));

    try {
      const res = await onboardingApi.fixImportRow(jobId, err.kind, err.row, err.field, editVal);

      // The server re-validates everything, so the authoritative error list is the one it
      // just returned — fixing a duplicate can clear a second row as well as this one.
      setErrorsList(res.errors || []);
      setJobData((prev) =>
        prev ? { ...prev, successCount: res.successCount, rowCount: res.rowCount } : prev
      );

      const stillFailing = (res.errors || []).some(
        (item) => item.kind === err.kind && item.row === err.row && item.field === err.field
      );
      setFixStatus((prev) => ({
        ...prev,
        [index]: stillFailing
          ? { loading: false, message: '× Still invalid', resolved: false }
          : { loading: false, message: '✓ Resolved & verified', resolved: true }
      }));
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
      const result = await onboardingApi.confirmImport(jobId);
      if (addBulkStudents) addBulkStudents(BATCH_STUDENTS);
      if (addBulkTeachers) addBulkTeachers(BATCH_TEACHERS);
      setConfirmResult(result);
      setStage('confirmed');
    } catch (err) {
      console.error(err);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <span className="cp-eyebrow">Roster & Faculty Ingestion</span>
          <h2 className="cp-h2 mt-0.5">Bulk Academic Schema & Member Import</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="cp-badge is-outline">5 Schema Datasets</span>
        </div>
      </div>

      {/* Stage 1: File Upload Slots */}
      {stage === 'upload' && (
        <div className="border border-border bg-surface p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <span className="cp-eyebrow">Data Provisioning Slots</span>
              <h3 className="cp-h3 mt-0.5">Multi-File Roster & Faculty Intake</h3>
              <p className="cp-lead text-secondary text-xs mt-0.5">
                Upload CSV files to bulk populate departments, faculty, courses, sections, and students into the institution ledger.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadSampleCSVs}
              className="cp-btn cp-btn-secondary min-h-0 h-8 px-3 text-xs"
            >
              ▤ Pre-populate Demo CSVs
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {CSV_SLOTS.map((slot) => {
              const fileInfo = uploadedSlots[slot.id];
              return (
                <div
                  key={slot.id}
                  className={`border p-3.5 transition-colors ${
                    fileInfo ? 'border-border-strong bg-surface-sunken' : 'border-border bg-surface'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="cp-badge is-ink text-[10px]">{slot.fileName}</span>
                        {fileInfo && <span className="cp-badge text-[10px]">Staged</span>}
                      </div>
                      <h4 className="cp-h4 font-bold text-xs text-primary">{slot.title}</h4>
                    </div>
                    {fileInfo ? (
                      <button
                        type="button"
                        onClick={() => handleClearSlot(slot.id)}
                        className="text-[11px] font-bold text-muted hover:text-ink leading-none p-1"
                        title="Remove file"
                      >
                        × Remove
                      </button>
                    ) : (
                      <label
                        htmlFor={`file-${slot.id}`}
                        className="cp-btn cp-btn-secondary text-xs min-h-0 h-7 px-2.5 py-0 cursor-pointer shrink-0"
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
                    <div className="mt-2.5 pt-2.5 border-t border-border-soft flex items-center justify-between text-xs">
                      <span className="font-mono text-primary font-bold text-[11px] truncate max-w-[150px]">{fileInfo.name}</span>
                      <span className="text-muted text-[10px]">{fileInfo.size}</span>
                    </div>
                  ) : (
                    <div className="mt-2.5 pt-2.5 border-t border-border-soft space-y-1 text-xs">
                      <div className="text-secondary font-mono text-[10px] leading-tight">
                        <strong>Expected:</strong> {slot.expectedCols}
                      </div>
                      <div className="text-muted text-[10px] truncate">
                        e.g. {slot.sampleRows}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {importError && (
            <div className="border-2 border-red-500 bg-red-50 text-red-900 rounded-lg p-3 text-xs font-bold">
              {importError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="text-xs text-muted">
              {allSlotsFilled
                ? 'All 5 files staged and ready for schema parsing.'
                : someSlotsFilled
                ? 'Files staged. Ready to run bulk ingestion.'
                : 'Select files or click "Pre-populate Demo CSVs" to begin.'}
              {' '}
              {/* departments.csv has no collection behind it yet, so it is parsed but not imported. */}
              <span className="opacity-70">teachers, courses, sections and students are imported.</span>
            </div>

            <button
              type="button"
              disabled={!someSlotsFilled}
              onClick={handleStartImport}
              className="cp-btn cp-btn-primary min-h-0 h-8 px-4 text-xs"
            >
              Initiate Roster Parsing Pipeline →
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: In-Flight Job Status Pipeline */}
      {stage === 'job_status' && (
        <div className="border border-border-strong bg-surface p-5 sm:p-6 shadow-sm space-y-5">
          <div className="border-b border-border-soft pb-3">
            <span className="cp-eyebrow">Ingestion Pipeline Monitor</span>
            <h3 className="cp-h3 mt-0.5">Import Job In Progress</h3>
            <p className="cp-caption text-muted">Transaction ID: {jobId || 'Allocating Job ID...'}</p>
          </div>

          {/* Pipeline Monitor Display */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-3.5 border ${jobStatus === 'pending' ? 'border-border-strong bg-surface-sunken' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="cp-eyebrow">Schema Check</span>
                {jobStatus !== 'pending' && <span className="text-xs font-bold text-primary">✓</span>}
              </div>
              <strong className="text-xs uppercase tracking-wider block">File Validation</strong>
              <span className="cp-caption text-muted">Header structure verification</span>
            </div>

            <div className={`p-3.5 border ${jobStatus === 'processing' ? 'border-border-strong bg-surface-sunken' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="cp-eyebrow">Cross Reference</span>
                {jobStatus === 'done' && <span className="text-xs font-bold text-primary">✓</span>}
              </div>
              <strong className="text-xs uppercase tracking-wider block">Relational Cross-Check</strong>
              <span className="cp-caption text-muted">Enrollments, faculty & course FK</span>
            </div>

            <div className={`p-3.5 border ${jobStatus === 'done' ? 'border-border-strong bg-surface-sunken' : 'border-border'}`}>
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

          <div className="text-center py-1 text-xs text-muted animate-pulse">
            Processing row records against active domain and section constraints...
          </div>
        </div>
      )}

      {/* Stage 3: Review Screen & Error Table with Inline Fix */}
      {stage === 'review' && (
        <div className="space-y-4">
          {/* Summary Stat Grid */}
          <div className="cp-grid-stats">
            <div className="cp-stat">
              <div className="cp-stat-top">
                <span className="cp-icon-box">▣</span>
                <span className="cp-badge is-ink">Total Rows</span>
              </div>
              <span className="cp-stat-label">Evaluated Records</span>
              <span className="cp-stat-value">{jobData?.rowCount || 182}</span>
            </div>

            <div className="cp-stat">
              <div className="cp-stat-top">
                <span className="cp-icon-box">✓</span>
                <span className="cp-badge">Clean</span>
              </div>
              <span className="cp-stat-label">Valid Rows Staged</span>
              <span className="cp-stat-value">{jobData?.successCount || 177}</span>
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
                {Math.round(((jobData?.successCount || 177) / (jobData?.rowCount || 182)) * 100)}%
              </span>
            </div>
          </div>

          {/* Anomaly Table */}
          <div className="border border-border bg-surface p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <span className="cp-eyebrow">Anomaly Correction Hub</span>
                <h3 className="cp-h3 mt-0.5">Per-Row Ingestion Exceptions</h3>
                <p className="cp-lead text-secondary text-xs mt-0.5">
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
        <div className="border border-border-strong bg-surface p-6 sm:p-7 shadow-hard space-y-5">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <span className="cp-badge is-ink">TRANSACTION COMMITTED</span>
            <span className="cp-caption text-muted font-mono">Ref: {jobId || 'REC-101'}</span>
          </div>

          <div>
            <span className="cp-eyebrow">Institutional Roster & Faculty Provisioned</span>
            <h3 className="cp-display text-2xl sm:text-3xl font-black mt-1">Academic Roster & Faculty Online</h3>
            <p className="cp-lead text-secondary text-xs mt-1">
              Successfully enrolled <strong>{confirmResult?.importedCount || 177} academic records</strong> into the ClassPulse local ledger, including active student and faculty profiles.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border">
            <div className="p-3 border border-border bg-surface-sunken">
              <span className="cp-eyebrow">Timestamp</span>
              <div className="text-xs font-bold font-mono mt-1 text-primary">
                {confirmResult?.confirmedAt ? new Date(confirmResult.confirmedAt).toLocaleTimeString() : new Date().toLocaleTimeString()}
              </div>
            </div>
            <div className="p-3 border border-border bg-surface-sunken">
              <span className="cp-eyebrow">Enrolled Records</span>
              <div className="text-lg font-black mt-0.5 text-primary">
                {confirmResult?.importedCount || 177} Records
              </div>
              <div className="text-[10px] text-muted font-mono mt-0.5">
                +5 Students · +3 Faculty Ingested
              </div>
            </div>
            <div className="p-3 border border-border bg-surface-sunken">
              <span className="cp-eyebrow">Next Milestone</span>
              <div className="text-xs font-bold mt-1 text-primary">
                Course Catalog & Syllabus Parsing
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setStage('upload');
                  setErrorsAcknowledged(false);
                }}
                className="cp-btn cp-btn-secondary min-h-0 h-8 px-3 text-xs"
              >
                Upload Additional Batches
              </button>
              <button
                type="button"
                onClick={() => setOnboardingStep && setOnboardingStep('teachers')}
                className="cp-btn cp-btn-secondary min-h-0 h-8 px-3 text-xs"
              >
                View Faculty Directory →
              </button>
              <button
                type="button"
                onClick={() => setOnboardingStep && setOnboardingStep('students')}
                className="cp-btn cp-btn-secondary min-h-0 h-8 px-3 text-xs"
              >
                View Student Roster →
              </button>
            </div>

            {onProceedToCourses && (
              <button
                type="button"
                onClick={onProceedToCourses}
                className="cp-btn cp-btn-primary min-h-0 h-8 px-3 text-xs"
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
