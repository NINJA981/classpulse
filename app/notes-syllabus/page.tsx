'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  UploadCloud,
  FileText,
  CheckCircle,
  Clock,
  Circle,
  Download,
  Trash2,
  Plus,
  Eye,
  CheckSquare,
  Sparkles
} from 'lucide-react';

interface StudyMaterial {
  id: string;
  title: string;
  subject: string;
  className: string;
  tag: string;
  fileType: 'pdf' | 'pptx' | 'docx' | 'notes';
  sizeFormatted: string;
  uploadedAt: string;
  downloadUrl: string;
}

interface SyllabusTopic {
  id: string;
  title: string;
  hours: number;
  status: 'completed' | 'in_progress' | 'pending';
}

interface SyllabusUnit {
  id: string;
  unitNumber: number;
  unitTitle: string;
  topics: SyllabusTopic[];
}

export default function NotesSyllabusPage() {
  const [activeTab, setActiveTab] = useState<'materials' | 'syllabus'>('materials');

  // Materials State
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Biology');
  const [newClass, setNewClass] = useState('Grade 10 - Section B');
  const [newTag, setNewTag] = useState('Lecture Slide');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Syllabus State
  const [selectedCourse, setSelectedCourse] = useState('Grade 10 - Biology');
  const [syllabusData, setSyllabusData] = useState<Record<string, SyllabusUnit[]>>({});

  // Compute Syllabus Progress
  const currentUnits = syllabusData[selectedCourse] || [];
  const allTopics = currentUnits.flatMap((u) => u.topics);
  const completedTopics = allTopics.filter((t) => t.status === 'completed');
  const inProgressTopics = allTopics.filter((t) => t.status === 'in_progress');
  const progressPercent = allTopics.length > 0 ? Math.round((completedTopics.length / allTopics.length) * 100) : 0;

  // Toggle Topic Status
  const toggleTopicStatus = (unitId: string, topicId: string) => {
    setSyllabusData((prev) => {
      const copy = { ...prev };
      const units = copy[selectedCourse].map((unit) => {
        if (unit.id !== unitId) return unit;
        return {
          ...unit,
          topics: unit.topics.map((t) => {
            if (t.id !== topicId) return t;
            const nextStatus: SyllabusTopic['status'] =
              t.status === 'completed'
                ? 'pending'
                : t.status === 'pending'
                ? 'in_progress'
                : 'completed';
            return { ...t, status: nextStatus };
          })
        };
      });
      copy[selectedCourse] = units;
      return copy;
    });
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsUploading(true);
    setTimeout(() => {
      const newEntry: StudyMaterial = {
        id: 'mat_' + Date.now(),
        title: newTitle.trim(),
        subject: newSubject,
        className: newClass,
        tag: newTag,
        fileType: 'pdf',
        sizeFormatted: '3.2 MB',
        uploadedAt: new Date().toISOString().split('T')[0],
        downloadUrl: '#'
      };

      setMaterials([newEntry, ...materials]);
      setNewTitle('');
      setSelectedFileName('');
      setIsUploading(false);
    }, 400);
  };

  const handleDeleteMaterial = (id: string) => {
    setMaterials(materials.filter((m) => m.id !== id));
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">ACADEMIC CONTENT & CURRICULUM TRACKING</span>
          <h1>Notes & Syllabus</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Upload lecture handouts, distribute study materials, and audit real-time syllabus completion progress.
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/lessons/new" className="btn btn-primary">
            + Generate Quiz from Notes
          </Link>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'materials' ? 'active' : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          <UploadCloud size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Lecture Notes & Study Material ({materials.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'syllabus' ? 'active' : ''}`}
          onClick={() => setActiveTab('syllabus')}
        >
          <BookOpen size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Syllabus Viewer & Progress Tracker ({progressPercent}% Done)
        </button>
      </div>

      {activeTab === 'materials' ? (
        /* TAB 1: STUDY MATERIALS & NOTES UPLOADER */
        <div>
          {/* Uploader Card */}
          <div className="card card-solid mb-4">
            <span className="eyebrow">UPLOAD LECTURE MATERIAL</span>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Add Notes, Slides, or Handouts</h2>

            <form onSubmit={handleUploadSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Document Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Chapter 4 Cellular Metabolism Handout"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subject</label>
                  <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)}>
                    <option value="Biology">Biology</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Class Cohort</label>
                  <select value={newClass} onChange={(e) => setNewClass(e.target.value)}>
                    <option value="Grade 10 - Section B">Grade 10 - Section B</option>
                    <option value="Grade 11 - Section A">Grade 11 - Section A</option>
                    <option value="Grade 9 - Section C">Grade 9 - Section C</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Material Type</label>
                  <select value={newTag} onChange={(e) => setNewTag(e.target.value)}>
                    <option value="Lecture Slide">Lecture Slide</option>
                    <option value="Problem Set">Problem Set</option>
                    <option value="Reference Handout">Reference Handout</option>
                    <option value="Lab Manual">Lab Manual</option>
                  </select>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                style={{
                  border: '2px dashed var(--ink)',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: 'var(--surface-alt)',
                  marginBottom: '1.25rem',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedFileName('Cellular_Bio_Ch4_Slides.pdf')}
              >
                <UploadCloud size={28} style={{ margin: '0 auto 8px', color: 'var(--ink)' }} />
                <div style={{ fontWeight: 800, fontSize: '13px' }}>
                  {selectedFileName ? `Selected: ${selectedFileName}` : 'Click to select or drag lecture file here'}
                </div>
                <p className="text-secondary text-mono" style={{ fontSize: '11px', marginTop: '4px' }}>
                  Supports PDF, PPTX, DOCX, Markdown, ZIP (Max 50MB)
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isUploading || !newTitle.trim()}
                >
                  <Plus size={14} />
                  {isUploading ? 'Uploading to Repository…' : 'Publish & Attach to Class'}
                </button>
              </div>
            </form>
          </div>

          {/* Uploaded Materials Repository Table */}
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '38%' }}>Title & Format</th>
                  <th style={{ width: '16%' }}>Subject</th>
                  <th style={{ width: '18%' }}>Class Cohort</th>
                  <th style={{ width: '12%' }}>Date Added</th>
                  <th style={{ width: '16%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    No materials uploaded yet. This screen has no endpoint behind it yet.
                  </div>
                )}
                {materials.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} className="text-secondary" />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{item.title}</div>
                          <div className="text-secondary text-mono" style={{ fontSize: '10px', marginTop: '2px' }}>
                            <span className="timetable-tag" style={{ marginRight: '6px' }}>
                              {item.tag}
                            </span>
                            {item.sizeFormatted}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{item.subject}</td>
                    <td style={{ fontWeight: 500 }}>{item.className}</td>
                    <td className="text-mono text-secondary" style={{ fontSize: '12px' }}>
                      {item.uploadedAt}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          title="Preview Document"
                          onClick={() => alert(`Previewing: ${item.title}`)}
                          style={{ padding: '4px 8px' }}
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          title="Download Document"
                          onClick={() => alert(`Downloading: ${item.title}`)}
                          style={{ padding: '4px 8px' }}
                        >
                          <Download size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          title="Delete"
                          onClick={() => handleDeleteMaterial(item.id)}
                          style={{ padding: '4px 8px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 2: SYLLABUS VIEWER & PROGRESS TRACKER */
        <div>
          {/* Syllabus Header Bar */}
          <div
            className="card card-solid mb-4"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              padding: '1.25rem 1.5rem'
            }}
          >
            <div>
              <span className="eyebrow">COURSE CURRICULUM SELECTOR</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  style={{ fontSize: '15px', fontWeight: 800, padding: '6px 12px' }}
                >
                  <option value="Grade 10 - Biology">Grade 10 - Biology (Core Life Sciences)</option>
                  <option value="Grade 11 - Physics">Grade 11 - Physics (Mechanics & Dynamics)</option>
                </select>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="eyebrow">OVERALL COMPLETION</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                {progressPercent}%
              </div>
              <div className="text-secondary" style={{ fontSize: '11px' }}>
                {completedTopics.length} of {allTopics.length} Topics Mastered
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="syllabus-progress-container" style={{ height: '12px' }}>
            <div className="syllabus-progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>

          {/* Units Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
            {currentUnits.map((unit) => {
              const unitTopics = unit.topics;
              const unitCompleted = unitTopics.filter((t) => t.status === 'completed').length;
              const unitProgress = Math.round((unitCompleted / unitTopics.length) * 100);

              return (
                <div key={unit.id} className="syllabus-unit card card-solid">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <span className="eyebrow">UNIT {unit.unitNumber}</span>
                      <h3 style={{ fontSize: '1.2rem' }}>{unit.unitTitle}</h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="text-mono" style={{ fontWeight: 800, fontSize: '13px' }}>
                        {unitCompleted} / {unitTopics.length} Topics ({unitProgress}%)
                      </span>
                    </div>
                  </div>

                  <div className="syllabus-progress-container" style={{ height: '6px', margin: '6px 0 12px' }}>
                    <div className="syllabus-progress-bar" style={{ width: `${unitProgress}%` }} />
                  </div>

                  {/* Topic Checklist */}
                  <div style={{ border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                    {unitTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="unit-topic-row"
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleTopicStatus(unit.id, topic.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            type="button"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            {topic.status === 'completed' ? (
                              <CheckCircle size={18} style={{ color: 'var(--ink)' }} />
                            ) : topic.status === 'in_progress' ? (
                              <Clock size={18} style={{ color: '#d97706' }} />
                            ) : (
                              <Circle size={18} style={{ color: '#bbb' }} />
                            )}
                          </button>

                          <div>
                            <span
                              style={{
                                fontWeight: topic.status === 'completed' ? 700 : 600,
                                textDecoration: topic.status === 'completed' ? 'line-through' : 'none',
                                color: topic.status === 'completed' ? 'var(--ink-secondary)' : 'var(--ink)'
                              }}
                            >
                              {topic.title}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="text-secondary text-mono" style={{ fontSize: '11px' }}>
                            {topic.hours} hrs
                          </span>
                          <span
                            className="status-pill"
                            style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              textTransform: 'uppercase',
                              background:
                                topic.status === 'completed'
                                  ? 'var(--ink)'
                                  : topic.status === 'in_progress'
                                  ? '#fff3cd'
                                  : '#f0f0f0',
                              color: topic.status === 'completed' ? 'var(--surface)' : '#111',
                              border: '1px solid var(--ink)'
                            }}
                          >
                            {topic.status === 'completed'
                              ? 'Mastered'
                              : topic.status === 'in_progress'
                              ? 'In Progress'
                              : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
