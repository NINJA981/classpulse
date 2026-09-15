import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import SourcePicker from '../components/SourcePicker.jsx';
import { api } from '../lib/api.js';

export default function NewLesson() {
  const navigate = useNavigate();

  // Exactly three fields as strictly requested: title, subject, class
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [className, setClassName] = useState('Grade 10 - Section B');

  const [selectedSource, setSelectedSource] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const classOptions = [
    'Grade 9 - Section A',
    'Grade 9 - Section B',
    'Grade 9 - Section C',
    'Grade 10 - Section A',
    'Grade 10 - Section B',
    'Grade 11 - Section A',
    'Grade 11 - Advanced Physics',
    'Grade 12 - Honors'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Please enter a lesson title.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please enter a subject.');
      return;
    }
    if (!selectedSource || !selectedSource.file) {
      setErrorMessage('Please record audio or upload a source document before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Create the lesson (draft)
      const newLesson = await api.createLesson({
        title: title.trim(),
        subject: subject.trim(),
        className
      });

      // 2. Attach the source file
      await api.attachSource(
        newLesson._id,
        selectedSource.file,
        selectedSource.sourceType
      );

      // 3. Trigger generation job
      await api.generate(newLesson._id);

      // 4. Navigate to /lessons/:id
      navigate(`/lessons/${newLesson._id}`);
    } catch (err) {
      console.error('Failed to create lesson workflow:', err);
      setErrorMessage(err.message || 'An error occurred during submission. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">NEW LESSON WORKFLOW</span>
          <h1>Create Lesson</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Enter lesson metadata and record or upload raw lecture material.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/lessons')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '820px' }}>
        {errorMessage && (
          <div className="card mb-3" style={{ border: '2px solid #111', background: '#faf9f6' }}>
            <span className="eyebrow" style={{ color: '#111' }}>VALIDATION ERROR</span>
            <p style={{ fontWeight: 600, fontSize: '13px' }}>{errorMessage}</p>
          </div>
        )}

        <div className="card card-solid mb-4">
          <span className="eyebrow">LESSON METADATA</span>

          {/* Field 1: Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="lesson-title">
              Lesson Title
            </label>
            <input
              id="lesson-title"
              type="text"
              placeholder="e.g. Mendelian Genetics & Punnett Squares"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            {/* Field 2: Subject */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="lesson-subject">
                Subject
              </label>
              <input
                id="lesson-subject"
                type="text"
                placeholder="e.g. Biology"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Field 3: Class (Dropdown) */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="lesson-class">
                Class
              </label>
              <select
                id="lesson-class"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                disabled={isSubmitting}
              >
                {classOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Mutually Exclusive Source Picker */}
        <div className="mb-4">
          <SourcePicker
            selectedSource={selectedSource}
            onSourceSelected={setSelectedSource}
          />
        </div>

        {/* Submit Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--hairline)', paddingTop: '1.5rem' }}>
          {selectedSource && (
            <span className="text-secondary text-mono" style={{ fontSize: '12px' }}>
              Source attached: {selectedSource.sourceType.toUpperCase()} ({selectedSource.name})
            </span>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isSubmitting || !selectedSource}
          >
            {isSubmitting ? 'Creating & Generating…' : 'Create & Generate Quiz'}
          </button>
        </div>
      </form>
    </Layout>
  );
}
