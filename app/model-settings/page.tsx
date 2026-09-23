'use client';

import React, { useEffect, useState } from 'react';
import { Check, Cpu, Mic } from 'lucide-react';
import { api } from '../../lib/api';

interface ModelOption {
  provider: string;
  model: string;
  label: string;
  note?: string;
}

const keyOf = (o: { provider: string; model: string }) => `${o.provider}::${o.model}`;

export default function ModelSettingsPage() {
  const [asrOptions, setAsrOptions] = useState<ModelOption[]>([]);
  const [llmOptions, setLlmOptions] = useState<ModelOption[]>([]);
  const [asrChoice, setAsrChoice] = useState('');
  const [llmChoice, setLlmChoice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    api
      .getModelSettings()
      .then(({ settings, options }) => {
        setAsrOptions(options.asr);
        setLlmOptions(options.llm);
        setAsrChoice(`${settings.asrProvider}::${settings.asrModel}`);
        setLlmChoice(`${settings.llmProvider}::${settings.llmModel}`);
      })
      .catch((err: any) => setErrorMessage(err?.message || 'Could not load model settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage('');
    setSavedAt(null);
    try {
      const [asrProvider, asrModel] = asrChoice.split('::');
      const [llmProvider, llmModel] = llmChoice.split('::');
      await api.updateModelSettings({
        asr: { provider: asrProvider, model: asrModel },
        llm: { provider: llmProvider, model: llmModel }
      });
      setSavedAt(Date.now());
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not save model settings.');
    } finally {
      setSaving(false);
    }
  };

  const selectedAsr = asrOptions.find((o) => keyOf(o) === asrChoice);
  const selectedLlm = llmOptions.find((o) => keyOf(o) === llmChoice);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">PIPELINE CONFIGURATION</span>
          <h1>AI Model Settings</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Choose which models transcribe lectures and write the quizzes. Applies to every
            new generation run, for the whole institution.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="card mb-3" style={{ border: '2px solid #c93c1c', color: '#c93c1c', fontWeight: 700, fontSize: '13px' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', maxWidth: '980px' }}>
        <div className="card card-solid">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <Mic size={16} />
            <span className="eyebrow" style={{ margin: 0 }}>SPEECH-TO-TEXT (TRANSCRIPTION)</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="asr-model">Transcription model</label>
            <select
              id="asr-model"
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
          </div>
          {selectedAsr?.note && (
            <p className="text-secondary" style={{ fontSize: '12px' }}>{selectedAsr.note}</p>
          )}
        </div>

        <div className="card card-solid">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <Cpu size={16} />
            <span className="eyebrow" style={{ margin: 0 }}>QUESTION GENERATION (LLM)</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="llm-model">Question model</label>
            <select
              id="llm-model"
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
          </div>
          {selectedLlm?.note && (
            <p className="text-secondary" style={{ fontSize: '12px' }}>{selectedLlm.note}</p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={loading || saving || !asrChoice || !llmChoice}
        >
          {saving ? 'Saving…' : 'Save Model Settings'}
        </button>
        {savedAt && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px' }}>
            <Check size={14} /> Saved — next generation run uses these models.
          </span>
        )}
      </div>
    </div>
  );
}
