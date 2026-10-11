import clsx from 'clsx';
import { Atom, Earth, FlaskConical, Leaf, Link2, Sigma, type LucideIcon } from 'lucide-react';

/** Subjects of the built-in catalog (school links may use any subject). */
export const SIMULATION_SUBJECTS = [
  'Physics',
  'Chemistry',
  'Biology',
  'Mathematics',
  'Earth science',
] as const;

/*
 * Subject colours are an intentional exception to the monochrome staff palette: the teacher asked for
 * coloured subject tiles so a simulation's subject reads at a glance (no external thumbnails are loaded).
 */
const STYLE: Record<string, { icon: LucideIcon; tile: string }> = {
  physics: { icon: Atom, tile: 'bg-sky-100 text-sky-800 border-sky-300' },
  chemistry: { icon: FlaskConical, tile: 'bg-violet-100 text-violet-800 border-violet-300' },
  biology: { icon: Leaf, tile: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  mathematics: { icon: Sigma, tile: 'bg-amber-100 text-amber-800 border-amber-300' },
  'earth science': { icon: Earth, tile: 'bg-teal-100 text-teal-800 border-teal-300' },
};
const OTHER = { icon: Link2, tile: 'bg-surface-2 text-ink-2 border-line' };

export function subjectStyle(subject: string) {
  return STYLE[subject.trim().toLowerCase()] ?? OTHER;
}

/** Coloured subject tile used as the simulation "thumbnail". */
export function SubjectIcon({ subject, size = 'md' }: { subject: string; size?: 'md' | 'lg' }) {
  const { icon: Icon, tile } = subjectStyle(subject);
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center border rounded-control',
        size === 'lg' ? 'size-16' : 'size-11',
        tile,
      )}
      aria-hidden
    >
      <Icon className={size === 'lg' ? 'size-8' : 'size-6'} />
    </span>
  );
}
