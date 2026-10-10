'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Cpu, Mic, Upload } from 'lucide-react';
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  type Device,
  type Language,
  type RecordingSession,
  type Section,
  type StartRecordingInput,
} from '@classpulse/shared';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  Input,
  LoadingBlock,
  Select,
} from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { DeviceList } from './device-list';

/** Step 2 of "Record a class": device health + lesson details + start. */
export function RecordSetup({
  section,
  onStarted,
  onUseUpload,
}: {
  section: Section;
  onStarted: (session: RecordingSession) => void;
  onUseUpload: () => void;
}) {
  const devicesQ = useQuery({
    queryKey: ['recordings', 'devices', section.id],
    queryFn: () => api.get<Device[]>('/recordings/devices', { sectionId: section.id }),
    refetchInterval: 15_000,
  });

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(section.subject ?? '');
  const [language, setLanguage] = useState<Language>('en-IN');
  const [pickedId, setPickedId] = useState<string | null>(null);

  const devices = devicesQ.data ?? [];
  const online = devices.filter((d) => d.status === 'online');
  const selectedId = pickedId && online.some((d) => d.id === pickedId) ? pickedId : (online[0]?.id ?? null);

  const start = useMutation({
    mutationFn: (input: StartRecordingInput) => api.post<RecordingSession>('/recordings', input),
    onSuccess: onStarted,
  });
  const fe = start.error instanceof ApiError ? start.error.fieldErrors : {};

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    start.mutate({ sectionId: section.id, title: title.trim(), subject: subject.trim(), language, deviceId: selectedId });
  }

  return (
    <Card>
      <CardHeader eyebrow="Step 2" title="Classroom device & lesson details" />
      <CardBody className="space-y-6">
        {devicesQ.isPending ? (
          <LoadingBlock label="Checking classroom devices…" />
        ) : devicesQ.isError ? (
          <ErrorState error={devicesQ.error} onRetry={() => devicesQ.refetch()} />
        ) : devices.length === 0 ? (
          <EmptyState
            icon={<Cpu className="size-8" aria-hidden />}
            title="No classroom device for this section"
            description={
              section.room
                ? `There is no recording device installed in ${section.room.name}. You can record on your phone or laptop and upload the audio file instead.`
                : 'This section has no classroom assigned, so there is no recording device. You can record on your phone or laptop and upload the audio file instead.'
            }
            action={
              <Button variant="secondary" icon={<Upload className="size-4" aria-hidden />} onClick={onUseUpload}>
                Upload an audio file instead
              </Button>
            }
          />
        ) : (
          <>
            <DeviceList devices={devices} selectedId={selectedId} onSelect={setPickedId} />
            {online.length === 0 && (
              <div role="status" className="border border-warning/40 bg-warning-soft p-3 text-sm text-warning rounded-control">
                <p className="font-bold">No device is available right now.</p>
                <p className="mt-1">
                  The device must be online (powered on and connected) and idle before you can start. Check the device in the
                  classroom, or upload an audio file instead.
                </p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={onUseUpload}>
                  Upload an audio file instead
                </Button>
              </div>
            )}
          </>
        )}

        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Lesson title" required error={fe.title} className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={title}
                maxLength={200}
                placeholder="e.g. Photosynthesis — light reactions"
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <Field label="Subject" required error={fe.subject}>
            {(p) => <Input {...p} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} />}
          </Field>
          <Field label="Language of the class" error={fe.language}>
            {(p) => (
              <Select {...p} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="space-y-3 sm:col-span-2">
            <InlineError error={start.error && Object.keys(fe).length === 0 ? start.error : null} />
            <Button
              type="submit"
              size="lg"
              icon={<Mic className="size-4" aria-hidden />}
              loading={start.isPending}
              disabled={!selectedId || !title.trim() || !subject.trim()}
            >
              Start recording
            </Button>
            {!selectedId && devices.length > 0 && (
              <p className="text-xs text-muted">Recording becomes available when a device is online.</p>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
