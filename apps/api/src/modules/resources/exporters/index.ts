/**
 * Exporter registry: one downloadable format per resource type. Each exporter module exports
 * `exportFile(input: ExportInput): Promise<ExportedFile>` (see types.ts).
 */
import type { ResourceType } from '@classiq/shared';
import type { ExportFormat, ResourceExporter } from './types.js';
import { exportFile as lessonPlan } from './lessonPlan.js';
import { exportFile as worksheet } from './worksheet.js';
import { exportFile as questionPaper } from './questionPaper.js';
import { exportFile as presentation } from './presentation.js';

export * from './types.js';

export const exporters: Record<ResourceType, { format: ExportFormat; exportFile: ResourceExporter }> = {
  lesson_plan: { format: 'docx', exportFile: lessonPlan },
  worksheet: { format: 'docx', exportFile: worksheet },
  question_paper: { format: 'docx', exportFile: questionPaper },
  presentation: { format: 'pptx', exportFile: presentation },
};
