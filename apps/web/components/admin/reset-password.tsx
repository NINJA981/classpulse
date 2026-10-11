'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Mail } from 'lucide-react';
import type { PasswordResetResult, SendLinkResult } from '@classpulse/shared';
import { Button, Dialog, InlineError, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { OneTimePasswordDialog } from './common';
import { adminKeys } from './queries';

type Kind = 'teachers' | 'students';

interface Target {
  id: string;
  name: string;
  /** Email or roll number, shown next to the name. */
  login: string;
  /** Where a reset link can be emailed; null = one-time password only. */
  email: string | null;
}

/** Toast for a send-invite / send-reset-link outcome. */
function useLinkToast() {
  const toast = useToast();
  return (res: SendLinkResult, t: Target, what: string) => {
    if (res.invite === 'queued') toast(`${what} emailed to ${t.email}`);
    else toast('Email isn’t set up on this server. Use a one-time password instead.', 'error');
  };
}

/**
 * Reset a password: email a reset link (when the person has an email address) or
 * generate a one-time password that is shown once. Either way, earlier links stop working.
 */
export function useResetPassword(kind: Kind) {
  const qc = useQueryClient();
  const linkToast = useLinkToast();
  const [target, setTarget] = useState<Target | null>(null);
  const [result, setResult] = useState<{ target: Target; password: string } | null>(null);

  const oneTime = useMutation({
    mutationFn: (t: Target) => api.post<PasswordResetResult>(`/admin/${kind}/${t.id}/reset-password`),
    onSuccess: (res, t) => {
      void qc.invalidateQueries({ queryKey: adminKeys[kind] });
      setTarget(null);
      setResult({ target: t, password: res.initialPassword });
    },
  });
  const emailLink = useMutation({
    mutationFn: (t: Target) => api.post<SendLinkResult>(`/admin/${kind}/${t.id}/send-reset-link`),
    onSuccess: (res, t) => {
      void qc.invalidateQueries({ queryKey: adminKeys[kind] });
      setTarget(null);
      linkToast(res, t, 'Reset link');
    },
  });
  const pending = oneTime.isPending || emailLink.isPending;

  const dialogs = (
    <>
      <Dialog
        open={target !== null}
        onClose={() => !pending && setTarget(null)}
        title="Reset password?"
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setTarget(null)} disabled={pending}>
            Cancel
          </Button>
        }
      >
        {target && (
          <div className="flex flex-col gap-3 text-sm text-ink-2">
            {/* The choices stack full-width so they never overflow a phone-width dialog. */}
            <div className="flex flex-col gap-2">
              {target.email && (
                <Button
                  icon={<Mail className="size-4" aria-hidden />}
                  onClick={() => emailLink.mutate(target)}
                  loading={emailLink.isPending}
                  disabled={oneTime.isPending}
                  className="w-full"
                >
                  Email a reset link
                </Button>
              )}
              <Button
                variant={target.email ? 'secondary' : 'primary'}
                icon={<KeyRound className="size-4" aria-hidden />}
                onClick={() => oneTime.mutate(target)}
                loading={oneTime.isPending}
                disabled={emailLink.isPending}
                className="w-full"
              >
                Show a one-time password
              </Button>
            </div>
            {target.email ? (
              <p>
                Email <strong>{target.name}</strong> a link to choose a new password at <strong>{target.email}</strong> (valid for 72
                hours), or generate a one-time password to hand over yourself.
              </p>
            ) : (
              <p>
                <strong>{target.name}</strong> ({target.login}) has no email address, so a one-time password will be generated for
                you to hand over.
              </p>
            )}
            <p>
              A one-time password replaces the current one immediately and signs them out everywhere; they must change it at next
              sign-in. A reset link changes nothing until they use it.
            </p>
            <InlineError error={oneTime.error ?? emailLink.error} />
          </div>
        )}
      </Dialog>
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
      oneTime.reset();
      emailLink.reset();
      setTarget(t);
    },
    dialogs,
  };
}

/** "Resend invite": POST /admin/{kind}/:id/send-invite and toast the outcome. */
export function useSendInvite(kind: Kind) {
  const qc = useQueryClient();
  const toast = useToast();
  const linkToast = useLinkToast();
  const send = useMutation({
    mutationFn: (t: Target) => api.post<SendLinkResult>(`/admin/${kind}/${t.id}/send-invite`),
    onSuccess: (res, t) => {
      void qc.invalidateQueries({ queryKey: adminKeys[kind] });
      linkToast(res, t, 'Invitation');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not send the invitation', 'error'),
  });
  return {
    send: (t: Target) => send.mutate(t),
    /** Id of the row whose invite is being sent (for its button's spinner). */
    pendingId: send.isPending ? send.variables?.id : undefined,
  };
}
