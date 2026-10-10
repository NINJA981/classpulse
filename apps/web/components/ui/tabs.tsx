'use client';
import clsx from 'clsx';

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-line overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={clsx(
            '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold',
            t.value === value ? 'border-line-strong text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
