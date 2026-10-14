/**
 * Word export for question papers: the paper (header, time and marks, general instructions, sections with
 * marks per question, "OR" internal choices), then on a new page the answer key & marking scheme and the
 * blueprint (marks by unit × Bloom level) for the teacher.
 */
import { AlignmentType, Paragraph, TextRun } from 'docx';
import { BLOOM_LEVELS, QuestionPaperContent, type BloomLevel, type PaperQuestion } from '@classiq/shared';
import { invalidState } from '../../../lib/errors.js';
import { heading, numbered, pageBreak, para, table, toDocxBuffer, type Block } from './docx.js';
import { DOCX_CONTENT_TYPE, safeFilename, type ExportInput, type ExportedFile } from './types.js';

const letter = (i: number) => String.fromCharCode(97 + i);
const marksLabel = (m: number) => `[${m} mark${m === 1 ? '' : 's'}]`;
const BLOOM_LABEL: Record<BloomLevel, string> = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyze: 'Analyse',
  evaluate: 'Evaluate',
  create: 'Create',
};

const centered = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text, bold: opts.bold, size: opts.size })] });

function questionBlocks(q: PaperQuestion): Block[] {
  const out: Block[] = [para(`${q.number}. ${q.text}  ${marksLabel(q.marks)}`)];
  if (q.options.length) out.push(para(q.options.map((o, i) => `(${letter(i)}) ${o}`).join('\n')));
  if (q.alternative) {
    out.push(centered('OR', { bold: true }));
    out.push(para(q.alternative.text));
  }
  return out;
}

function answerBlocks(q: PaperQuestion): Block[] {
  const answer = q.options.length && q.correctIndex >= 0 ? `(${letter(q.correctIndex)}) ${q.options[q.correctIndex] ?? ''}. ${q.answer}` : q.answer;
  const out: Block[] = [
    para(`${q.number}. ${answer}`, { bold: false }),
    para(q.markingScheme, { label: 'Marking scheme', size: 20 }),
    para(`${BLOOM_LABEL[q.bloomLevel]} · ${q.difficulty} · ${q.unit}${q.competency ? ` · ${q.competency}` : ''}`, { italics: true, size: 18 }),
  ];
  if (q.alternative) {
    out.push(para(q.alternative.answer, { label: `${q.number} (OR)` }));
    if (q.alternative.markingScheme) out.push(para(q.alternative.markingScheme, { label: 'Marking scheme', size: 20 }));
  }
  return out;
}

/** Rows: units; columns: Bloom levels used + total; last row: totals. */
export function blueprintRows(content: QuestionPaperContent): string[][] {
  const qs = content.sections.flatMap((s) => s.questions);
  const levels = BLOOM_LEVELS.filter((b) => qs.some((q) => q.bloomLevel === b));
  const units = [...new Set(qs.map((q) => q.unit || 'General'))];
  const cell = (n: number) => (n ? String(n) : '–');
  const sum = (filter: (q: PaperQuestion) => boolean) => qs.filter(filter).reduce((s, q) => s + q.marks, 0);
  return [
    ['Unit', ...levels.map((b) => BLOOM_LABEL[b]), 'Total'],
    ...units.map((u) => [
      u,
      ...levels.map((b) => cell(sum((q) => (q.unit || 'General') === u && q.bloomLevel === b))),
      String(sum((q) => (q.unit || 'General') === u)),
    ]),
    ['Total', ...levels.map((b) => cell(sum((q) => q.bloomLevel === b))), String(sum(() => true))],
  ];
}

export async function exportFile(input: ExportInput): Promise<ExportedFile> {
  const parsed = QuestionPaperContent.safeParse(input.content);
  if (!parsed.success) throw invalidState('This question paper has no content to download yet.');
  const paper = parsed.data;
  const h = paper.header;
  const subLine = [h.subject, h.level].filter(Boolean).join(' · ');

  const blocks: Block[] = [centered(h.examName, { bold: true, size: 36 })];
  if (subLine) blocks.push(centered(subLine, { size: 24 }));
  blocks.push(table([[`Time allowed: ${h.durationMin} minutes`, `Maximum marks: ${h.maxMarks}`]], [50, 50]));
  blocks.push(para('Name: ______________________    Roll no.: __________    Date: __________'));
  if (h.generalInstructions.length) {
    blocks.push(heading('General instructions', 3));
    blocks.push(...numbered(h.generalInstructions));
  }
  for (const section of paper.sections) {
    blocks.push(heading(section.name));
    if (section.instructions.trim()) blocks.push(para(section.instructions, { italics: true }));
    for (const q of section.questions) blocks.push(...questionBlocks(q));
  }

  blocks.push(pageBreak(), heading('Answer key & marking scheme', 1), para(`${h.examName}${subLine ? ` · ${subLine}` : ''} · ${h.maxMarks} marks`, { italics: true }));
  for (const section of paper.sections) {
    blocks.push(heading(section.name, 3));
    for (const q of section.questions) blocks.push(...answerBlocks(q));
  }
  blocks.push(heading('Blueprint (marks by unit and Bloom level)', 3), table(blueprintRows(paper)));

  return {
    buffer: await toDocxBuffer(input.title, blocks),
    filename: safeFilename(input.title, 'docx', 'question-paper'),
    contentType: DOCX_CONTENT_TYPE,
  };
}
