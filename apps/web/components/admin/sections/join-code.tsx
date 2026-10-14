'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { Section } from '@classiq/shared';
import { Badge, Button, Card, CardBody, CardHeader, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { adminKeys } from '../queries';
import { ConfirmDialog, CopyButton } from '../common';

export const isExpired = (iso: string) => new Date(iso).getTime() < Date.now();

/** Rotate-join-code mutation + confirm dialog. Returns the trigger handler and the dialog element. */
export function useRotateCode() {
  const qc = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState<Section | null>(null);
  const rotate = useMutation({
    mutationFn: (s: Section) => api.post<Section>(`/admin/sections/${s.id}/rotate-code`),
    onSuccess: (updated) => {
      qc.setQueryData<Section[]>(adminKeys.sections, (list) => list?.map((s) => (s.id === updated.id ? updated : s)));
      void qc.invalidateQueries({ queryKey: adminKeys.sections });
      toast(`New join code for ${updated.name}: ${updated.joinCode}`);
      setTarget(null);
    },
  });

  const dialog = (
    <ConfirmDialog
      open={target !== null}
      onClose={() => setTarget(null)}
      title="Rotate join code?"
      description={
        target && (
          <>
            The current code <strong className="font-mono">{target.joinCode}</strong> for <strong>{target.name}</strong> will stop
            working immediately. Students already enrolled are not affected.
          </>
        )
      }
      confirmLabel="Rotate code"
      tone="primary"
      onConfirm={() => target && rotate.mutate(target)}
      pending={rotate.isPending}
      error={rotate.error}
    />
  );

  return {
    open: (s: Section) => {
      rotate.reset();
      setTarget(s);
    },
    dialog,
  };
}

/** Big, copyable join code card for the section detail page. */
export function JoinCodeCard({ section, onRotate }: { section: Section; onRotate: () => void }) {
  const expired = isExpired(section.joinCodeExpiresAt);
  return (
    <Card className="border-line-strong shadow-hard">
      <CardHeader eyebrow="Students join with" title="Join code" actions={expired ? <Badge tone="danger">Expired</Badge> : <Badge tone="success">Active</Badge>} />
      <CardBody className="flex flex-col gap-4">
        <p className="select-all font-mono text-5xl font-black tracking-[0.2em] text-ink" aria-label={`Join code ${section.joinCode.split('').join(' ')}`}>
          {section.joinCode}
        </p>
        <p className="text-sm text-muted">
          {expired ? 'Expired' : 'Expires'} {formatDateTime(section.joinCodeExpiresAt)}. Students enter it under “Join a class”.
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={section.joinCode} label="Copy join code" size="md">
            Copy code
          </CopyButton>
          <Button variant="secondary" icon={<RefreshCw className="size-4" aria-hidden />} onClick={onRotate}>
            Rotate code
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
