'use client';
import { Copy, MonitorPlay, Trash2 } from 'lucide-react';
import type { Simulation } from '@classpulse/shared';
import { Badge, Button, Card } from '@/components/ui';
import { SubjectIcon } from './subject-icon';

export function SimulationCard({
  simulation,
  onOpen,
  onCopy,
  onRemove,
}: {
  simulation: Simulation;
  onOpen: () => void;
  onCopy: () => void;
  /** Only for school links (the API allows the teacher who added it). */
  onRemove?: () => void;
}) {
  const s = simulation;
  return (
    <Card className="flex w-full flex-col">
      <div className="flex items-start gap-3 p-4 pb-2">
        <SubjectIcon subject={s.subject} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-extrabold leading-tight">{s.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            {s.subject}
            {s.source === 'school' ? <Badge tone="accent">School link</Badge> : <span>· PhET</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pb-3">
        {s.description && <p className="text-sm text-ink-2">{s.description}</p>}
        {s.topics.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Topics">
            {s.topics.slice(0, 5).map((t) => (
              <li
                key={t}
                className="border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2 rounded-control"
              >
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <Button
          size="sm"
          onClick={onOpen}
          icon={<MonitorPlay className="size-4" aria-hidden />}
          aria-label={`Open in class: ${s.title}`}
        >
          Open in class
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onCopy}
          icon={<Copy className="size-4" aria-hidden />}
          aria-label={`Use in lesson: copy link to ${s.title}`}
        >
          Use in lesson
        </Button>
        {onRemove && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="ml-auto"
            aria-label={`Remove ${s.title}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </Card>
  );
}
