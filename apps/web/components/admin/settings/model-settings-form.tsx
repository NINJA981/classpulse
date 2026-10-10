'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LlmProvider, SttProvider, type ModelSettings, type ModelSettingsInput } from '@classpulse/shared';
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, Field, InlineError, Input, Select, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, fieldErrorsOf, formLevelError } from '../queries';

const PROVIDER_LABELS: Record<string, string> = { sarvam: 'Sarvam AI', openai: 'OpenAI' };
const FIELDS = ['sttProvider', 'sttModel', 'llmProvider', 'llmModel', 'questionsPerLesson', 'bilingual'];

function KeyStatus({ configured }: { configured: boolean }) {
  return configured ? <Badge tone="success">API key configured</Badge> : <Badge tone="danger">API key missing — set it on the server</Badge>;
}

/** Edits ModelSettings. Mount with a key so it re-initialises from fresh server data. */
export function ModelSettingsForm({ settings }: { settings: ModelSettings }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<ModelSettingsInput>({
    sttProvider: settings.sttProvider,
    sttModel: settings.sttModel,
    llmProvider: settings.llmProvider,
    llmModel: settings.llmModel,
    questionsPerLesson: settings.questionsPerLesson,
    bilingual: settings.bilingual,
  });
  const [count, setCount] = useState(String(settings.questionsPerLesson));
  const [countError, setCountError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: ModelSettingsInput) => api.patch<ModelSettings>('/admin/settings/models', body),
    onSuccess: (saved) => {
      qc.setQueryData(adminKeys.modelSettings, saved);
      toast('AI settings saved');
    },
  });

  const set = <K extends keyof ModelSettingsInput>(k: K, v: ModelSettingsInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      setCountError('Enter a whole number from 1 to 20');
      return;
    }
    setCountError(null);
    save.mutate({ ...form, sttModel: form.sttModel.trim(), llmModel: form.llmModel.trim(), questionsPerLesson: n });
  }

  const fe = fieldErrorsOf(save.error);
  const sttConfigured = settings.configured[form.sttProvider as keyof ModelSettings['configured']] ?? false;
  const llmConfigured = settings.configured[form.llmProvider as keyof ModelSettings['configured']] ?? false;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate aria-label="AI model settings">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Speech to text" title="Transcription" actions={<KeyStatus configured={sttConfigured} />} />
          <CardBody className="flex flex-col gap-4">
            <Field label="STT provider" error={fe.sttProvider}>
              {(p) => (
                <Select {...p} value={form.sttProvider} onChange={(e) => set('sttProvider', e.target.value as ModelSettingsInput['sttProvider'])}>
                  {SttProvider.options.map((o) => (
                    <option key={o} value={o}>
                      {PROVIDER_LABELS[o] ?? o}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="STT model" required error={fe.sttModel} hint="Provider model ID, e.g. saaras:v3">
              {(p) => <Input {...p} value={form.sttModel} onChange={(e) => set('sttModel', e.target.value)} maxLength={80} className="font-mono" />}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Language model" title="Quiz generation" actions={<KeyStatus configured={llmConfigured} />} />
          <CardBody className="flex flex-col gap-4">
            <Field label="LLM provider" error={fe.llmProvider}>
              {(p) => (
                <Select {...p} value={form.llmProvider} onChange={(e) => set('llmProvider', e.target.value as ModelSettingsInput['llmProvider'])}>
                  {LlmProvider.options.map((o) => (
                    <option key={o} value={o}>
                      {PROVIDER_LABELS[o] ?? o}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="LLM model" required error={fe.llmModel} hint="Provider model ID, e.g. gpt-4o-mini">
              {(p) => <Input {...p} value={form.llmModel} onChange={(e) => set('llmModel', e.target.value)} maxLength={80} className="font-mono" />}
            </Field>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Output" title="Generated quizzes" />
        <CardBody className="flex flex-col gap-4">
          <Field label="Questions per lesson" required error={countError ?? fe.questionsPerLesson} hint="1–20 questions generated from each lesson" className="max-w-xs">
            {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={20} value={count} onChange={(e) => setCount(e.target.value)} />}
          </Field>
          <div className="flex flex-col gap-1">
            <Checkbox label="Bilingual questions" checked={form.bilingual} onChange={(e) => set('bilingual', e.target.checked)} />
            <p className="pl-6 text-xs text-muted">Also generate the question, options and explanation in the lesson’s language, alongside English.</p>
          </div>
        </CardBody>
      </Card>

      <InlineError error={formLevelError(save.error, FIELDS)} />
      <div>
        <Button type="submit" loading={save.isPending} disabled={!form.sttModel.trim() || !form.llmModel.trim()}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
