/**
 * PowerPoint export for presentation resources (pptxgenjs, 16:9 = 10" × 5.625").
 * Three themes matching PresentationOptions.theme; layouts title / bullets / two_column / quote / summary;
 * speaker notes go to the notes pane; every content slide has a footer (course · deck title) and slide number.
 * PDF is produced by the browser print page (the web Viewer prints one slide per page).
 */
import pptxgenModule from 'pptxgenjs';
import { PresentationContent } from '@classpulse/shared';
import { badRequest } from '../../../lib/errors.js';
import { PPTX_CONTENT_TYPE, safeFilename, type ExportedFile, type ExportInput } from './types.js';

type ThemeName = PresentationContent['theme'];
type Slide = PresentationContent['slides'][number];
/**
 * pptxgenjs ships CommonJS-style typings, so under NodeNext the default import is typed as the module namespace
 * (`.default` is the class) while the ESM build exports the class itself. Accept both shapes.
 */
type PptxCtor = typeof pptxgenModule.default;
const PptxGenJS: PptxCtor =
  (pptxgenModule as unknown as { default?: PptxCtor }).default ?? (pptxgenModule as unknown as PptxCtor);
type PptxSlide = ReturnType<InstanceType<PptxCtor>['addSlide']>;

interface Theme {
  bg: string;
  title: string;
  body: string;
  muted: string;
  accent: string;
  panel: string;
  headFont: string;
  bodyFont: string;
}

export const PPTX_THEMES: Record<ThemeName, Theme> = {
  light: {
    bg: 'FFFFFF',
    title: '111827',
    body: '374151',
    muted: '6B7280',
    accent: '2563EB',
    panel: 'F3F4F6',
    headFont: 'Calibri',
    bodyFont: 'Calibri',
  },
  dark: {
    bg: '0F172A',
    title: 'F8FAFC',
    body: 'CBD5E1',
    muted: '94A3B8',
    accent: '38BDF8',
    panel: '1E293B',
    headFont: 'Calibri',
    bodyFont: 'Calibri',
  },
  classic: {
    bg: 'FBF7EE',
    title: '1F2A44',
    body: '2E2E2E',
    muted: '6B6B6B',
    accent: '8B1E3F',
    panel: 'F1EADB',
    headFont: 'Georgia',
    bodyFont: 'Georgia',
  },
};

/** What this exporter reads from ExportInput (kept narrow so tests and callers can pass just these). */
export type PresentationExportInput = Pick<ExportInput, 'title' | 'content'> & {
  course?: { title: string } | null;
};

/** Slide height in inches (16:9 layout is 10" wide). */
const H = 5.625;

const bulletRuns = (items: string[], t: Theme, fontSize: number) =>
  items
    .map((x) => x.trim())
    .filter(Boolean)
    .map((text) => ({
      text,
      options: {
        bullet: { indent: fontSize * 0.9 },
        color: t.body,
        fontSize,
        paraSpaceAfter: 6,
        breakLine: true,
      },
    }));

function addTitle(s: PptxSlide, slide: Slide, t: Theme) {
  s.addShape('rect', {
    x: 0.5,
    y: 0.42,
    w: 0.08,
    h: 0.62,
    fill: { color: t.accent },
    line: { color: t.accent },
  });
  s.addText(slide.title, {
    x: 0.72,
    y: 0.32,
    w: 8.8,
    h: 0.82,
    fontFace: t.headFont,
    fontSize: 28,
    bold: true,
    color: t.title,
    valign: 'middle',
    fit: 'shrink',
  });
}

function addFooter(s: PptxSlide, footer: string, t: Theme) {
  s.addShape('line', { x: 0.5, y: 5.12, w: 9, h: 0, line: { color: t.panel, width: 1 } });
  s.addText(footer, {
    x: 0.5,
    y: 5.17,
    w: 7.5,
    h: 0.3,
    fontFace: t.bodyFont,
    fontSize: 10,
    color: t.muted,
    valign: 'middle',
  });
  s.slideNumber = {
    x: 8.9,
    y: 5.17,
    w: 0.6,
    h: 0.3,
    fontFace: t.bodyFont,
    fontSize: 10,
    color: t.muted,
    align: 'right',
  };
}

function titleSlide(s: PptxSlide, slide: Slide, t: Theme, courseTitle: string | null) {
  s.addShape('rect', { x: 0, y: 0, w: 0.28, h: H, fill: { color: t.accent }, line: { color: t.accent } });
  s.addText(slide.title, {
    x: 0.9,
    y: 1.35,
    w: 8.4,
    h: 1.6,
    fontFace: t.headFont,
    fontSize: 40,
    bold: true,
    color: t.title,
    valign: 'bottom',
    fit: 'shrink',
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.9,
      y: 3.05,
      w: 8.4,
      h: 0.7,
      fontFace: t.bodyFont,
      fontSize: 20,
      color: t.muted,
      valign: 'top',
      fit: 'shrink',
    });
  }
  if (courseTitle) {
    s.addText(courseTitle, {
      x: 0.9,
      y: 4.6,
      w: 8.4,
      h: 0.4,
      fontFace: t.bodyFont,
      fontSize: 14,
      bold: true,
      color: t.accent,
    });
  }
}

function bulletsSlide(s: PptxSlide, slide: Slide, t: Theme) {
  addTitle(s, slide, t);
  let y = 1.25;
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.72,
      y,
      w: 8.6,
      h: 0.4,
      fontFace: t.bodyFont,
      fontSize: 16,
      italic: true,
      color: t.muted,
    });
    y += 0.45;
  }
  s.addText(bulletRuns(slide.bullets, t, 20), {
    x: 0.72,
    y,
    w: 8.6,
    h: 5.0 - y,
    fontFace: t.bodyFont,
    valign: 'top',
    fit: 'shrink',
  });
}

function twoColumnSlide(s: PptxSlide, slide: Slide, t: Theme) {
  addTitle(s, slide, t);
  const [left, right] = slide.subtitle.includes('|')
    ? slide.subtitle.split('|').map((x) => x.trim())
    : ['', ''];
  if (!slide.subtitle.includes('|') && slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.72,
      y: 1.2,
      w: 8.6,
      h: 0.35,
      fontFace: t.bodyFont,
      fontSize: 15,
      italic: true,
      color: t.muted,
    });
  }
  const cols: [number, string | undefined, string[]][] = [
    [0.6, left, slide.bullets],
    [5.1, right, slide.rightBullets],
  ];
  for (const [x, heading, items] of cols) {
    s.addShape('rect', { x, y: 1.6, w: 4.3, h: 3.35, fill: { color: t.panel }, line: { color: t.panel } });
    let y = 1.7;
    if (heading) {
      s.addText(heading, {
        x: x + 0.15,
        y,
        w: 4.0,
        h: 0.4,
        fontFace: t.headFont,
        fontSize: 17,
        bold: true,
        color: t.accent,
      });
      y += 0.45;
    }
    s.addText(bulletRuns(items, t, 16), {
      x: x + 0.15,
      y,
      w: 4.0,
      h: 4.85 - y,
      fontFace: t.bodyFont,
      valign: 'top',
      fit: 'shrink',
    });
  }
}

function quoteSlide(s: PptxSlide, slide: Slide, t: Theme) {
  s.addText(slide.title, {
    x: 0.8,
    y: 0.45,
    w: 8.4,
    h: 0.5,
    fontFace: t.headFont,
    fontSize: 16,
    bold: true,
    color: t.accent,
  });
  s.addText('“', {
    x: 0.6,
    y: 0.9,
    w: 1,
    h: 1.1,
    fontFace: t.headFont,
    fontSize: 80,
    bold: true,
    color: t.accent,
  });
  s.addText(slide.bullets[0] ?? '', {
    x: 1.2,
    y: 1.3,
    w: 7.6,
    h: 2.5,
    fontFace: t.headFont,
    fontSize: 28,
    italic: true,
    color: t.title,
    align: 'center',
    valign: 'middle',
    fit: 'shrink',
  });
  if (slide.subtitle) {
    s.addText(`— ${slide.subtitle}`, {
      x: 1.2,
      y: 3.95,
      w: 7.6,
      h: 0.5,
      fontFace: t.bodyFont,
      fontSize: 16,
      color: t.muted,
      align: 'center',
    });
  }
}

function summarySlide(s: PptxSlide, slide: Slide, t: Theme) {
  addTitle(s, slide, t);
  s.addShape('rect', {
    x: 0.6,
    y: 1.3,
    w: 8.8,
    h: 3.65,
    fill: { color: t.panel },
    line: { color: t.accent, width: 1.5 },
  });
  s.addText(bulletRuns(slide.bullets, t, 20), {
    x: 0.85,
    y: 1.45,
    w: 8.3,
    h: 3.4,
    fontFace: t.bodyFont,
    valign: 'top',
    fit: 'shrink',
  });
}

/** Builds the .pptx for a presentation resource. Throws 400 if the content is not a valid presentation. */
export async function exportFile(resource: PresentationExportInput): Promise<ExportedFile> {
  const parsed = PresentationContent.safeParse(resource.content);
  if (!parsed.success) throw badRequest('This presentation has no valid slides to export');
  const content = parsed.data;
  const t = PPTX_THEMES[content.theme];
  const courseTitle = resource.course?.title ?? null;
  const footer = courseTitle ? `${courseTitle} · ${resource.title}` : resource.title;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = resource.title;
  pptx.subject = courseTitle ?? '';
  pptx.company = 'ClassPulse';

  for (const slide of content.slides) {
    const s = pptx.addSlide();
    s.background = { color: t.bg };
    if (slide.layout === 'title') titleSlide(s, slide, t, courseTitle);
    else {
      if (slide.layout === 'two_column') twoColumnSlide(s, slide, t);
      else if (slide.layout === 'quote') quoteSlide(s, slide, t);
      else if (slide.layout === 'summary') summarySlide(s, slide, t);
      else bulletsSlide(s, slide, t);
      addFooter(s, footer, t);
    }
    if (slide.speakerNotes) s.addNotes(slide.speakerNotes);
  }

  const out = await pptx.write({ outputType: 'nodebuffer', compression: true });
  const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
  return {
    buffer,
    filename: safeFilename(resource.title, 'pptx', 'presentation'),
    contentType: PPTX_CONTENT_TYPE,
  };
}
