'use client';
import { Trash2 } from 'lucide-react';
import { WorksheetContent, WorksheetOptions, type ResourceOptions } from '@classpulse/shared';
import { Badge, Button, Checkbox, Field, Input, Select } from '@/components/ui';
import { EditableList, EditableNumber, EditableText } from '../editable';
import type { OptionsFieldsProps, ViewerProps } from './index';

type Item = WorksheetContent['sections'][number]['items'][number];
type ItemType = Item['type'];
type Opts = Extract<ResourceOptions, { type: 'worksheet' }>;

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  mcq: 'Multiple choice',
  short: 'Short answer',
  long: 'Long answer',
  fill_blank: 'Fill in the blank',
  true_false: 'True / false',
  match: 'Match the following',
};

const letter = (i: number) => String.fromCharCode(97 + i);

/** Read/edit/print view of a worksheet. In print mode the answer key goes on its own page. */
export function Viewer({ resource, editable, onChange, mode = 'screen', showAnswers = true }: ViewerProps) {
  const parsed = WorksheetContent.safeParse(resource.content);
  if (!parsed.success) return <p className="text-sm text-muted">This worksheet has no content yet.</p>;
  const sheet = parsed.data;
  const print = mode === 'print';
  const isEditing = Boolean(editable && !print && onChange);
  const edit = (next: WorksheetContent) => onChange?.(next);
  const setItem = (si: number, ii: number, patch: Partial<Item>) =>
    edit({
      ...sheet,
      sections: sheet.sections.map((s, a) => (a === si ? { ...s, items: s.items.map((it, b) => (b === ii ? { ...it, ...patch } : it)) } : s)),
    });
  const removeItem = (si: number, ii: number) => {
    let n = 0;
    const sections = sheet.sections
      .map((s, a) => (a === si ? { ...s, items: s.items.filter((_, b) => b !== ii) } : s))
      .filter((s) => s.items.length)
      .map((s) => ({ ...s, items: s.items.map((it) => ({ ...it, number: ++n })) }));
    edit({ ...sheet, sections });
  };
  const totalMarks = sheet.sections.reduce((sum, s) => sum + s.items.reduce((t, i) => t + (Number.isFinite(i.marks) ? i.marks : 0), 0), 0);
  const inlineAnswers = showAnswers && !print;

  return (
    <div className="space-y-6 text-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        {print ? <p>Name: ______________________ &nbsp; Class: __________ &nbsp; Date: __________</p> : <span />}
        <span>
          Total: <strong className="text-ink">{totalMarks} marks</strong>
        </span>
      </div>
      <div>
        <p className="eyebrow mb-1">Instructions</p>
        <EditableText label="Instructions" multiline rows={2} value={sheet.instructions} editable={isEditing} onChange={(v) => edit({ ...sheet, instructions: v })} />
      </div>

      {sheet.sections.map((section, si) => (
        <section key={si} className="space-y-3">
          <div className="font-display text-base font-extrabold">
            <EditableText
              label={`Section ${si + 1} title`}
              value={section.title}
              editable={isEditing}
              onChange={(v) => edit({ ...sheet, sections: sheet.sections.map((s, a) => (a === si ? { ...s, title: v } : s)) })}
            />
          </div>
          <ol className="space-y-3">
            {section.items.map((item, ii) => (
              <li key={ii} className={print ? 'break-inside-avoid' : 'border border-line p-4 rounded-card'}>
                <div className="flex items-start gap-3">
                  <span className="pt-0.5 font-bold tabular-nums">{item.number}.</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    {!print && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{ITEM_TYPE_LABEL[item.type]}</Badge>
                        <EditableNumber
                          label={`Question ${item.number} marks`}
                          value={item.marks}
                          min={0}
                          suffix="marks"
                          editable={isEditing}
                          onChange={(v) => setItem(si, ii, { marks: v })}
                        />
                        {isEditing && (
                          <Button variant="ghost" size="sm" className="ml-auto" aria-label={`Remove question ${item.number}`} onClick={() => removeItem(si, ii)}>
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <EditableText
                          label={`Question ${item.number}`}
                          multiline
                          rows={2}
                          value={item.prompt}
                          editable={isEditing}
                          onChange={(v) => setItem(si, ii, { prompt: v })}
                        />
                      </div>
                      {print && <span className="shrink-0 text-xs text-muted">[{item.marks}]</span>}
                    </div>
                    {(item.options.length > 0 || (isEditing && ['mcq', 'true_false', 'match'].includes(item.type))) &&
                      (isEditing ? (
                        <EditableList label={`Question ${item.number} option`} items={item.options} editable onChange={(v) => setItem(si, ii, { options: v })} />
                      ) : (
                        <ul className="grid gap-1 sm:grid-cols-2 print:grid-cols-2">
                          {item.options.map((o, oi) => (
                            <li key={oi}>
                              ({letter(oi)}) {o}
                            </li>
                          ))}
                        </ul>
                      ))}
                    {print && (item.type === 'short' || item.type === 'long') && (
                      <div className={item.type === 'long' ? 'h-40' : 'h-14'} aria-hidden />
                    )}
                    {(inlineAnswers || isEditing) && (
                      <div className="bg-surface-2 px-3 py-2 rounded-control">
                        <p className="eyebrow mb-1">Answer</p>
                        <EditableText
                          label={`Question ${item.number} answer`}
                          multiline
                          rows={2}
                          value={item.answer}
                          editable={isEditing}
                          onChange={(v) => setItem(si, ii, { answer: v })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {print && showAnswers && (
        <section className="break-before-page space-y-3">
          <h3 className="font-display text-lg font-extrabold">Answer key</h3>
          {sheet.sections.map((section, si) => (
            <div key={si} className="break-inside-avoid">
              <p className="mb-1 font-bold">{section.title}</p>
              <ol className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.number} className="whitespace-pre-line">
                    {item.number}. {item.answer}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Number of items, difficulty, item types and whether to include an answer key. */
export function OptionsFields({ value, onChange }: OptionsFieldsProps) {
  const o: Opts = { ...WorksheetOptions.parse({}), ...(value as Partial<Opts> | null), type: 'worksheet' };
  const update = (patch: Partial<Opts>) => onChange({ ...o, ...patch });
  const toggleType = (t: ItemType, on: boolean) => {
    const next = on ? [...new Set([...o.itemTypes, t])] : o.itemTypes.filter((x) => x !== t);
    if (next.length) update({ itemTypes: next });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Number of items" hint="1–60">
          {(p) => (
            <Input
              {...p}
              type="number"
              min={1}
              max={60}
              value={o.itemCount}
              onChange={(e) => update({ itemCount: e.target.value === '' ? 1 : Math.round(Number(e.target.value)) })}
            />
          )}
        </Field>
        <Field label="Difficulty">
          {(p) => (
            <Select {...p} value={o.difficulty} onChange={(e) => update({ difficulty: e.target.value as Opts['difficulty'] })}>
              <option value="mixed">Mixed (easy → hard)</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          )}
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-bold text-ink-2">Item types</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(ITEM_TYPE_LABEL) as ItemType[]).map((t) => (
            <Checkbox key={t} label={ITEM_TYPE_LABEL[t]} checked={o.itemTypes.includes(t)} onChange={(e) => toggleType(t, e.target.checked)} />
          ))}
        </div>
      </fieldset>
      <Checkbox label="Include an answer key" checked={o.includeAnswerKey} onChange={(e) => update({ includeAnswerKey: e.target.checked })} />
    </div>
  );
}
