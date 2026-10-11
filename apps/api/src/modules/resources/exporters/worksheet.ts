/** Word export for worksheets: student pages, then the answer key on a new page (when the worksheet asks for one). */
import { WorksheetContent } from '@classpulse/shared';
import { invalidState } from '../../../lib/errors.js';
import { headerBlock, heading, pageBreak, para, toDocxBuffer, type Block } from './docx.js';
import { DOCX_CONTENT_TYPE, safeFilename, type ExportInput, type ExportedFile } from './types.js';

const letter = (i: number) => String.fromCharCode(97 + i);
const marksLabel = (m: number) => `[${m} mark${m === 1 ? '' : 's'}]`;

export async function exportFile(input: ExportInput): Promise<ExportedFile> {
  const parsed = WorksheetContent.safeParse(input.content);
  if (!parsed.success) throw invalidState('This worksheet has no content to download yet.');
  const w = parsed.data;
  const withKey = input.options.type === 'worksheet' ? input.options.includeAnswerKey : true;
  const total = w.sections.reduce((sum, s) => sum + s.items.reduce((t, i) => t + i.marks, 0), 0);

  const blocks: Block[] = [...headerBlock(input, `Worksheet · ${total} marks`)];
  blocks.push(para('Name: ______________________    Class: __________    Date: __________'));
  if (w.instructions.trim()) blocks.push(para(w.instructions, { italics: true }));
  for (const section of w.sections) {
    blocks.push(heading(section.title));
    for (const item of section.items) {
      blocks.push(para(`${item.number}. ${item.prompt}  ${marksLabel(item.marks)}`));
      if (item.options.length) blocks.push(para(item.options.map((o, i) => `(${letter(i)}) ${o}`).join('\n')));
      if (item.type === 'short' || item.type === 'long') {
        const lines = item.type === 'long' ? 6 : 2;
        blocks.push(para(Array.from({ length: lines }, () => '_'.repeat(70)).join('\n')));
      }
    }
  }
  if (withKey) {
    blocks.push(pageBreak(), heading('Answer key', 1));
    for (const section of w.sections) {
      blocks.push(heading(section.title, 3));
      for (const item of section.items) blocks.push(para(`${item.number}. ${item.answer}`));
    }
  }
  return { buffer: await toDocxBuffer(input.title, blocks), filename: safeFilename(input.title, 'docx', 'worksheet'), contentType: DOCX_CONTENT_TYPE };
}
