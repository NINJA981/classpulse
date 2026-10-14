'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Pencil, Printer, RefreshCw, Save, Share2, Trash2, Undo2 } from 'lucide-react';
import type { ResourceContent, ResourceDetail } from '@classiq/shared';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  Dialog,
  ErrorState,
  Field,
  InlineError,
  Input,
  LoadingBlock,
  PageHeader,
  useToast,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/teacher/common';
import { RESOURCE_DOWNLOAD, RESOURCE_TYPE_LABEL, ResourceStatusBadge, isProcessing, useResource } from '@/components/teacher/resources/meta';
import { ProcessingCard } from '@/components/teacher/resources/processing';
import { resourceUi } from '@/components/teacher/resources/types';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, languageLabel } from '@/lib/format';

type Confirm = 'regenerate' | 'delete' | null;

export default function ResourcePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useResource(id);
  /** Unsaved teacher edits (null = showing the saved content). */
  const [draft, setDraft] = useState<ResourceContent | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const dirty = draft !== null;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const onSaved = (r: ResourceDetail) => {
    qc.setQueryData(['resources', id], r);
    void qc.invalidateQueries({ queryKey: ['resources', 'list'] });
  };
  const save = useMutation({
    mutationFn: (body: { title?: string; content?: ResourceContent }) => api.patch<ResourceDetail>(`/resources/${id}`, body),
    onSuccess: (r, body) => {
      onSaved(r);
      if (body.content) setDraft(null);
      if (body.title) setRenaming(null);
      toast(body.content ? 'Changes saved' : 'Renamed');
    },
  });
  const action = useMutation({
    mutationFn: (kind: 'regenerate' | 'share' | 'unshare') => api.post<ResourceDetail>(`/resources/${id}/${kind}`),
    onSuccess: (r, kind) => {
      onSaved(r);
      setConfirm(null);
      if (kind === 'regenerate') setDraft(null);
      toast(kind === 'share' ? 'Shared with your school' : kind === 'unshare' ? 'No longer shared' : 'Generating a new version…');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  const copy = useMutation({
    mutationFn: () => api.post<ResourceDetail>(`/resources/${id}/copy`),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['resources', 'list'] });
      toast('Copied to your resources');
      router.push(`/teacher/resources/${r.id}`);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/resources/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resources', 'list'] });
      qc.removeQueries({ queryKey: ['resources', id] });
      toast('Resource deleted');
      router.replace('/teacher/resources');
    },
  });

  if (q.isPending) return <LoadingBlock label="Loading resource…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const r = q.data;
  const { Viewer } = resourceUi[r.type];
  const processing = isProcessing(r.status);
  const hasContent = r.content !== null;
  const shown: ResourceDetail = draft ? { ...r, content: draft } : r;
  const download = RESOURCE_DOWNLOAD[r.type];
  const ready = r.status === 'ready' && hasContent;

  return (
    <>
      <PageHeader
        eyebrow={RESOURCE_TYPE_LABEL[r.type]}
        title={r.title}
        back={{ href: '/teacher/resources', label: 'AI teaching tools' }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ResourceStatusBadge status={r.status} />
            {r.shared && <Badge tone="accent">Shared with school</Badge>}
            <span>
              {r.course ? `${r.course.title} · ` : ''}
              {languageLabel(r.language)} · {r.mine ? 'Updated' : `By ${r.teacher.name} · updated`} {formatDateTime(r.updatedAt)}
            </span>
          </span>
        }
        actions={
          r.mine ? (
            <>
              <Button variant="ghost" size="sm" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setRenaming(r.title)}>
                Rename
              </Button>
              {ready &&
                (r.shared ? (
                  <Button variant="secondary" size="sm" icon={<Share2 className="size-4" aria-hidden />} loading={action.isPending && action.variables === 'unshare'} onClick={() => action.mutate('unshare')}>
                    Unshare
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" icon={<Share2 className="size-4" aria-hidden />} loading={action.isPending && action.variables === 'share'} onClick={() => action.mutate('share')}>
                    Share with school
                  </Button>
                ))}
              {!processing && (
                <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => setConfirm('regenerate')}>
                  Regenerate
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirm('delete')}>
                Delete
              </Button>
            </>
          ) : (
            ready && (
              <Button size="sm" icon={<Copy className="size-4" aria-hidden />} loading={copy.isPending} onClick={() => copy.mutate()}>
                Copy to my resources
              </Button>
            )
          )
        }
      />

      {r.prompt && (
        <p className="mb-4 max-w-3xl border-l-2 border-line-strong pl-3 text-sm italic text-ink-2">“{r.prompt}”</p>
      )}

      {processing ? (
        <ProcessingCard type={r.type} status={r.status} />
      ) : (
        <>
          {r.status === 'failed' && (
            <Card className="mb-4 border-danger/40">
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div role="alert">
                  <p className="font-bold text-danger">Generation failed</p>
                  <p className="text-sm text-ink-2">{r.failureReason ?? 'Something went wrong. Please try again.'}</p>
                </div>
                {r.mine && (
                  <Button icon={<RefreshCw className="size-4" aria-hidden />} loading={action.isPending && action.variables === 'regenerate'} onClick={() => action.mutate('regenerate')}>
                    Try again
                  </Button>
                )}
              </CardBody>
            </Card>
          )}

          {hasContent && (
            <>
              <div className="sticky top-14 z-20 mb-4 flex flex-wrap items-center justify-between gap-2 border border-line bg-surface px-4 py-2.5 shadow-card rounded-card lg:top-2">
                <div className="flex flex-wrap items-center gap-2">
                  {ready && (
                    <a
                      href={`/api/resources/${r.id}/export.${download.ext}`}
                      download
                      className="inline-flex h-8 items-center gap-2 border border-line-strong bg-surface px-3 text-xs font-bold text-ink rounded-control hover:bg-surface-2"
                    >
                      <Download className="size-4" aria-hidden />
                      {download.label}
                    </a>
                  )}
                  {ready && (
                    <ButtonLink href={`/teacher/resources/${r.id}/print`} variant="secondary" size="sm" icon={<Printer className="size-4" aria-hidden />}>
                      Print / PDF
                    </ButtonLink>
                  )}
                </div>
                {r.mine && (
                  <div className="flex items-center gap-2">
                    {dirty && <span className="text-xs font-semibold text-warning">Unsaved changes</span>}
                    {dirty && (
                      <Button variant="ghost" size="sm" icon={<Undo2 className="size-4" aria-hidden />} onClick={() => setDraft(null)}>
                        Discard
                      </Button>
                    )}
                    <Button
                      size="sm"
                      icon={<Save className="size-4" aria-hidden />}
                      disabled={!dirty}
                      loading={save.isPending && Boolean(save.variables?.content)}
                      onClick={() => draft && save.mutate({ content: draft })}
                    >
                      Save edits
                    </Button>
                  </div>
                )}
              </div>
              {save.isError && save.variables?.content && (
                <div className="mb-4">
                  <InlineError error={save.error} />
                </div>
              )}
              <Card>
                <CardBody>
                  <Viewer resource={shown} editable={r.mine} onChange={setDraft} mode="screen" showAnswers />
                </CardBody>
              </Card>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm === 'regenerate'}
        onClose={() => setConfirm(null)}
        title="Regenerate this resource?"
        description={
          dirty
            ? 'The AI writes a new version from the same request. Your unsaved edits will be lost.'
            : 'The AI writes a new version from the same request and replaces the current content when it is ready.'
        }
        confirmLabel="Regenerate"
        loading={action.isPending}
        error={action.error}
        onConfirm={() => action.mutate('regenerate')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Delete this resource?"
        description="It is removed for you and, if shared, from the school library. Copies colleagues made are kept."
        confirmLabel="Delete resource"
        danger
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
      />
      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Rename resource"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              loading={save.isPending && Boolean(save.variables?.title)}
              disabled={!renaming?.trim()}
              onClick={() => renaming?.trim() && save.mutate({ title: renaming.trim() })}
            >
              Save title
            </Button>
          </>
        }
      >
        <Field label="Title">{(p) => <Input {...p} maxLength={200} value={renaming ?? ''} onChange={(e) => setRenaming(e.target.value)} />}</Field>
        {save.isError && save.variables?.title && (
          <div className="mt-3">
            <InlineError error={save.error} />
          </div>
        )}
      </Dialog>
    </>
  );
}
