'use client';
import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui';

/** A labelled, scrollable multi-select of checkboxes. */
export function CheckList<T extends { id: string }>({
  legend,
  items,
  selected,
  onChange,
  render,
  empty,
  max,
}: {
  legend: string;
  items: T[];
  selected: string[];
  onChange: (ids: string[]) => void;
  render: (item: T) => ReactNode;
  empty: ReactNode;
  max?: number;
}) {
  const full = max !== undefined && selected.length >= max;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-bold text-ink-2">
        {legend}
        {selected.length > 0 && <span className="ml-1 font-normal text-muted">({selected.length} selected)</span>}
      </legend>
      {items.length === 0 ? (
        <div className="border border-dashed border-line px-3 py-3 text-xs text-muted rounded-control">{empty}</div>
      ) : (
        <div className="max-h-52 space-y-1.5 overflow-y-auto border border-line px-3 py-2 rounded-control">
          {items.map((item) => {
            const checked = selected.includes(item.id);
            return (
              <div key={item.id}>
                <Checkbox
                  label={render(item)}
                  checked={checked}
                  disabled={!checked && full}
                  onChange={(e) => onChange(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))}
                />
              </div>
            );
          })}
        </div>
      )}
      {full && <p className="text-xs text-muted">You can choose up to {max}.</p>}
    </fieldset>
  );
}
