'use client';
import { useQuery } from '@tanstack/react-query';
import { FileText, ListChecks, NotebookPen, Presentation } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ResourceOptions, type ResourceDetail, type ResourceStatus, type ResourceType } from '@classpulse/shared';
import { Badge, type BadgeTone } from '@/components/ui';
import { api } from '@/lib/api';

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  lesson_plan: 'Lesson plan',
  worksheet: 'Worksheet',
  question_paper: 'Question paper',
  presentation: 'Presentation',
};

export const RESOURCE_TYPE_INFO: Record<ResourceType, { description: string; icon: LucideIcon }> = {
  lesson_plan: { description: 'Objectives, a timed lesson flow, assessment and homework.', icon: NotebookPen },
  worksheet: { description: 'Practice items of the types you choose, with an answer key.', icon: ListChecks },
  question_paper: { description: 'A blueprint-based exam paper with marking scheme.', icon: FileText },
  presentation: { description: 'Slides with speaker notes, ready for class.', icon: Presentation },
};

/** The one download format per type (served by GET /api/resources/:id/export). */
export const RESOURCE_DOWNLOAD: Record<ResourceType, { label: string; ext: 'docx' | 'pptx' }> = {
  lesson_plan: { label: 'Download Word', ext: 'docx' },
  worksheet: { label: 'Download Word', ext: 'docx' },
  question_paper: { label: 'Download Word', ext: 'docx' },
  presentation: { label: 'Download PowerPoint', ext: 'pptx' },
};

/** Default options of a type (the shared zod defaults). */
export const defaultOptions = (type: ResourceType): ResourceOptions => ResourceOptions.parse({ type });

const STATUS: Record<ResourceStatus, { label: string; tone: BadgeTone }> = {
  queued: { label: 'Queued', tone: 'info' },
  generating: { label: 'Generating', tone: 'warning' },
  ready: { label: 'Ready', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};

export function ResourceStatusBadge({ status }: { status: ResourceStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

export const isProcessing = (status: ResourceStatus) => status === 'queued' || status === 'generating';

/** A resource, polled every 3 s while it is queued or generating. */
export function useResource(id: string) {
  return useQuery({
    queryKey: ['resources', id],
    queryFn: () => api.get<ResourceDetail>(`/resources/${id}`),
    refetchInterval: (q) => (q.state.data && isProcessing(q.state.data.status) ? 3_000 : false),
  });
}
