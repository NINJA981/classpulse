'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  type CreateLessonInput,
  type Language,
  type LessonDetail,
  type Section,
} from '@classiq/shared';
import { Button, Card, CardBody, CardHeader, Field, InlineError, Input, Select, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { AudioFileField, useAudioUpload } from '@/components/teacher/audio-upload';

type Phase = 'idle' | 'creating' | 'uploading';

/** Create a lesson, upload its audio with progress (the API queues transcription), open the lesson. */
export function UploadForm({ section }: { section: Section }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { upload, abort, progress } = useAudioUpload();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(section.subject ?? '');
  const [language, setLanguage] = useState<Language>('en-IN');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<unknown>(null);
  /** Kept after creation so a failed upload can be retried without creating a duplicate lesson. */
  const [lesson, setLesson] = useState<LessonDetail | null>(null);

  const fe = error instanceof ApiError ? error.fieldErrors : {};
  const busy = phase !== 'idle';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    try {
      let current = lesson;
      if (!current) {
        setPhase('creating');
        const input: CreateLessonInput = { title: title.trim(), subject: subject.trim(), sectionId: section.id, language };
        current = await api.post<LessonDetail>('/lessons', input);
        setLesson(current);
      }
      setPhase('uploading');
      await upload(current.id, file);
      toast('Audio uploaded. Transcribing the recording…');
      qc.invalidateQueries({ queryKey: ['lessons'] });
      qc.invalidateQueries({ queryKey: ['teacher', 'dashboard'] });
      router.push(`/teacher/lessons/${current.id}`);
    } catch (err) {
      setError(err);
      setPhase('idle');
    }
  }

  return (
    <Card>
      <CardHeader eyebrow="Step 2" title="Upload a recording of your class" />
      <CardBody>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Lesson title" required error={fe.title} className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={title}
                maxLength={200}
                disabled={busy || lesson !== null}
                placeholder="e.g. Photosynthesis — light reactions"
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <Field label="Subject" required error={fe.subject}>
            {(p) => (
              <Input
                {...p}
                value={subject}
                maxLength={120}
                disabled={busy || lesson !== null}
                onChange={(e) => setSubject(e.target.value)}
              />
            )}
          </Field>
          <Field label="Language of the class" error={fe.language}>
            {(p) => (
              <Select
                {...p}
                value={language}
                disabled={busy || lesson !== null}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="sm:col-span-2">
            <AudioFileField file={file} onChange={setFile} progress={progress} disabled={busy} />
          </div>
          <div className="space-y-3 sm:col-span-2">
            {lesson && phase === 'idle' && (
              <p className="text-xs text-muted">
                The lesson “{lesson.title}” was created. Retrying uploads the audio to the same lesson.
              </p>
            )}
            <InlineError error={error && Object.keys(fe).length === 0 ? error : null} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                size="lg"
                icon={<Upload className="size-4" aria-hidden />}
                loading={busy}
                disabled={!file || !title.trim() || !subject.trim()}
              >
                {phase === 'creating'
                  ? 'Creating lesson…'
                  : phase === 'uploading'
                    ? 'Uploading…'
                    : lesson
                      ? 'Retry upload'
                      : 'Upload and transcribe'}
              </Button>
              {phase === 'uploading' && (
                <Button variant="secondary" size="lg" onClick={abort}>
                  Cancel upload
                </Button>
              )}
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
