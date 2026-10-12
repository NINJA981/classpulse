'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2 } from 'lucide-react';
import type { PlatformSchoolDetail } from '@classpulse/shared';
import { Button, Card, CardBody, CardHeader, InlineError, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { downloadFromApi } from '@/lib/download';
import { TypedConfirmDialog } from './ops-common';
import { platformKeys } from './queries';

interface SchoolDeleteResult {
  code: string;
  name: string;
  counts: Record<string, number>;
  storage: { objects: number; folders: number; failed: number };
}

/**
 * "Data & offboarding": export all of a school's data as JSON, and permanently delete a suspended school
 * (typed school-code confirmation). Both actions are audited by the API.
 */
export function SchoolOffboarding({ school }: { school: PlatformSchoolDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const suspended = school.status === 'suspended';

  const exportData = useMutation({
    mutationFn: () => downloadFromApi('POST', `/platform/schools/${school.id}/export`, { fallbackName: `classpulse-school-${school.code}.json` }),
    onSuccess: () => toast(`Export of ${school.name} downloaded`),
  });

  const remove = useMutation({
    mutationFn: () => api.delete<SchoolDeleteResult>(`/platform/schools/${school.id}`, { confirmCode: school.code }),
    onSuccess: (r) => {
      setConfirming(false);
      qc.removeQueries({ queryKey: platformKeys.school(school.id) });
      void qc.invalidateQueries({ queryKey: platformKeys.schools });
      toast(
        r.storage.failed > 0
          ? `${r.name} deleted. ${r.storage.failed} stored file location(s) could not be removed; check the logs.`
          : `${r.name} and all of its data were deleted`,
        r.storage.failed > 0 ? 'error' : 'success',
      );
      router.push('/platform/schools');
    },
  });

  return (
    <Card>
      <CardHeader eyebrow="Data protection" title="Data & offboarding" />
      <CardBody className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl text-sm text-ink-2">
            <p className="font-bold text-ink">Export school data</p>
            <p className="mt-1">
              One JSON file with everything this school holds: people (no passwords), classes, lessons with transcripts, quizzes
              and results, exams, assignments (file list only), teaching resources and its audit trail. Give it to the school
              when it asks for its data or leaves ClassPulse.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={<Download className="size-4" aria-hidden />}
            loading={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            Export school data
          </Button>
        </div>
        <InlineError error={exportData.error} />

        <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl text-sm text-ink-2">
            <p className="font-bold text-danger">Delete school permanently</p>
            <p className="mt-1">
              Erases the school, every account and record, and all stored audio and files. This cannot be undone. Export the
              data first. Encrypted backups still hold it for about 5 weeks, until they rotate out.
            </p>
            {!suspended && <p className="mt-1 font-semibold text-ink">Suspend the school first to enable deletion.</p>}
          </div>
          <Button
            variant="danger"
            icon={<Trash2 className="size-4" aria-hidden />}
            disabled={!suspended}
            onClick={() => {
              remove.reset();
              setConfirming(true);
            }}
          >
            Delete school
          </Button>
        </div>
      </CardBody>

      <TypedConfirmDialog
        open={confirming}
        onClose={() => {
          if (remove.isPending) return;
          remove.reset();
          setConfirming(false);
        }}
        title={`Delete ${school.name} permanently?`}
        description={`All ${school.counts.students} students, ${school.counts.teachers} teachers, ${school.counts.lessons} lessons and every other record and file of this school will be erased. This cannot be undone.`}
        word={school.code}
        actionLabel="Delete permanently (erases all data)"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
      />
    </Card>
  );
}
