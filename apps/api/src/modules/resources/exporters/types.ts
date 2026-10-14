/**
 * Contract between GET /api/resources/:id/export(.docx|.pptx) and the per-type exporters.
 * Each resource type has ONE downloadable format (Word for lesson plans, worksheets and question papers;
 * PowerPoint for presentations). PDF is the browser print page (/teacher/resources/[id]/print).
 */
import type { Language, ResourceOptions, ResourceType } from '@classiq/shared';

export const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PPTX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export type ExportFormat = 'docx' | 'pptx';

/** What an exporter receives: the resource's saved (teacher-edited) content plus its context. */
export interface ExportInput {
  type: ResourceType;
  title: string;
  /** Saved content; validate it with the type's zod schema (it was validated on save). */
  content: unknown;
  options: ResourceOptions;
  language: Language;
  course: { title: string; level: string | null; board: string | null; subject: string | null } | null;
  teacherName: string;
}

export interface ExportedFile {
  buffer: Buffer;
  /** Download file name including the extension, e.g. "Photosynthesis-worksheet.docx". */
  filename: string;
  contentType: string;
}

export type ResourceExporter = (input: ExportInput) => Promise<ExportedFile>;

/** "Light & Shadow: worksheet" → "Light-Shadow-worksheet.docx" (ASCII-safe; the route also sends the UTF-8 name). */
export function safeFilename(title: string, ext: ExportFormat, fallback = 'resource'): string {
  const base = title
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${base || fallback}.${ext}`;
}
