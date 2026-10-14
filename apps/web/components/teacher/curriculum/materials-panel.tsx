'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Trash2, Upload } from 'lucide-react';
import { MATERIAL_MAX_MB, type CourseDetail, type Material, type UpdateMaterialInput } from '@classiq/shared';
import { Badge, Button, EmptyState, ErrorState, Field, InlineError, Input, LoadingBlock, Select, useToast } from '@/components/ui';
import { ConfirmDialog } from '@/components/teacher/common';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

const formatSize = (bytes: number | null) => (bytes == null ? '' : bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** The teacher's own notes for one course: upload (PDF/DOCX/TXT), attach to a unit, delete. Private to the teacher. */
export function MaterialsPanel({ course }: { course: CourseDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [unitId, setUnitId] = useState('');
  const [deleting, setDeleting] = useState<Material | null>(null);
  const key = ['curriculum', 'materials', { courseId: course.id }];

  const list = useQuery({ queryKey: key, queryFn: () => api.get<Material[]>('/curriculum/materials', { courseId: course.id }) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['curriculum', 'materials'] });

  const upload = useMutation({
    mutationFn: (form: FormData) => api.upload<Material>('/curriculum/materials', form, 5 * 60_000),
    onSuccess: (m) => {
      setFile(null);
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      refresh();
      toast(`Uploaded “${m.title}” (${m.textLength.toLocaleString('en-IN')} characters of text)`);
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMaterialInput }) => api.patch<Material>(`/curriculum/materials/${id}`, body),
    onSuccess: refresh,
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/curriculum/materials/${id}`),
    onSuccess: () => {
      setDeleting(null);
      refresh();
    },
  });

  const tooBig = file !== null && file.size > MATERIAL_MAX_MB * 1024 * 1024;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || tooBig) return;
    const form = new FormData();
    form.append('courseId', course.id);
    if (unitId) form.append('unitId', unitId);
    if (title.trim()) form.append('title', title.trim());
    form.append('file', file);
    upload.mutate(form);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-3 border border-dashed border-line-strong p-4 rounded-card">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="File" hint={`PDF, Word (.docx) or text, up to ${MATERIAL_MAX_MB} MB`} error={tooBig ? `The file is larger than ${MATERIAL_MAX_MB} MB` : null}>
            {(p) => <Input {...p} ref={fileRef} type="file" accept={ACCEPT} className="pt-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
          </Field>
          <Field label="Title (optional)" hint="Defaults to the file name">
            {(p) => <Input {...p} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field label="Unit (optional)">
            {(p) => (
              <Select {...p} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Whole course</option>
                {course.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.position}. {u.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <InlineError error={upload.error} />
        <Button type="submit" variant="secondary" icon={<Upload className="size-4" aria-hidden />} loading={upload.isPending} disabled={!file || tooBig}>
          Upload material
        </Button>
      </form>

      {list.isPending ? (
        <LoadingBlock label="Loading materials…" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-8" aria-hidden />}
          title="No materials for this course yet"
          description="Upload your notes or textbook chapters: AI resources then use only what they contain."
        />
      ) : (
        <ul className="divide-y divide-line border border-line rounded-card">
          {list.data.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
              <FileText className="size-5 shrink-0 text-muted" aria-hidden />
              <div className="min-w-48 flex-1">
                <p className="font-bold">{m.title}</p>
                <p className="text-xs text-muted">
                  <Badge className="mr-1">{m.kind}</Badge>
                  {formatSize(m.sizeBytes)} · {m.textLength.toLocaleString('en-IN')} characters · {formatDate(m.createdAt)}
                </p>
              </div>
              <Select
                aria-label={`Unit for ${m.title}`}
                className="h-8 w-56"
                value={m.unit?.id ?? ''}
                disabled={update.isPending}
                onChange={(e) => update.mutate({ id: m.id, body: { courseId: course.id, unitId: e.target.value || null } })}
              >
                <option value="">Whole course</option>
                {course.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.position}. {u.title}
                  </option>
                ))}
              </Select>
              <Button variant="ghost" size="sm" aria-label={`Delete ${m.title}`} onClick={() => setDeleting(m)}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this material?"
        description={`“${deleting?.title ?? ''}” and its extracted text are removed. Resources already generated from it are kept.`}
        confirmLabel="Delete material"
        danger
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
