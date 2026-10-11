'use client';
import { useState } from 'react';
import type { CompetencyInsightRow, SectionInsights } from '@classpulse/shared';
import { Table, TBody, TD, TH, THead, TR, Tabs } from '@/components/ui';
import { BLOOM_LABEL, Legend, MasteryCell, levelsWithData } from './common';

type View = 'bloom' | 'topic';

/** Students × Bloom levels (or topics), each cell coloured by mastery band with its value as text. */
export function StudentHeatmap({ insights, onSelect }: { insights: SectionInsights; onSelect: (row: CompetencyInsightRow) => void }) {
  const [view, setView] = useState<View>('bloom');
  const levels = levelsWithData([insights.byBloom]);
  const topics = insights.byTopic.map((t) => t.topic);
  const columns = view === 'bloom' ? levels.map((b) => ({ key: b, label: BLOOM_LABEL[b] })) : topics.map((t) => ({ key: t, label: t }));

  return (
    <div className="space-y-3">
      <Tabs
        label="Heatmap columns"
        value={view}
        onChange={setView}
        tabs={[
          { value: 'bloom', label: 'By Bloom level', count: levels.length },
          { value: 'topic', label: 'By topic', count: topics.length },
        ]}
      />
      <Legend />
      {columns.length === 0 ? (
        <p className="text-sm text-muted">{view === 'bloom' ? 'No answered questions carry a Bloom level yet.' : 'No topics yet.'}</p>
      ) : (
        <Table aria-label={view === 'bloom' ? 'Student mastery by Bloom level' : 'Student mastery by topic'}>
          <THead>
            <TR>
              <TH className="sticky left-0 z-10 bg-surface">Student</TH>
              <TH className="text-center">Overall</TH>
              {columns.map((c) => (
                <TH key={c.key} className="min-w-24 text-center">
                  {c.label}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {insights.students.map((row) => (
              <TR key={row.student.id}>
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className="min-h-6 text-left text-sm font-bold underline-offset-4 hover:underline"
                    aria-label={`Details for ${row.student.name}`}
                  >
                    {row.student.name}
                  </button>
                  {row.student.rollNumber && <span className="block text-xs text-muted">{row.student.rollNumber}</span>}
                </th>
                <TD className="px-2 py-2">
                  <MasteryCell value={row.overallPct} />
                </TD>
                {columns.map((c) => (
                  <TD key={c.key} className="px-2 py-2">
                    <MasteryCell value={view === 'bloom' ? row.byBloom[c.key as keyof typeof row.byBloom] : row.byTopic[c.key]} />
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
