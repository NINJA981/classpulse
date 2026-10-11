'use client';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users } from 'lucide-react';
import { masteryBand, type CompetencyInsightRow, type SectionInsights } from '@classpulse/shared';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { useTeacherSections } from '@/components/teacher/common';
import { BloomChart } from '@/components/teacher/insights/bloom-chart';
import { BandBadge } from '@/components/teacher/insights/common';
import { StudentHeatmap } from '@/components/teacher/insights/heatmap';
import { StudentDrilldown } from '@/components/teacher/insights/student-drilldown';
import { api } from '@/lib/api';
import { formatPct } from '@/lib/format';

export default function InsightsPage() {
  const sections = useTeacherSections();
  const [picked, setPicked] = useState('');
  const sectionId = picked || sections.data?.[0]?.id || '';
  const [selected, setSelected] = useState<CompetencyInsightRow | null>(null);

  const q = useQuery({
    queryKey: ['insights', 'sections', sectionId],
    queryFn: () => api.get<SectionInsights>(`/insights/sections/${sectionId}`),
    enabled: Boolean(sectionId),
  });

  const header = (
    <PageHeader
      eyebrow="Competency insights"
      title="Class mastery"
      description="Accuracy by Bloom level and topic, from each student's latest lesson-quiz attempts and submitted exams."
      actions={
        sections.data && sections.data.length > 0 ? (
          <Field label="Section" className="min-w-56">
            {(p) => (
              <Select {...p} value={sectionId} onChange={(e) => setPicked(e.target.value)}>
                {sections.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : undefined
      }
    />
  );
  const page = (body: ReactNode) => (
    <>
      {header}
      {body}
    </>
  );

  if (sections.isPending) return page(<LoadingBlock label="Loading your sections…" />);
  if (sections.isError) return page(<ErrorState error={sections.error} onRetry={() => sections.refetch()} />);
  if (!sections.data.length) {
    return page(
      <Card>
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title="No sections yet"
          description="Insights appear for the sections you teach. Ask your administrator to add you to a section."
        />
      </Card>,
    );
  }
  if (q.isPending) return page(<LoadingBlock label="Loading insights…" />);
  if (q.isError) return page(<ErrorState error={q.error} onRetry={() => q.refetch()} />);

  const data = q.data;
  if (!data.byTopic.length) {
    return page(
      <Card>
        <EmptyState
          icon={<BarChart3 className="size-8" aria-hidden />}
          title="No answers yet"
          description={`Insights for ${data.section.name} appear once students take a published lesson quiz or a secure exam.`}
        />
      </Card>,
    );
  }

  return page(
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Thinking skills" title="Class accuracy by Bloom level" />
          <CardBody>
            <BloomChart byBloom={data.byBloom} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader eyebrow="Topics" title="Weakest topics first" />
          <CardBody>
            <Table aria-label="Class accuracy by topic">
              <THead>
                <TR>
                  <TH>Topic</TH>
                  <TH className="text-right">Accuracy</TH>
                  <TH>Band</TH>
                  <TH className="text-right">Answers</TH>
                </TR>
              </THead>
              <TBody>
                {data.byTopic.map((t) => (
                  <TR key={t.topic}>
                    <TD className="font-semibold">{t.topic}</TD>
                    <TD className="text-right font-bold tabular-nums">{formatPct(t.accuracyPct)}</TD>
                    <TD>{t.accuracyPct != null && <BandBadge band={masteryBand(t.accuracyPct)} />}</TD>
                    <TD className="text-right tabular-nums">{t.answered}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader eyebrow="Students" title="Mastery heatmap" />
        <CardBody>
          <StudentHeatmap insights={data} onSelect={setSelected} />
        </CardBody>
      </Card>
      <StudentDrilldown row={selected} onClose={() => setSelected(null)} />
    </div>,
  );
}
