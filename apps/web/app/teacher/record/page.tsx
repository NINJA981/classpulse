'use client';
import { Suspense, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  Tabs,
} from '@/components/ui';
import { useTeacherSections } from '@/components/teacher/common';
import { RecordSetup } from '@/components/teacher/record/record-setup';
import { RecordingPanel } from '@/components/teacher/record/recording-panel';
import { UploadForm } from '@/components/teacher/record/upload-form';

type Mode = 'device' | 'upload';

export default function RecordPage() {
  return (
    <>
      <PageHeader
        eyebrow="Teacher studio"
        title="Record a class"
        description="Record with the classroom device or upload an audio file. ClassIQ transcribes it and drafts a quiz for you to review."
        back={{ href: '/teacher/lessons', label: 'Lessons' }}
      />
      <Suspense fallback={<LoadingBlock />}>
        <RecordContent />
      </Suspense>
    </>
  );
}

function RecordContent() {
  const pathname = usePathname();
  const params = useSearchParams();
  const recordingId = params.get('recording');
  const mode: Mode = params.get('tab') === 'upload' ? 'upload' : 'device';
  const sectionsQ = useTeacherSections();
  const [pickedSection, setPickedSection] = useState<string | null>(params.get('sectionId'));

  function setParams(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    // Shallow URL update: keeps typed form state (router.replace would re-run the route and remount the forms).
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
  }

  if (recordingId) return <RecordingPanel recordingId={recordingId} onNew={() => setParams({ recording: null })} />;

  if (sectionsQ.isPending) return <LoadingBlock label="Loading your sections…" />;
  if (sectionsQ.isError) return <ErrorState error={sectionsQ.error} onRetry={() => sectionsQ.refetch()} />;
  const sections = sectionsQ.data;
  if (sections.length === 0)
    return (
      <Card>
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title="You are not assigned to any section"
          description="Lessons belong to a section. Ask your institution’s admin to assign you to one, then come back here."
        />
      </Card>
    );

  const sectionId = pickedSection && sections.some((s) => s.id === pickedSection) ? pickedSection : (sections[0]?.id ?? '');
  const section = sections.find((s) => s.id === sectionId);

  return (
    <div className="space-y-6">
      <Tabs<Mode>
        label="How to capture the class"
        value={mode}
        onChange={(m) => setParams({ tab: m === 'upload' ? 'upload' : null })}
        tabs={[
          { value: 'device', label: 'Record in classroom' },
          { value: 'upload', label: 'Upload audio file' },
        ]}
      />

      <Card>
        <CardHeader eyebrow="Step 1" title="Choose the section" />
        <CardBody>
          <Field
            label="Section"
            hint={section?.room ? `Classroom: ${section.room.name}` : 'No classroom assigned to this section'}
            className="max-w-md"
          >
            {(p) => (
              <Select {...p} value={sectionId} onChange={(e) => setPickedSection(e.target.value)}>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.subject ? ` — ${s.subject}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </CardBody>
      </Card>

      {section &&
        (mode === 'device' ? (
          <RecordSetup
            key={section.id}
            section={section}
            onStarted={(s) => setParams({ recording: s.id })}
            onUseUpload={() => setParams({ tab: 'upload' })}
          />
        ) : (
          <UploadForm key={section.id} section={section} />
        ))}
    </div>
  );
}
