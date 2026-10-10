'use client';
import clsx from 'clsx';
import type { KeyboardEvent, ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Radio group for quiz options. Every option is a real, tabbable <button>;
 * arrow keys also move focus between options. Enter/Space selects.
 */
export function OptionGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
    if (!keys.includes(e.key)) return;
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])'));
    if (radios.length === 0) return;
    const current = radios.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const next = current === -1 ? 0 : (current + step + radios.length) % radios.length;
    e.preventDefault();
    radios[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={clsx('flex flex-col gap-3', className)}>
      {children}
    </div>
  );
}

export type OptionReveal = 'correct' | 'incorrect' | null;

/** Big tap-friendly option. Accessible name is the option text (the letter is decorative). */
export function OptionButton({
  index,
  text,
  checked,
  onSelect,
  disabled,
  reveal = null,
}: {
  index: number;
  text: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  reveal?: OptionReveal;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        'flex min-h-14 w-full items-center gap-3 rounded-control border-2 px-4 py-3 text-left text-base font-semibold transition-[box-shadow,background-color,border-color]',
        'disabled:cursor-not-allowed',
        reveal === 'correct'
          ? 'border-success bg-success-soft'
          : reveal === 'incorrect'
            ? 'border-danger bg-danger-soft'
            : checked
              ? 'border-line-strong bg-accent text-accent-ink shadow-hard'
              : 'border-line bg-surface hover:border-line-strong disabled:opacity-60',
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'grid size-9 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-black',
          checked ? 'border-line-strong bg-surface text-ink' : 'border-line bg-surface-2 text-ink-2',
        )}
      >
        {OPTION_LETTERS[index] ?? index + 1}
      </span>
      <span className="min-w-0 flex-1 break-words">{text}</span>
      {reveal === 'correct' && <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />}
      {reveal === 'incorrect' && <XCircle className="size-5 shrink-0 text-danger" aria-hidden />}
    </button>
  );
}
