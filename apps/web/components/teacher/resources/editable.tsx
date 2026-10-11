'use client';
import clsx from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';

/**
 * Inline-editing building blocks for resource Viewers: plain text when read-only (screen or print),
 * a labelled input/textarea when editable. Labels become accessible names (aria-label).
 */
export function EditableText({
  value,
  onChange,
  editable,
  label,
  multiline,
  className,
  rows = 3,
}: {
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  label: string;
  multiline?: boolean;
  className?: string;
  rows?: number;
}) {
  if (!editable || !onChange) return <p className={clsx('whitespace-pre-line', className)}>{value || '—'}</p>;
  return multiline ? (
    <Textarea aria-label={label} value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className={className} />
  ) : (
    <Input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={className} />
  );
}

export function EditableNumber({
  value,
  onChange,
  editable,
  label,
  min = 0,
  suffix,
}: {
  value: number;
  onChange?: (value: number) => void;
  editable?: boolean;
  label: string;
  min?: number;
  suffix?: string;
}) {
  if (!editable || !onChange)
    return (
      <span className="tabular-nums">
        {value}
        {suffix ? ` ${suffix}` : ''}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5">
      <Input
        type="number"
        aria-label={label}
        min={min}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? min : Number(e.target.value))}
        className="h-8 w-20"
      />
      {suffix && <span className="text-xs text-muted">{suffix}</span>}
    </span>
  );
}

/** A bulleted list of strings; editable mode adds per-item inputs with remove buttons and an "Add" button. */
export function EditableList({
  items,
  onChange,
  editable,
  label,
  ordered,
}: {
  items: string[];
  onChange?: (items: string[]) => void;
  editable?: boolean;
  label: string;
  ordered?: boolean;
}) {
  if (!editable || !onChange) {
    if (!items.length) return <p className="text-sm text-muted">—</p>;
    const List = ordered ? 'ol' : 'ul';
    return (
      <List className={clsx('space-y-1 pl-5 text-sm', ordered ? 'list-decimal' : 'list-disc')}>
        {items.map((item, i) => (
          <li key={i} className="whitespace-pre-line">
            {item}
          </li>
        ))}
      </List>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <Input
            aria-label={`${label} ${i + 1}`}
            value={item}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => onChange([...items, ''])}>
        Add {label.toLowerCase()}
      </Button>
    </div>
  );
}

/** Section heading used by the Viewers (keeps the print layout tidy). */
export function ViewerSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('break-inside-avoid-page', className)}>
      <h3 className="mb-2 font-display text-base font-extrabold">{title}</h3>
      {children}
    </section>
  );
}
