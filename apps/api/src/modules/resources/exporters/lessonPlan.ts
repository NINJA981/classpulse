/** Word export for lesson plans. */
import { LessonPlanContent } from '@classiq/shared';
import { invalidState } from '../../../lib/errors.js';
import { bullets, headerBlock, heading, para, table, toDocxBuffer, type Block } from './docx.js';
import { DOCX_CONTENT_TYPE, safeFilename, type ExportInput, type ExportedFile } from './types.js';

export async function exportFile(input: ExportInput): Promise<ExportedFile> {
  const parsed = LessonPlanContent.safeParse(input.content);
  if (!parsed.success) throw invalidState('This lesson plan has no content to download yet.');
  const p = parsed.data;

  const blocks: Block[] = [...headerBlock(input, `Lesson plan · ${p.level} · ${p.durationMin} minutes`)];
  blocks.push(heading('Overview'), para(p.overview));
  if (p.objectives.length) blocks.push(heading('Learning objectives'), ...bullets(p.objectives));
  if (p.prerequisites.length) blocks.push(heading('Prerequisites'), ...bullets(p.prerequisites));
  if (p.materials.length) blocks.push(heading('Materials'), ...bullets(p.materials));

  blocks.push(heading('Lesson flow'));
  blocks.push(
    table(
      [
        ['Time', 'Stage & activity', 'Teacher notes', 'Student task'],
        ...p.sections.map((s) => [`${s.durationMin} min`, `${s.title}\n${s.activity}`, s.teacherNotes, s.studentTask]),
      ],
      [10, 40, 25, 25],
    ),
  );
  if (p.assessment.length) blocks.push(heading('Assessment'), ...bullets(p.assessment));
  if (p.homework.trim()) blocks.push(heading('Homework'), para(p.homework));
  blocks.push(heading('Differentiation'), para(p.differentiation.support, { label: 'Support' }), para(p.differentiation.extension, { label: 'Extension' }));

  return { buffer: await toDocxBuffer(input.title, blocks), filename: safeFilename(input.title, 'docx', 'lesson-plan'), contentType: DOCX_CONTENT_TYPE };
}
