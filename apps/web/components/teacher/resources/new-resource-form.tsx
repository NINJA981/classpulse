'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  RESOURCE_TYPES,
  type Course,
  type CourseDetail,
  type GenerateResourceInput,
  type Language,
  type LessonSummary,
  type Material,
  type Paginated,
  type ResourceDetail,
  type ResourceOptions,
  type ResourceType,
} from '@classiq/shared';
import { Button, Card, CardBody, CardHeader, Field, InlineError, Input, Select, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { CheckList } from './check-list';
import { RESOURCE_TYPE_INFO, RESOURCE_TYPE_LABEL, defaultOptions } from './meta';
import { resourceUi } from './types';
import { VoicePromptButton } from './voice-button';

/** Lessons with a transcript (usable as grounding). */
const TRANSCRIBED = new Set(['transcribed', 'ready_for_review', 'published']);

export function NewResourceForm({
  initialType,
  initialCourseId,
  initialUnitId,
}: {
  initialType: ResourceType;
  initialCourseId: string;
  initialUnitId: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [type, setType] = useState<ResourceType>(initialType);
  const [optionsByType, setOptionsByType] = useState<Record<ResourceType, unknown>>(
    () => Object.fromEntries(RESOURCE_TYPES.map((t) => [t, defaultOptions(t)])) as Record<ResourceType, unknown>,
  );
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(initialCourseId);
  const [unitIds, setUnitIds] = useState<string[]>(initialUnitId ? [initialUnitId] : []);
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState<Language>('en-IN');

  const courses = useQuery({ queryKey: ['curriculum', 'courses'], queryFn: () => api.get<Course[]>('/curriculum/courses') });
  const course = useQuery({
    queryKey: ['curriculum', 'courses', courseId],
    queryFn: () => api.get<CourseDetail>(`/curriculum/courses/${courseId}`),
    enabled: Boolean(courseId),
  });
  const lessons = useQuery({
    queryKey: ['lessons', { pageSize: 100 }],
    queryFn: () => api.get<Paginated<LessonSummary>>('/lessons', { pageSize: 100 }),
  });
  const materials = useQuery({ queryKey: ['curriculum', 'materials'], queryFn: () => api.get<Material[]>('/curriculum/materials') });

  const generate = useMutation({
    mutationFn: (body: GenerateResourceInput) => api.post<ResourceDetail>('/resources/generate', body),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['resources'] });
      router.push(`/teacher/resources/${r.id}`);
    },
  });

  const transcribed = (lessons.data?.items ?? []).filter((l) => TRANSCRIBED.has(l.status));
  // Materials of the chosen course first.
  const materialList = [...(materials.data ?? [])].sort((a, b) => Number(b.course?.id === courseId) - Number(a.course?.id === courseId));
  const { OptionsFields } = resourceUi[type];

  function submit(e: FormEvent) {
    e.preventDefault();
    generate.mutate({
      title: title.trim() || undefined,
      courseId: courseId || undefined,
      unitIds,
      lessonIds,
      materialIds,
      prompt: prompt.trim(),
      language,
      options: { ...(optionsByType[type] as ResourceOptions), type } as ResourceOptions,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <CardHeader title="What do you need?" />
        <CardBody>
          <div role="radiogroup" aria-label="Resource type" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RESOURCE_TYPES.map((t) => {
              const Icon = RESOURCE_TYPE_INFO[t].icon;
              const active = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(t)}
                  className={clsx(
                    'flex flex-col items-start gap-2 border p-4 text-left rounded-card',
                    active ? 'border-line-strong bg-accent-soft shadow-hard' : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="font-display font-extrabold">{RESOURCE_TYPE_LABEL[t]}</span>
                  <span className="text-xs text-muted">{RESOURCE_TYPE_INFO[t].description}</span>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Your request" />
        <CardBody className="space-y-4">
          <Field
            label="Describe what you want"
            hint="For example: “A 40-minute lesson on shadows with a hands-on activity; my class finds ray diagrams hard.” You can speak in any Indian language."
          >
            {(p) => <Textarea {...p} rows={4} maxLength={4000} value={prompt} onChange={(e) => setPrompt(e.target.value)} />}
          </Field>
          <VoicePromptButton onText={(text) => setPrompt((p) => (p.trim() ? `${p.trim()}\n${text}` : text).slice(0, 4000))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title (optional)" hint="Leave empty to name it after the topic.">
              {(p) => <Input {...p} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />}
            </Field>
            <Field label="Output language" hint="English subject terms stay in English.">
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
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ground it in your teaching" eyebrow="Optional" />
        <CardBody className="space-y-4">
          <Field label="Course" hint={courses.isError ? 'Courses could not be loaded.' : 'Set up courses under “Courses & materials”.'}>
            {(p) => (
              <Select
                {...p}
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setUnitIds([]);
                }}
              >
                <option value="">No course</option>
                {(courses.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.level ? ` · ${c.level}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {courseId && (
            <CheckList
              legend="Units / chapters"
              items={course.data?.units ?? []}
              selected={unitIds}
              onChange={setUnitIds}
              max={20}
              render={(u) => `${u.position}. ${u.title}`}
              empty={course.isPending ? 'Loading units…' : 'This course has no units yet.'}
            />
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <CheckList
              legend="Recorded lessons (transcripts)"
              items={transcribed}
              selected={lessonIds}
              onChange={setLessonIds}
              max={10}
              render={(l) => (
                <span>
                  {l.title} <span className="text-xs text-muted">· {l.section.name} · {formatDate(l.createdAt)}</span>
                </span>
              )}
              empty={lessons.isPending ? 'Loading lessons…' : 'No transcribed lessons yet. Record or upload a class first.'}
            />
            <CheckList
              legend="Your materials"
              items={materialList}
              selected={materialIds}
              onChange={setMaterialIds}
              max={10}
              render={(m) => (
                <span>
                  {m.title} <span className="text-xs uppercase text-muted">· {m.kind}</span>
                  {m.course && <span className="text-xs text-muted"> · {m.course.title}</span>}
                </span>
              )}
              empty={materials.isPending ? 'Loading materials…' : 'No materials yet. Upload notes under “Courses & materials”.'}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${RESOURCE_TYPE_LABEL[type]} settings`} />
        <CardBody>
          <OptionsFields value={optionsByType[type]} onChange={(v) => setOptionsByType((prev) => ({ ...prev, [type]: v }))} />
        </CardBody>
      </Card>

      <InlineError error={generate.error} />
      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={generate.isPending} icon={<Sparkles className="size-4" aria-hidden />}>
          Generate {RESOURCE_TYPE_LABEL[type].toLowerCase()}
        </Button>
      </div>
    </form>
  );
}
