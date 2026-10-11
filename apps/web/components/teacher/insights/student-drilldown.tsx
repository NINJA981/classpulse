'use client';
import { masteryBand, type CompetencyInsightRow } from '@classpulse/shared';
import { Button, Dialog } from '@/components/ui';
import { formatPct } from '@/lib/format';
import { BLOOM_LABEL, BLOOM_LEVELS, BandBadge } from './common';

function Row({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="text-sm">{label}</span>
      <span className="inline-flex items-center gap-2">
        <span className="text-sm font-bold tabular-nums">{value == null ? 'No answers' : formatPct(value)}</span>
        {value != null && <BandBadge band={masteryBand(value)} />}
      </span>
    </li>
  );
}

/** One student's mastery: Bloom levels, topics (weakest first) and the topics to revisit. */
export function StudentDrilldown({ row, onClose }: { row: CompetencyInsightRow | null; onClose: () => void }) {
  const topics = row
    ? Object.entries(row.byTopic)
        .filter((e): e is [string, number] => e[1] != null)
        .sort((a, b) => a[1] - b[1])
    : [];
  const focus = topics.filter(([, v]) => v < 50).map(([t]) => t);
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      size="lg"
      title={row ? row.student.name : 'Student'}
      description={row ? `Overall ${formatPct(row.overallPct)}${row.student.rollNumber ? ` · Roll ${row.student.rollNumber}` : ''}` : undefined}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {row && (
        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="drill-bloom">
            <h3 id="drill-bloom" className="eyebrow mb-1">
              By Bloom level
            </h3>
            <ul>
              {BLOOM_LEVELS.map((b) => (
                <Row key={b} label={BLOOM_LABEL[b]} value={row.byBloom[b]} />
              ))}
            </ul>
          </section>
          <section aria-labelledby="drill-topic">
            <h3 id="drill-topic" className="eyebrow mb-1">
              By topic (weakest first)
            </h3>
            {topics.length ? (
              <ul>
                {topics.map(([t, v]) => (
                  <Row key={t} label={t} value={v} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No answers yet.</p>
            )}
            {focus.length > 0 && (
              <p className="mt-3 text-sm">
                <span className="font-bold">Revisit: </span>
                {focus.join(', ')}
              </p>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}
