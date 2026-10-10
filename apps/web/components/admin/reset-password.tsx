'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { PasswordResetResult } from '@classpulse/shared';
import { api } from '@/lib/api';
import { ConfirmDialog, OneTimePasswordDialog } from './common';

interface Target {
  id: string;
  name: string;
  /** Email or roll number, shown next to the name. */
  login: string;
}

/** Confirm → POST /admin/{teachers|students}/:id/reset-password → show the new password once. */
export function useResetPassword(kind: 'teachers' | 'students') {
  const [target, setTarget] = useState<Target | null>(null);
  const [result, setResult] = useState<{ target: Target; password: string } | null>(null);

  const reset = useMutation({
    mutationFn: (t: Target) => api.post<PasswordResetResult>(`/admin/${kind}/${t.id}/reset-password`),
    onSuccess: (res, t) => {
      setTarget(null);
      setResult({ target: t, password: res.initialPassword });
    },
  });

  const dialogs = (
    <>
      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Reset password?"
        description={
          target && (
            <>
              A new password will be generated for <strong>{target.name}</strong> ({target.login}). Their current password stops
              working and they must change the new one at next sign-in.
            </>
          )
        }
        confirmLabel="Reset password"
        tone="primary"
        onConfirm={() => target && reset.mutate(target)}
        pending={reset.isPending}
        error={reset.error}
      />
      <OneTimePasswordDialog
        open={result !== null}
        onClose={() => setResult(null)}
        title="Password reset"
        who={result ? `${result.target.name} (${result.target.login})` : ''}
        password={result?.password ?? null}
      />
    </>
  );

  return {
    open: (t: Target) => {
      reset.reset();
      setTarget(t);
    },
    dialogs,
  };
}
