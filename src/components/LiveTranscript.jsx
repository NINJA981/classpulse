import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  MessageSquareText,
  Search,
  Languages,
  Tag,
  ShieldCheck,
  Sparkles,
  Filter
} from 'lucide-react';

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
    <div className="glass-card rounded-2xl p-5 border border-slate-200 flex flex-col h-[520px]">
      {/* Component Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Live Speech Transcript Stream
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                Tamil-English Bilingual
              </span>
            </h3>
            <p className="text-xs text-slate-500">Real-time Speech-to-Text • Audio auto-deleted after transcription</p>
          </div>
        </div>

        {/* Translation Toggle */}
        <button
          onClick={() => setShowTamil(!showTamil)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition cursor-pointer shadow-xs"
        >
          <Languages className="w-3.5 h-3.5 text-indigo-600" />
          <span>{showTamil ? 'Bilingual View' : 'English Only'}</span>
        </button>
      </div>

      {/* Search & Topic Filters */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search spoken transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-input pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white text-slate-900 border border-slate-300 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="glass-input px-3 py-1.5 rounded-xl text-xs bg-white text-slate-800 border border-slate-300 cursor-pointer font-medium"
          >
            <option value="ALL" className="bg-white text-slate-900">All Topics</option>
            {detectedTopics.map((topic, i) => (
              <option key={i} value={topic} className="bg-white text-slate-900">
                {topic}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transcript Stream List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredTranscripts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
            No matching transcript snippets found.
          </div>
        ) : (
          filteredTranscripts.map((t) => (
            <div
              key={t.id}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 transition glass-card-hover"
            >
              {/* Entry Metadata Header */}
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-700">{t.speaker}</span>
                  <span className="text-[11px] font-mono text-slate-500">{t.timestamp}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" />
                    {t.topicTag}
                  </span>

                  <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Audio Deleted
                  </span>
                </div>
              </div>

              {/* Spoken Tamil-English Text */}
              {showTamil && (
                <p className="text-xs text-slate-900 font-medium leading-relaxed mb-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                  {t.tamilText}
                </p>
              )}

              {/* Translated English Output */}
              <div className="flex items-start gap-1.5 text-xs text-slate-700 leading-relaxed font-normal">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p>{t.englishText}</p>
              </div>

              {/* Footer confidence score */}
              <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-3 font-mono">
                <span>Confidence: {(t.confidence * 100).toFixed(0)}%</span>
                <span>Noise Filtered: Yes</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
