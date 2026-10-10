import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

export const LiveTranscript = () => {
  const { transcripts, detectedTopics } = useClassPulse();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('ALL');
  const [showTamil, setShowTamil] = useState(true);

  const filteredTranscripts = transcripts.filter((item) => {
    const matchesSearch =
      item.tamilText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.englishText.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopic = selectedTopic === 'ALL' || item.topicTag === selectedTopic;
    return matchesSearch && matchesTopic;
  });

  return (
    <div className="cp-panel flex flex-col h-[520px]">
      {/* Component Header */}
      <div className="cp-panel-header flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="cp-icon-box is-lg shrink-0" aria-hidden="true">▤</div>
          <div>
            <span className="cp-eyebrow is-tight">Speech-to-text</span>
            <h3 className="cp-h3 flex items-center gap-2 flex-wrap">
              Live Speech Transcript Stream
              <span className="cp-badge is-outline">
                Tamil-English Bilingual
              </span>
            </h3>
            <p className="cp-caption mt-1">Real-time Speech-to-Text • Audio auto-deleted after transcription</p>
          </div>
        </div>

        {/* Translation Toggle */}
        <button
          onClick={() => setShowTamil(!showTamil)}
          className={`cp-toggle inline-flex items-center gap-1.5 ${showTamil ? 'is-on' : ''}`}
        >
          <span>{showTamil ? 'Bilingual View' : 'English Only'}</span>
        </button>
      </div>

      {/* Search & Topic Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap sm:flex-nowrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            aria-label="Search spoken transcript"
            placeholder="Search spoken transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="cp-input is-sm"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            aria-label="Filter by topic"
            className="cp-select is-sm"
          >
            <option value="ALL">All Topics</option>
            {detectedTopics.map((topic, i) => (
              <option key={i} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transcript Stream List */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredTranscripts.length === 0 ? (
          <div className="cp-empty is-sm h-full">
            <p>No matching transcript snippets found.</p>
          </div>
        ) : (
          <div className="cp-list-bordered">
            {filteredTranscripts.map((t) => (
              <div key={t.id} className="cp-row is-interactive block py-4">
                {/* Entry Metadata Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <span className="cp-row-title">{t.speaker}</span>
                    <span className="cp-caption-2">{t.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="cp-badge is-ink inline-flex items-center gap-1">
                      {t.topicTag}
                    </span>

                    <span className="cp-caption-2 inline-flex items-center gap-1 font-bold">
                      <span aria-hidden="true">✓</span>
                      Audio Deleted
                    </span>
                  </div>
                </div>

                {/* Spoken Tamil-English Text */}
                {showTamil && (
                  <p className="text-body text-ink font-bold leading-relaxed mb-2 bg-surface-sunken border border-line p-2.5">
                    {t.tamilText}
                  </p>
                )}

                {/* Translated English Output */}
                <div className="flex items-start gap-1.5 text-body text-muted-4 leading-relaxed">
                  <span className="text-ink shrink-0" aria-hidden="true">→</span>
                  <p>{t.englishText}</p>
                </div>

                {/* Footer confidence score */}
                <div className="mt-2 cp-caption-2 flex items-center gap-3 uppercase tracking-label">
                  <span>Confidence: {(t.confidence * 100).toFixed(0)}%</span>
                  <span>Noise Filtered: Yes</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
