'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import type { LessonDetail } from '@classiq/shared';
import { Button, Card, CardBody, CardHeader, InlineError, useToast } from '@/components/ui';
import { AudioFileField, useAudioUpload } from '@/components/teacher/audio-upload';
import { lessonKey } from './use-lesson';

/** For a lesson without audio: upload the class recording; the API queues transcription. */
export function LessonAudioUpload({ lesson }: { lesson: LessonDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { upload, abort, uploading, progress } = useAudioUpload();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    if (!file) return;
    setError(null);
    try {
      const updated = await upload(lesson.id, file);
      qc.setQueryData(lessonKey(lesson.id), updated);
      qc.invalidateQueries({ queryKey: lessonKey(lesson.id) });
      qc.invalidateQueries({ queryKey: ['teacher', 'dashboard'] });
      toast('Audio uploaded. Transcribing the recording…');
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Card>
      <CardHeader eyebrow="Audio" title="Upload the class recording" />
      <CardBody className="space-y-4">
        <p className="text-sm text-muted">This lesson has no audio yet. Upload a recording to transcribe it; you then choose the quiz settings here.</p>
        <AudioFileField file={file} onChange={setFile} progress={progress} disabled={uploading} />
        <InlineError error={error} />
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Upload className="size-4" aria-hidden />}
            loading={uploading}
            disabled={!file}
            onClick={submit}
          >
            Upload and transcribe
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
