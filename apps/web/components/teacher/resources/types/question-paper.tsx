'use client';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  BLOOM_LEVELS,
  QuestionPaperContent,
  QuestionPaperOptions,
  type BloomLevel,
  type Difficulty,
  type PaperQuestion,
  type PublishPaperExamResult,
} from '@classiq/shared';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  InlineError,
  Input,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  type BadgeTone,
} from '@/components/ui';
import { useTeacherSections } from '@/components/teacher/common';
import { BLOOM_LABEL } from '@/components/teacher/lesson/bloom';
import { fromLocalInput, toLocalInput } from '@/components/teacher/status';
import { api, ApiError } from '@/lib/api';
import type { OptionsFieldsProps, ViewerProps } from '.';

type Paper = QuestionPaperContent;
type PaperSection = Paper['sections'][number];
type QType = PaperQuestion['type'];
type Options = ReturnType<typeof QuestionPaperOptions.parse>;
type SectionSpec = Options['sections'][number];

const TYPE_LABEL: Record<QType, string> = {
  mcq: 'Multiple choice',
  very_short: 'Very short answer',
  short: 'Short answer',
  long: 'Long answer',
  case_based: 'Case-based',
  assertion_reason: 'Assertion–reason',
};

const DIFFICULTY_TONE: Record<Difficulty, BadgeTone> = { easy: 'success', medium: 'info', hard: 'warning' };

const isObjective = (t: QType) => t === 'mcq' || t === 'assertion_reason';
const letter = (i: number) => String.fromCharCode(97 + i);
const marksText = (m: number) => `${m} mark${m === 1 ? '' : 's'}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const paperTotal = (p: Paper) => round2(p.sections.reduce((s, sec) => s + sec.questions.reduce((t, q) => t + q.marks, 0), 0));

/** Objective questions that can go into a secure exam (mirrors the API's rule). */
const examReady = (q: PaperQuestion) =>
  isObjective(q.type) &&
  q.options.length === 4 &&
  q.options.every((o) => o.trim()) &&
  new Set(q.options.map((o) => o.trim().toLowerCase())).size === 4 &&
  q.correctIndex >= 0 &&
  q.correctIndex <= 3;

/* ----------------------------------------------------------------------------
 * Blueprint (derived client-side: marks by unit × Bloom level)
 * ------------------------------------------------------------------------- */

function blueprint(paper: Paper) {
  const qs = paper.sections.flatMap((s) => s.questions);
  const levels = BLOOM_LEVELS.filter((b) => qs.some((q) => q.bloomLevel === b));
  const units = [...new Set(qs.map((q) => q.unit.trim() || 'General'))];
  const sum = (f: (q: PaperQuestion) => boolean) => round2(qs.filter(f).reduce((s, q) => s + q.marks, 0));
  return {
    levels,
    rows: units.map((u) => ({
      unit: u,
      cells: levels.map((b) => sum((q) => (q.unit.trim() || 'General') === u && q.bloomLevel === b)),
      total: sum((q) => (q.unit.trim() || 'General') === u),
    })),
    totals: levels.map((b) => sum((q) => q.bloomLevel === b)),
    total: sum(() => true),
    byDifficulty: (['easy', 'medium', 'hard'] as const).map((d) => ({ d, marks: sum((q) => q.difficulty === d) })),
  };
}

function Blueprint({ paper }: { paper: Paper }) {
  const bp = blueprint(paper);
  const max = paper.header.maxMarks;
  const ok = bp.total === max;
  return (
    <section aria-labelledby="qp-blueprint" className="space-y-3 break-inside-avoid">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="qp-blueprint" className="font-display text-base font-extrabold">
          Blueprint: marks by unit and Bloom level
        </h3>
        <Badge tone={ok ? 'success' : 'danger'}>
          {ok ? `Totals check: ${bp.total} / ${max} marks` : `Totals check: ${bp.total} marks, expected ${max}`}
        </Badge>
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Unit</TH>
            {bp.levels.map((b) => (
              <TH key={b} className="text-right">
                {BLOOM_LABEL[b]}
              </TH>
            ))}
            <TH className="text-right">Total</TH>
          </TR>
        </THead>
        <TBody>
          {bp.rows.map((r) => (
            <TR key={r.unit}>
              <TD className="font-semibold">{r.unit}</TD>
              {r.cells.map((n, i) => (
                <TD key={bp.levels[i]} className="text-right tabular-nums">
                  {n || '–'}
                </TD>
              ))}
              <TD className="text-right font-bold tabular-nums">{r.total}</TD>
            </TR>
          ))}
          <TR>
            <TD className="font-bold">Total</TD>
            {bp.totals.map((n, i) => (
              <TD key={bp.levels[i]} className="text-right font-bold tabular-nums">
                {n || '–'}
              </TD>
            ))}
            <TD className="text-right font-black tabular-nums">{bp.total}</TD>
          </TR>
        </TBody>
      </Table>
      <p className="text-xs text-muted">
        By difficulty: {bp.byDifficulty.map((x) => `${x.d} ${x.marks}`).join(' · ')} marks.
      </p>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Viewer
 * ------------------------------------------------------------------------- */

export function Viewer({ resource, editable = false, onChange, mode = 'screen', showAnswers = true }: ViewerProps) {
  const parsed = QuestionPaperContent.safeParse(resource.content);
  const [answersOn, setAnswersOn] = useState(showAnswers);
  const [editing, setEditing] = useState<number | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  if (!parsed.success) {
    return <EmptyState title="No question paper yet" description="The paper appears here once it has been generated." />;
  }
  const paper = parsed.data;
  const print = mode === 'print';
  const answers = print ? showAnswers : answersOn;
  const canEdit = editable && !print && Boolean(onChange);
  const mcqs = paper.sections.flatMap((s) => s.questions).filter(examReady).length;

  const updateQuestion = (si: number, qi: number, next: PaperQuestion) => {
    if (!onChange) return;
    onChange({
      ...paper,
      sections: paper.sections.map((s, i) => (i === si ? { ...s, questions: s.questions.map((q, j) => (j === qi ? next : q)) } : s)),
    });
  };

  return (
    <div className="space-y-6">
      {!print && (
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox label="Show answer key & marking scheme" checked={answersOn} onChange={(e) => setAnswersOn(e.target.checked)} />
          <Badge tone={paperTotal(paper) === paper.header.maxMarks ? 'success' : 'danger'}>
            Total {paperTotal(paper)} / {paper.header.maxMarks} marks
          </Badge>
          <span className="ml-auto" />
          {resource.mine && resource.status === 'ready' && (
            <Button
              variant="secondary"
              icon={<ClipboardCheck className="size-4" aria-hidden />}
              onClick={() => setPublishOpen(true)}
              disabled={mcqs === 0}
              title={mcqs === 0 ? 'This paper has no multiple-choice questions' : undefined}
            >
              Publish MCQs as exam
            </Button>
          )}
        </div>
      )}

      <article
        aria-label={`Question paper: ${paper.header.examName}`}
        className={clsx('space-y-6', !print && 'rounded-card border border-line bg-surface p-5 shadow-card sm:p-8')}
      >
        <PaperHeader paper={paper} />
        {paper.sections.map((section, si) => (
          <SectionBlock key={si} section={section}>
            {section.questions.map((q, qi) => (
              <li key={q.number} className="break-inside-avoid">
                {canEdit && editing === q.number ? (
                  <QuestionEditor question={q} onChange={(next) => updateQuestion(si, qi, next)} onDone={() => setEditing(null)} />
                ) : (
                  <QuestionView question={q} showAnswer={answers} print={print} onEdit={canEdit ? () => setEditing(q.number) : undefined} />
                )}
              </li>
            ))}
          </SectionBlock>
        ))}
      </article>

      {answers && (
        <div className={clsx('space-y-6', print ? 'break-before-page' : 'rounded-card border border-line bg-surface p-5 shadow-card')}>
          {print && <AnswerKey paper={paper} />}
          <Blueprint paper={paper} />
        </div>
      )}

      {!print && publishOpen && (
        <PublishExamDialog resourceId={resource.id} paper={paper} mcqs={mcqs} onClose={() => setPublishOpen(false)} />
      )}
    </div>
  );
}

function PaperHeader({ paper }: { paper: Paper }) {
  const h = paper.header;
  return (
    <header className="space-y-3 border-b border-line-strong pb-4 text-center">
      <h2 className="font-display text-2xl font-black">{h.examName}</h2>
      {(h.subject || h.level) && <p className="text-sm font-bold text-ink-2">{[h.subject, h.level].filter(Boolean).join(' · ')}</p>}
      <div className="flex flex-wrap justify-between gap-2 text-sm font-bold">
        <span>Time allowed: {h.durationMin} minutes</span>
        <span>Maximum marks: {h.maxMarks}</span>
      </div>
      {h.generalInstructions.length > 0 && (
        <div className="text-left">
          <p className="eyebrow mb-1">General instructions</p>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ink-2">
            {h.generalInstructions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      )}
    </header>
  );
}

function SectionBlock({ section, children }: { section: PaperSection; children: ReactNode }) {
  const marks = round2(section.questions.reduce((s, q) => s + q.marks, 0));
  return (
    <section aria-label={section.name} className="space-y-3">
      <div className="text-center">
        <h3 className="font-display text-lg font-extrabold">{section.name}</h3>
        {section.instructions && <p className="text-sm italic text-muted">{section.instructions}</p>}
        <p className="text-xs text-muted">
          {section.questions.length} questions · {marks} marks
        </p>
      </div>
      <ol className="space-y-4">{children}</ol>
    </section>
  );
}

function Chips({ q }: { q: PaperQuestion }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone="solid">{marksText(q.marks)}</Badge>
      <Badge tone="accent">{BLOOM_LABEL[q.bloomLevel]}</Badge>
      <Badge tone={DIFFICULTY_TONE[q.difficulty]}>{q.difficulty}</Badge>
    </span>
  );
}

function QuestionView({
  question: q,
  showAnswer,
  print,
  onEdit,
}: {
  question: PaperQuestion;
  showAnswer: boolean;
  print: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <span className="font-display text-sm font-black">{q.number}.</span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="whitespace-pre-line leading-relaxed">{q.text}</p>
          {q.options.length > 0 && (
            <ol className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              {q.options.map((o, i) => {
                const correct = showAnswer && i === q.correctIndex;
                return (
                  <li key={i} className={clsx('flex gap-2 rounded-control px-2 py-1', correct && 'bg-success-soft font-bold')}>
                    <span className="font-mono text-xs font-black">({letter(i)})</span>
                    <span>{o}</span>
                    {correct && (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="size-3.5" aria-hidden /> Correct
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {q.alternative && (
            <>
              <p className="text-center text-sm font-black">OR</p>
              <p className="whitespace-pre-line leading-relaxed">{q.alternative.text}</p>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {print ? <span className="text-sm font-bold">[{marksText(q.marks)}]</span> : <Chips q={q} />}
          {onEdit && (
            <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" aria-hidden />} onClick={onEdit} aria-label={`Edit question ${q.number}`}>
              Edit
            </Button>
          )}
        </div>
      </div>
      {showAnswer && !print && <AnswerBox q={q} />}
    </div>
  );
}

function AnswerBox({ q }: { q: PaperQuestion }) {
  return (
    <div className="ml-6 space-y-1 border-l-2 border-success pl-3 text-sm">
      <p>
        <span className="font-bold">Answer: </span>
        <span className="whitespace-pre-line">{q.answer}</span>
      </p>
      <p>
        <span className="font-bold">Marking scheme: </span>
        <span className="whitespace-pre-line">{q.markingScheme}</span>
      </p>
      {q.alternative && (
        <>
          <p>
            <span className="font-bold">Answer (OR): </span>
            <span className="whitespace-pre-line">{q.alternative.answer}</span>
          </p>
          {q.alternative.markingScheme && (
            <p>
              <span className="font-bold">Marking scheme (OR): </span>
              <span className="whitespace-pre-line">{q.alternative.markingScheme}</span>
            </p>
          )}
        </>
      )}
      <p className="text-xs text-muted">
        {q.unit} · {q.competency}
      </p>
    </div>
  );
}

/** Print: the answer key on its own pages. */
function AnswerKey({ paper }: { paper: Paper }) {
  return (
    <section aria-labelledby="qp-answer-key" className="space-y-4">
      <h2 id="qp-answer-key" className="font-display text-xl font-black">
        Answer key & marking scheme
      </h2>
      {paper.sections.map((s, si) => (
        <div key={si} className="space-y-2">
          <h3 className="font-display font-extrabold">{s.name}</h3>
          <ol className="space-y-2">
            {s.questions.map((q) => (
              <li key={q.number} className="break-inside-avoid text-sm">
                <span className="font-bold">{q.number}. </span>
                {q.options.length > 0 && q.correctIndex >= 0 && <span className="font-bold">({letter(q.correctIndex)}) </span>}
                <span className="whitespace-pre-line">{q.answer}</span>
                <p className="text-ink-2">
                  <span className="font-bold">Marking scheme: </span>
                  {q.markingScheme}
                </p>
                {q.alternative && (
                  <p className="text-ink-2">
                    <span className="font-bold">OR: </span>
                    {q.alternative.answer} {q.alternative.markingScheme && `(${q.alternative.markingScheme})`}
                  </p>
                )}
                <p className="text-xs text-muted">
                  {BLOOM_LABEL[q.bloomLevel]} · {q.difficulty} · {q.unit}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

/* ---------------------------------- inline editing ---------------------------------- */

function QuestionEditor({ question: q, onChange, onDone }: { question: PaperQuestion; onChange: (q: PaperQuestion) => void; onDone: () => void }) {
  const set = (patch: Partial<PaperQuestion>) => onChange({ ...q, ...patch });
  const radioName = useId();
  const [marks, setMarks] = useState(String(q.marks));
  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-black">Editing question {q.number}</p>
        <Button size="sm" variant="secondary" icon={<X className="size-3.5" aria-hidden />} onClick={onDone}>
          Done editing
        </Button>
      </div>
      <Field label={`Question ${q.number} text`}>
        {(p) => <Textarea {...p} rows={3} value={q.text} onChange={(e) => set({ text: e.target.value })} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={`Question ${q.number} marks`} hint="The totals check updates as you edit.">
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="decimal"
              min={0.5}
              max={20}
              step={0.5}
              value={marks}
              onChange={(e) => {
                setMarks(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0.5 && n <= 20) set({ marks: Math.round(n * 2) / 2 });
              }}
            />
          )}
        </Field>
        <Field label="Bloom level">
          {(p) => (
            <Select {...p} value={q.bloomLevel} onChange={(e) => set({ bloomLevel: e.target.value as BloomLevel })}>
              {BLOOM_LEVELS.map((b) => (
                <option key={b} value={b}>
                  {BLOOM_LABEL[b]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Difficulty">
          {(p) => (
            <Select {...p} value={q.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          )}
        </Field>
      </div>
      {q.options.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-bold text-ink-2">Options — select the correct answer</legend>
          {q.options.map((o, i) => (
            <div key={i} className="flex items-end gap-3">
              <label className="mb-3 inline-flex shrink-0 items-center gap-1.5 text-xs font-bold">
                <input
                  type="radio"
                  name={radioName}
                  className="size-4 accent-[var(--cp-ink)]"
                  checked={q.correctIndex === i}
                  onChange={() => set({ correctIndex: i })}
                  aria-label={`Option ${letter(i)} is correct`}
                />
                Correct
              </label>
              <Field label={`Option ${letter(i)}`} className="flex-1">
                {(p) => <Input {...p} value={o} onChange={(e) => set({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })} />}
              </Field>
            </div>
          ))}
        </fieldset>
      )}
      <Field label={`Question ${q.number} answer`}>
        {(p) => <Textarea {...p} rows={2} value={q.answer} onChange={(e) => set({ answer: e.target.value })} />}
      </Field>
      <Field label={`Question ${q.number} marking scheme`}>
        {(p) => <Textarea {...p} rows={2} value={q.markingScheme} onChange={(e) => set({ markingScheme: e.target.value })} />}
      </Field>
      {q.alternative && (
        <div className="space-y-3 border-t border-line pt-3">
          <p className="text-xs font-bold text-ink-2">Internal choice (OR)</p>
          <Field label={`Question ${q.number} alternative text`}>
            {(p) => <Textarea {...p} rows={2} value={q.alternative!.text} onChange={(e) => set({ alternative: { ...q.alternative!, text: e.target.value } })} />}
          </Field>
          <Field label={`Question ${q.number} alternative answer`}>
            {(p) => (
              <Textarea {...p} rows={2} value={q.alternative!.answer} onChange={(e) => set({ alternative: { ...q.alternative!, answer: e.target.value } })} />
            )}
          </Field>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------- publish as exam ---------------------------------- */

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

function PublishExamDialog({ resourceId, paper, mcqs, onClose }: { resourceId: string; paper: Paper; mcqs: number; onClose: () => void }) {
  const sections = useTeacherSections();
  const formId = useId();
  const [sectionId, setSectionId] = useState('');
  const [opensAt, setOpensAt] = useState(() => toLocalInput(inMinutes(60)));
  const [closesAt, setClosesAt] = useState(() => toLocalInput(inMinutes(24 * 60)));
  const [duration, setDuration] = useState(String(Math.min(600, paper.header.durationMin)));
  const [perStudent, setPerStudent] = useState(String(mcqs));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const publish = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<PublishPaperExamResult>(`/resources/${resourceId}/publish-exam`, body),
  });
  const fe = { ...(publish.error instanceof ApiError ? publish.error.fieldErrors : {}), ...errors };
  const total = paper.sections.reduce((s, x) => s + x.questions.length, 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const opens = fromLocalInput(opensAt);
    const closes = fromLocalInput(closesAt);
    const d = Number(duration);
    const n = Number(perStudent);
    if (!sectionId) errs.sectionId = 'Choose a section';
    if (!opens) errs.opensAt = 'Choose when the exam opens';
    if (!closes) errs.closesAt = 'Choose when the exam closes';
    else if (opens && Date.parse(closes) <= Date.parse(opens)) errs.closesAt = 'The exam must close after it opens';
    if (!Number.isInteger(d) || d < 1 || d > 600) errs.durationMin = 'Enter 1–600 minutes';
    if (!Number.isInteger(n) || n < 1 || n > mcqs) errs.questionsPerStudent = `Enter 1–${mcqs}`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    publish.mutate({ sectionId, opensAt: opens, closesAt: closes, durationMin: d, questionsPerStudent: n });
  }

  const done = publish.data;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Publish MCQs as a secure exam"
      description={`${mcqs} of ${total} questions are multiple choice and go into the exam; written-answer questions are left out. Uses the last saved version of the paper.`}
      footer={
        done ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <ButtonLink href={`/teacher/exams/${done.examId}`}>Review exam settings</ButtonLink>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={publish.isPending}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={publish.isPending}>
              Create draft exam
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div role="status" className="space-y-2 text-sm">
          <p className="font-bold">
            Draft exam created with {done.mcqCount} multiple-choice question{done.mcqCount === 1 ? '' : 's'}
            {done.skipped ? ` (${done.skipped} written-answer question${done.skipped === 1 ? '' : 's'} skipped)` : ''}.
          </p>
          <p className="text-muted">Review the window and security settings, then publish it from the exam editor.</p>
        </div>
      ) : (
        <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Section" required error={fe.sectionId}>
            {(p) => (
              <Select {...p} value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={sections.isPending}>
                <option value="">{sections.isPending ? 'Loading sections…' : 'Choose a section'}</option>
                {(sections.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opens at" required error={fe.opensAt}>
              {(p) => <Input {...p} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />}
            </Field>
            <Field label="Closes at" required error={fe.closesAt}>
              {(p) => <Input {...p} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />}
            </Field>
            <Field label="Duration (minutes)" required error={fe.durationMin}>
              {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} />}
            </Field>
            <Field label="Questions per student" hint={`Up to ${mcqs}; each student gets a random sample.`} error={fe.questionsPerStudent}>
              {(p) => (
                <Input {...p} type="number" inputMode="numeric" min={1} max={mcqs} value={perStudent} onChange={(e) => setPerStudent(e.target.value)} />
              )}
            </Field>
          </div>
          {sections.isError && <InlineError error={sections.error} />}
          <InlineError error={publish.error && !(publish.error instanceof ApiError && Object.keys(publish.error.fieldErrors).length) ? publish.error : null} />
        </form>
      )}
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------
 * OptionsFields (generate form)
 * ------------------------------------------------------------------------- */

const SECTION_TYPES = Object.keys(TYPE_LABEL) as QType[];

/** A number input that keeps what the teacher types and reports valid values (clamped on blur). */
function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  hint,
  error,
  onChange,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  error?: string | null;
  onChange: (n: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    // The value changed from outside (e.g. "Use these totals"): show it.
    setLast(value);
    setText(String(value));
  }
  const valid = (n: number) => Number.isFinite(n) && n >= min && n <= max && Math.abs(n / step - Math.round(n / step)) < 1e-9;
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => (
        <Input
          {...p}
          type="number"
          inputMode={step < 1 ? 'decimal' : 'numeric'}
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && valid(n)) {
              setLast(n);
              onChange(n);
            }
          }}
          onBlur={() => {
            const n = Number(text);
            const clamped = Number.isFinite(n) && text !== '' ? Math.min(max, Math.max(min, Math.round(n / step) * step)) : value;
            setText(String(clamped));
            setLast(clamped);
            if (clamped !== value) onChange(clamped);
          }}
        />
      )}
    </Field>
  );
}

const nextSectionName = (sections: SectionSpec[]) => String.fromCharCode(65 + Math.min(sections.length, 25));

export function OptionsFields({ value, onChange }: OptionsFieldsProps) {
  const current = QuestionPaperOptions.safeParse(value && typeof value === 'object' ? value : {});
  const opts: Options = current.success ? current.data : QuestionPaperOptions.parse({});
  const emit = (next: Partial<Options>) => onChange({ type: 'question_paper', ...opts, ...next });

  // Make sure the parent holds a FULL options object from the start.
  const raw = value as Record<string, unknown> | null | undefined;
  const incomplete = !raw || raw.type !== 'question_paper' || ['examName', 'maxMarks', 'durationMin', 'sections', 'bloomMix', 'difficultyMix'].some((k) => raw[k] === undefined);
  useEffect(() => {
    if (incomplete) onChange({ type: 'question_paper', ...opts });
    // Runs only when the parent's value is incomplete (opts is derived from it).
  }, [incomplete]);

  const custom = opts.sections.length > 0;
  const sectionsTotal = round2(opts.sections.reduce((s, x) => s + x.count * x.marksEach, 0));
  const totalsOk = !custom || sectionsTotal === opts.maxMarks;
  const setSection = (i: number, patch: Partial<SectionSpec>) => emit({ sections: opts.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const bloomTotal = BLOOM_LEVELS.reduce((s, b) => s + (opts.bloomMix[b] ?? 0), 0);
  const diffTotal = opts.difficultyMix.easy + opts.difficultyMix.medium + opts.difficultyMix.hard;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Exam name">
          {(p) => <Input {...p} maxLength={120} value={opts.examName} onChange={(e) => emit({ examName: e.target.value })} />}
        </Field>
        <NumberField label="Maximum marks" value={opts.maxMarks} min={5} max={200} onChange={(n) => emit({ maxMarks: n })} />
        <NumberField label="Duration (minutes)" value={opts.durationMin} min={10} max={300} onChange={(n) => emit({ durationMin: n })} />
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-bold text-ink-2">Sections</legend>
        <Checkbox
          label="Use a standard board pattern for the level (CBSE-style sections A–E for school, Parts A–C for college)"
          checked={!custom}
          onChange={(e) =>
            emit({
              sections: e.target.checked ? [] : [{ name: 'A', type: 'mcq', count: Math.min(50, opts.maxMarks), marksEach: 1, internalChoice: false }],
            })
          }
        />
        {custom && (
          <div className="space-y-3">
            {opts.sections.map((s, i) => (
              <div key={i} className="grid grid-cols-2 items-end gap-3 rounded-control border border-line p-3 sm:grid-cols-[6rem_1fr_6rem_6rem_auto_auto]">
                <Field label={`Section ${i + 1} name`}>
                  {(p) => <Input {...p} maxLength={40} value={s.name} onChange={(e) => setSection(i, { name: e.target.value })} />}
                </Field>
                <Field label={`Section ${i + 1} question type`}>
                  {(p) => (
                    <Select {...p} value={s.type} onChange={(e) => setSection(i, { type: e.target.value as QType })}>
                      {SECTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <NumberField label={`Section ${i + 1} questions`} value={s.count} min={1} max={50} onChange={(n) => setSection(i, { count: n })} />
                <NumberField
                  label={`Section ${i + 1} marks each`}
                  value={s.marksEach}
                  min={0.5}
                  max={20}
                  step={0.5}
                  onChange={(n) => setSection(i, { marksEach: n })}
                />
                <div className="pb-2">
                  <Checkbox
                    label={<span className="text-xs font-bold">Internal choice</span>}
                    aria-label={`Section ${i + 1} internal choice`}
                    checked={s.internalChoice}
                    onChange={(e) => setSection(i, { internalChoice: e.target.checked })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-1"
                  icon={<Trash2 className="size-4" aria-hidden />}
                  aria-label={`Remove section ${i + 1}`}
                  onClick={() => emit({ sections: opts.sections.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="size-3.5" aria-hidden />}
                disabled={opts.sections.length >= 8}
                onClick={() =>
                  emit({ sections: [...opts.sections, { name: nextSectionName(opts.sections), type: 'short', count: 2, marksEach: 2, internalChoice: false }] })
                }
              >
                Add section
              </Button>
              <p role="status" className={clsx('text-sm font-bold', totalsOk ? 'text-success' : 'text-danger')}>
                Sections total {sectionsTotal} of {opts.maxMarks} marks
              </p>
              {!totalsOk && sectionsTotal >= 5 && sectionsTotal <= 200 && Number.isInteger(sectionsTotal) && (
                <Button size="sm" variant="ghost" onClick={() => emit({ maxMarks: sectionsTotal })}>
                  Set maximum marks to {sectionsTotal}
                </Button>
              )}
            </div>
            {!totalsOk && <p className="text-xs font-semibold text-danger">The sections must add up exactly to the maximum marks.</p>}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-bold text-ink-2">Bloom level mix (% of marks, approximate)</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {BLOOM_LEVELS.map((b) => (
            <NumberField
              key={b}
              label={`${BLOOM_LABEL[b]} %`}
              value={opts.bloomMix[b] ?? 0}
              min={0}
              max={100}
              onChange={(n) => {
                const next = { ...opts.bloomMix, [b]: n };
                if (!n) delete next[b];
                emit({ bloomMix: next });
              }}
            />
          ))}
        </div>
        <p className={clsx('text-xs', bloomTotal === 0 || bloomTotal === 100 ? 'text-muted' : 'font-semibold text-warning')}>
          {bloomTotal === 0 ? 'All zero: a balanced mix is used.' : `Total ${bloomTotal}%${bloomTotal === 100 ? '' : ' — shares are scaled to 100%.'}`}
        </p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-bold text-ink-2">Difficulty mix (% of marks, approximate)</legend>
        <div className="grid grid-cols-3 gap-3">
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <NumberField
              key={d}
              label={`${d[0]!.toUpperCase()}${d.slice(1)} %`}
              value={opts.difficultyMix[d]}
              min={0}
              max={100}
              onChange={(n) => emit({ difficultyMix: { ...opts.difficultyMix, [d]: n } })}
            />
          ))}
        </div>
        <p className={clsx('text-xs', diffTotal === 100 ? 'text-muted' : 'font-semibold text-warning')}>
          Total {diffTotal}%{diffTotal === 100 ? '' : ' — shares are scaled to 100%.'}
        </p>
      </fieldset>
    </div>
  );
}
