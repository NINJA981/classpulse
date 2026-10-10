'use client';

import React, { useEffect, useState } from 'react';
import { BrainCircuit, Check, Mic } from 'lucide-react';
import { request } from '../lib/apiClient';

const keyOf = (o) => `${o.provider}::${o.model}`;

/**
 * Which AI models the pipeline uses — speech-to-text for lecture transcription and the LLM
 * that writes the quizzes. Institution-wide: the worker reads this before every run.
 */
export const ModelSettingsView = () => {
  const [asrOptions, setAsrOptions] = useState([]);
  const [llmOptions, setLlmOptions] = useState([]);
  const [asrChoice, setAsrChoice] = useState('');
  const [llmChoice, setLlmChoice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    request('/admin/settings/models')
      .then(({ settings, options }) => {
        setAsrOptions(options.asr);
        setLlmOptions(options.llm);
        setAsrChoice(`${settings.asrProvider}::${settings.asrModel}`);
        setLlmChoice(`${settings.llmProvider}::${settings.llmModel}`);
      })
      .catch((err) => setError(err?.message || 'Could not load model settings.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const [asrProvider, asrModel] = asrChoice.split('::');
      const [llmProvider, llmModel] = llmChoice.split('::');
      await request('/admin/settings/models', {
        method: 'PATCH',
        body: JSON.stringify({
          asr: { provider: asrProvider, model: asrModel },
          llm: { provider: llmProvider, model: llmModel }
        })
      });
      setSaved(true);
    } catch (err) {
      setError(err?.message || 'Could not save model settings.');
    } finally {
      setSaving(false);
    }
  };

  const selectedAsr = asrOptions.find((o) => keyOf(o) === asrChoice);
  const selectedLlm = llmOptions.find((o) => keyOf(o) === llmChoice);

  return (
    <div className="space-y-4 select-none">
      <section className="p-3.5 px-4 bg-surface border border-border">
        <p className="cp-label uppercase text-[9px] font-black tracking-wider text-muted mb-1">
          Pipeline Configuration
        </p>
        <h2 className="text-lg font-black text-primary">AI Model Settings</h2>
        <p className="text-xs text-muted mt-1">
          Applies institution-wide to every new transcription and quiz-generation run.
        </p>
      </section>

      {error && (
        <section className="p-3.5 px-4 border border-red-600 text-red-700 text-xs font-bold bg-surface">
          {error}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="p-4 bg-surface border border-border space-y-3">
          <div className="flex items-center gap-2">
            <Mic size={15} />
            <span className="cp-label uppercase text-[9px] font-black tracking-wider text-muted">
              Speech-to-Text (Transcription)
            </span>
          </div>
          <select
            className="cp-select text-xs py-1 px-3 h-8 font-bold text-primary w-full"
            value={asrChoice}
            onChange={(e) => setAsrChoice(e.target.value)}
            disabled={loading || saving}
          >
            {loading && <option value="">Loading…</option>}
            {asrOptions.map((o) => (
              <option key={keyOf(o)} value={keyOf(o)}>
                {o.label} ({o.model})
              </option>
            ))}
          </select>
          {selectedAsr?.note && <p className="text-[11px] text-muted">{selectedAsr.note}</p>}
        </section>

        <section className="p-4 bg-surface border border-border space-y-3">
          <div className="flex items-center gap-2">
            <BrainCircuit size={15} />
            <span className="cp-label uppercase text-[9px] font-black tracking-wider text-muted">
              Question Generation (LLM)
            </span>
          </div>
          <select
            className="cp-select text-xs py-1 px-3 h-8 font-bold text-primary w-full"
            value={llmChoice}
            onChange={(e) => setLlmChoice(e.target.value)}
            disabled={loading || saving}
          >
            {loading && <option value="">Loading…</option>}
            {llmOptions.map((o) => (
              <option key={keyOf(o)} value={keyOf(o)}>
                {o.label} ({o.model})
              </option>
            ))}
          </select>
          {selectedLlm?.note && <p className="text-[11px] text-muted">{selectedLlm.note}</p>}
        </section>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cp-badge is-ink font-bold text-xs px-4 py-2 cursor-pointer disabled:opacity-50"
          onClick={save}
          disabled={loading || saving || !asrChoice || !llmChoice}
        >
          {saving ? 'Saving…' : 'Save Model Settings'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Check size={13} /> Saved — next run uses these models.
          </span>
        )}
      </div>
    </div>
  );
};
