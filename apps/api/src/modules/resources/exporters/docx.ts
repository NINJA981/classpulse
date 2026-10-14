/**
 * Small helpers over the `docx` library shared by the Word exporters: a document with a header block
 * (title, course line, teacher), headings, paragraphs that keep line breaks, bullet lists and simple tables.
 * Fonts: Nirmala UI covers every Indian script on Windows/Word; Word falls back per script elsewhere.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ExportInput } from './types.js';

export type Block = Paragraph | Table;

const FONT = 'Nirmala UI';

export function heading(text: string, level: 1 | 2 | 3 = 2): Paragraph {
  const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;
  return new Paragraph({ heading: map[level], spacing: { before: level === 1 ? 0 : 240, after: 120 }, children: [new TextRun({ text, font: FONT })] });
}

/** A paragraph that keeps the author's line breaks. */
export function para(text: string, opts: { bold?: boolean; italics?: boolean; label?: string; size?: number } = {}): Paragraph {
  const lines = text.split(/\r?\n/);
  const runs: TextRun[] = [];
  if (opts.label) runs.push(new TextRun({ text: `${opts.label}: `, bold: true, font: FONT, size: opts.size }));
  lines.forEach((line, i) =>
    runs.push(new TextRun({ text: line, bold: opts.bold, italics: opts.italics, font: FONT, size: opts.size, break: i > 0 ? 1 : undefined })),
  );
  return new Paragraph({ spacing: { after: 120 }, children: runs });
}

export function bullets(items: string[]): Paragraph[] {
  return items.filter((s) => s.trim()).map((item) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: item, font: FONT })] }));
}

export function numbered(items: string[]): Paragraph[] {
  return items
    .filter((s) => s.trim())
    .map((item, i) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${i + 1}. ${item}`, font: FONT })] }));
}

export const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: '999999' };

/** A full-width table; the first row is bold (header). */
export function table(rows: string[][], widthsPct?: number[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, r) =>
        new TableRow({
          tableHeader: r === 0,
          children: cells.map(
            (cell, c) =>
              new TableCell({
                width: widthsPct?.[c] ? { size: widthsPct[c]!, type: WidthType.PERCENTAGE } : undefined,
                borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: cell
                  .split(/\r?\n/)
                  .map((line) => new Paragraph({ children: [new TextRun({ text: line, bold: r === 0, font: FONT, size: 20 })] })),
              }),
          ),
        }),
    ),
  });
}

/** Title + "Course · Level · Board" + "Prepared by …" lines. */
export function headerBlock(input: ExportInput, subtitle?: string): Paragraph[] {
  const c = input.course;
  const courseLine = c ? [c.title, c.level, c.board].filter(Boolean).join(' · ') : '';
  const out = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: input.title, bold: true, size: 36, font: FONT })] }),
  ];
  if (subtitle) out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: subtitle, size: 22, font: FONT })] }));
  if (courseLine) out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: courseLine, size: 20, color: '555555', font: FONT })] }));
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: `Prepared by ${input.teacherName}`, size: 18, color: '777777', font: FONT })],
    }),
  );
  return out;
}

export async function toDocxBuffer(title: string, blocks: Block[]): Promise<Buffer> {
  const doc = new Document({
    title,
    creator: 'ClassIQ',
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: blocks }],
  });
  return Packer.toBuffer(doc);
}
