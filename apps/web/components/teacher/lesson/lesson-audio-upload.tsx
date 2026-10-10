'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import type { LessonDetail } from '@classpulse/shared';
import { Button, Card, CardBody, CardHeader, InlineError, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { AudioFileField, useAudioUpload } from '@/components/teacher/audio-upload';
import { lessonKey } from './use-lesson';

/** For a lesson without audio: upload the class recording, then queue generation. */
export function LessonAudioUpload({ lesson }: { lesson: LessonDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { upload, abort, uploading, progress } = useAudioUpload();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [starting, setStarting] = useState(false);

  async function submit() {
    if (!file) return;
    setError(null);
    try {
      const updated = await upload(lesson.id, file);
      qc.setQueryData(lessonKey(lesson.id), updated);
      setStarting(true);
      try {
        await api.post<{ jobId: string }>(`/lessons/${lesson.id}/generate`, lesson.questions.length ? { confirmRegenerate: true } : {});
        toast('Audio uploaded. Generating the transcript and quiz…');
      } catch (genErr) {
        toast(`Audio uploaded, but generation could not start: ${errorMessage(genErr)}`, 'error');
      }
      qc.invalidateQueries({ queryKey: lessonKey(lesson.id) });
    } catch (err) {
      setError(err);
    } finally {
      setStarting(false);
    }
  }

  return (
    <Card>
      <CardHeader eyebrow="Audio" title="Upload the class recording" />
      <CardBody className="space-y-4">
        <p className="text-sm text-muted">This lesson has no audio yet. Upload a recording to transcribe it and generate the quiz.</p>
        <AudioFileField file={file} onChange={setFile} progress={progress} disabled={uploading || starting} />
        <InlineError error={error} />
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Upload className="size-4" aria-hidden />}
            loading={uploading || starting}
            disabled={!file}
            onClick={submit}
          >
            Upload and generate quiz
          </Button>
          {uploading && (
            <Button variant="secondary" onClick={abort}>
              Cancel upload
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
