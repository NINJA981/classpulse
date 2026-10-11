'use client';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { PresentationContent, PresentationOptions } from '@classpulse/shared';
import { Button, Card, Checkbox, EmptyState, Field, Input, Select, Textarea } from '@/components/ui';
import type { OptionsFieldsProps, ViewerProps } from '.';

type Theme = PresentationContent['theme'];
type Slide = PresentationContent['slides'][number];
type Layout = Slide['layout'];

/*
 * Slide themes mirror the PowerPoint export (apps/api/src/modules/resources/exporters/presentation.ts).
 * They describe the deck's own look, not the app chrome, so they use the Tailwind palette rather than app tokens.
 * Text sizes use container-query units (cqw) so a slide scales identically as a thumbnail, on screen,
 * full screen and in print.
 */
const THEMES: Record<
  Theme,
  {
    label: string;
    slide: string;
    muted: string;
    accentBg: string;
    accentText: string;
    accentBorder: string;
    panel: string;
  }
> = {
  light: {
    label: 'Light',
    slide: 'bg-white text-gray-900 font-sans',
    muted: 'text-gray-500',
    accentBg: 'bg-blue-600',
    accentText: 'text-blue-600',
    accentBorder: 'border-blue-600',
    panel: 'bg-gray-100',
  },
  dark: {
    label: 'Dark',
    slide: 'bg-slate-900 text-slate-50 font-sans',
    muted: 'text-slate-400',
    accentBg: 'bg-sky-400',
    accentText: 'text-sky-400',
    accentBorder: 'border-sky-400',
    panel: 'bg-slate-800',
  },
  classic: {
    label: 'Classic',
    slide: 'bg-amber-50 text-blue-950 font-serif',
    muted: 'text-stone-500',
    accentBg: 'bg-rose-900',
    accentText: 'text-rose-900',
    accentBorder: 'border-rose-900',
    panel: 'bg-stone-100',
  },
};

const LAYOUT_LABEL: Record<Layout, string> = {
  title: 'Title',
  bullets: 'Bullet points',
  two_column: 'Two columns',
  quote: 'Quote / key statement',
  summary: 'Summary (recap)',
};

const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

/* ------------------------------------------------------------------------------------------------
 * One slide (pure rendering)
 * ---------------------------------------------------------------------------------------------- */

export function SlideView({
  slide,
  theme,
  number,
  footer,
  className,
}: {
  slide: Slide;
  theme: Theme;
  number: number;
  footer?: string;
  className?: string;
}) {
  const t = THEMES[theme];
  const bullets = clean(slide.bullets);
  const right = clean(slide.rightBullets);
  const [leftHead, rightHead] = slide.subtitle.includes('|')
    ? slide.subtitle.split('|').map((x) => x.trim())
    : [null, null];

  const heading = (
    <div className="flex items-stretch gap-[1.6cqw]">
      <span className={clsx('w-[0.8cqw] shrink-0', t.accentBg)} aria-hidden />
      <h3 className="text-[4.2cqw] font-bold leading-tight">{slide.title}</h3>
    </div>
  );
  const list = (items: string[], size = 'text-[2.7cqw]') => (
    <ul className={clsx('list-disc space-y-[1cqw] pl-[3.2cqw] leading-snug', size)}>
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );

  let body;
  if (slide.layout === 'title') {
    body = (
      <>
        <span className={clsx('absolute inset-y-0 left-0 w-[2.8cqw]', t.accentBg)} aria-hidden />
        <div className="flex h-full flex-col justify-center pl-[4cqw]">
          <h3 className="text-[6.4cqw] font-black leading-[1.05]">{slide.title}</h3>
          {slide.subtitle && <p className={clsx('mt-[2cqw] text-[3cqw]', t.muted)}>{slide.subtitle}</p>}
          {footer && <p className={clsx('mt-[5cqw] text-[2cqw] font-bold', t.accentText)}>{footer}</p>}
        </div>
      </>
    );
  } else if (slide.layout === 'quote') {
    body = (
      <div className="flex h-full flex-col">
        <p className={clsx('text-[2.4cqw] font-bold', t.accentText)}>{slide.title}</p>
        <div className="flex flex-1 flex-col items-center justify-center px-[6cqw] text-center">
          <span className={clsx('text-[9cqw] font-black leading-none', t.accentText)} aria-hidden>
            “
          </span>
          <blockquote className="text-[4cqw] italic leading-snug">{bullets[0] ?? ''}</blockquote>
          {slide.subtitle && <p className={clsx('mt-[2cqw] text-[2.4cqw]', t.muted)}>— {slide.subtitle}</p>}
        </div>
      </div>
    );
  } else if (slide.layout === 'two_column') {
    body = (
      <div className="flex h-full flex-col gap-[2cqw]">
        {heading}
        {slide.subtitle && !leftHead && (
          <p className={clsx('text-[2.2cqw] italic', t.muted)}>{slide.subtitle}</p>
        )}
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-[2.4cqw]">
          {[
            [leftHead, bullets],
            [rightHead, right],
          ].map(([head, items], i) => (
            <div key={i} className={clsx('p-[2cqw]', t.panel)}>
              {head && (
                <p className={clsx('mb-[1.2cqw] text-[2.6cqw] font-bold', t.accentText)}>{head as string}</p>
              )}
              {list(items as string[], 'text-[2.3cqw]')}
            </div>
          ))}
        </div>
      </div>
    );
  } else if (slide.layout === 'summary') {
    body = (
      <div className="flex h-full flex-col gap-[2.4cqw]">
        {heading}
        <div className={clsx('min-h-0 flex-1 border-[0.25cqw] p-[2.6cqw]', t.panel, t.accentBorder)}>
          {list(bullets)}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex h-full flex-col gap-[2cqw]">
        {heading}
        {slide.subtitle && <p className={clsx('text-[2.4cqw] italic', t.muted)}>{slide.subtitle}</p>}
        <div className="min-h-0 flex-1">{list(bullets)}</div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        '@container relative aspect-video w-full overflow-hidden [print-color-adjust:exact]',
        t.slide,
        className,
      )}
    >
      <div className="absolute inset-0 px-[5cqw] pt-[4.5cqw] pb-[6.5cqw]">{body}</div>
      {slide.layout !== 'title' && (
        <div
          className={clsx(
            'absolute inset-x-[5cqw] bottom-[2cqw] flex justify-between gap-4 text-[1.5cqw]',
            t.muted,
          )}
        >
          <span className="truncate">{footer}</span>
          <span className="tabular-nums">{number}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Present mode (full screen, keyboard, optional speaker notes)
 * ---------------------------------------------------------------------------------------------- */

function PresentMode({
  content,
  index,
  setIndex,
  footer,
  onExit,
}: {
  content: PresentationContent;
  index: number;
  setIndex: (i: number) => void;
  footer: string;
  onExit: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState(false);
  const total = content.slides.length;
  const slide = content.slides[index]!;
  const go = useCallback(
    (d: number) => setIndex(Math.min(total - 1, Math.max(0, index + d))),
    [index, setIndex, total],
  );

  useEffect(() => {
    const el = rootRef.current;
    el?.focus();
    void el?.requestFullscreen?.().catch(() => undefined);
    let wasFull = false;
    const onFs = () => {
      if (document.fullscreenElement) wasFull = true;
      else if (wasFull) onExit(); // Esc left browser full screen → leave present mode too
    };
    document.addEventListener('fullscreenchange', onFs);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.body.style.overflow = overflow;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onExit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(total - 1);
      else if (e.key === 'Escape' && !document.fullscreenElement) onExit();
      else if (e.key.toLowerCase() === 'n') setNotes((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onExit, setIndex, total]);

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Presenting slides"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        <SlideView
          slide={slide}
          theme={content.theme}
          number={index + 1}
          footer={footer}
          className={
            notes ? 'max-w-[min(100%,calc((100vh-15rem)*16/9))]' : 'max-w-[min(100%,calc((100vh-4rem)*16/9))]'
          }
        />
      </div>
      {notes && (
        <section
          aria-label="Speaker notes"
          className="mx-auto h-44 w-full max-w-5xl overflow-y-auto border-t border-white/20 px-6 py-3 text-lg leading-relaxed"
        >
          {slide.speakerNotes || <span className="opacity-60">No notes for this slide.</span>}
        </section>
      )}
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="p-2 hover:bg-white/10 disabled:opacity-30"
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <span className="min-w-20 text-center tabular-nums" aria-live="polite">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === total - 1}
          className="p-2 hover:bg-white/10 disabled:opacity-30"
          aria-label="Next slide"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setNotes((v) => !v)}
          aria-pressed={notes}
          className={clsx(
            'ml-4 inline-flex items-center gap-1.5 px-3 py-2 font-bold hover:bg-white/10',
            notes && 'bg-white/15',
          )}
        >
          <StickyNote className="size-4" aria-hidden />
          Speaker notes
        </button>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 px-3 py-2 font-bold hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
          Exit presentation
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------------------------------------
 * Slide editor (inline, for the owner)
 * ---------------------------------------------------------------------------------------------- */

function SlideEditor({
  slide,
  index,
  total,
  onChange,
  onAdd,
  onDelete,
  onMove,
}: {
  slide: Slide;
  index: number;
  total: number;
  onChange: (patch: Partial<Slide>) => void;
  onAdd: () => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
}) {
  const lines = (v: string) => v.split('\n');
  const subtitleHint =
    slide.layout === 'two_column'
      ? 'Column headings as “Left | Right”'
      : slide.layout === 'quote'
        ? 'Source or context of the quote'
        : undefined;
  return (
    <Card className="print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="font-display text-sm font-extrabold">Edit slide {index + 1}</h3>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move slide earlier"
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move slide later"
          >
            <ArrowDown className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onAdd}
            icon={<Plus className="size-4" aria-hidden />}
          >
            Add slide after
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={total <= 1}
            icon={<Trash2 className="size-4" aria-hidden />}
          >
            Delete slide
          </Button>
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Layout">
          {(p) => (
            <Select
              {...p}
              value={slide.layout}
              onChange={(e) => onChange({ layout: e.target.value as Layout })}
            >
              {(Object.keys(LAYOUT_LABEL) as Layout[]).map((l) => (
                <option key={l} value={l}>
                  {LAYOUT_LABEL[l]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Slide title">
          {(p) => (
            <Input
              {...p}
              value={slide.title}
              maxLength={200}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          )}
        </Field>
        <Field label="Subtitle" hint={subtitleHint} className="sm:col-span-2">
          {(p) => (
            <Input
              {...p}
              value={slide.subtitle}
              maxLength={300}
              onChange={(e) => onChange({ subtitle: e.target.value })}
            />
          )}
        </Field>
        {slide.layout !== 'title' && (
          <Field
            label={
              slide.layout === 'two_column'
                ? 'Left column (one point per line)'
                : slide.layout === 'quote'
                  ? 'Quote'
                  : 'Bullet points (one per line)'
            }
            className={slide.layout === 'two_column' ? undefined : 'sm:col-span-2'}
          >
            {(p) => (
              <Textarea
                {...p}
                rows={6}
                value={slide.bullets.join('\n')}
                onChange={(e) => onChange({ bullets: lines(e.target.value) })}
              />
            )}
          </Field>
        )}
        {slide.layout === 'two_column' && (
          <Field label="Right column (one point per line)">
            {(p) => (
              <Textarea
                {...p}
                rows={6}
                value={slide.rightBullets.join('\n')}
                onChange={(e) => onChange({ rightBullets: lines(e.target.value) })}
              />
            )}
          </Field>
        )}
        <Field label="Speaker notes" className="sm:col-span-2">
          {(p) => (
            <Textarea
              {...p}
              rows={4}
              value={slide.speakerNotes}
              onChange={(e) => onChange({ speakerNotes: e.target.value })}
            />
          )}
        </Field>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Viewer
 * ---------------------------------------------------------------------------------------------- */

/** Print: one slide per landscape page. */
function PrintDeck({
  content,
  footer,
  className,
}: {
  content: PresentationContent;
  footer: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <style>{'@media print { @page { size: landscape; margin: 0.4in; } }'}</style>
      {content.slides.map((s, i) => (
        <div
          key={i}
          className={clsx(
            'mb-6 break-inside-avoid border border-line print:mb-0 print:border-0',
            i > 0 && 'print:break-before-page',
          )}
        >
          <SlideView slide={s} theme={content.theme} number={i + 1} footer={footer} />
        </div>
      ))}
    </div>
  );
}

export function Viewer({ resource, editable = false, onChange, mode = 'screen' }: ViewerProps) {
  const parsed = PresentationContent.safeParse(resource.content);
  const [index, setIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const exitPresent = useCallback(() => setPresenting(false), []);
  const thumbsRef = useRef<HTMLOListElement>(null);

  const content = parsed.success ? parsed.data : null;
  const total = content?.slides.length ?? 0;
  const current = Math.min(index, Math.max(0, total - 1));
  const footer = resource.course ? `${resource.course.title} · ${resource.title}` : resource.title;

  useEffect(() => {
    thumbsRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  if (!content || total === 0) {
    return (
      <EmptyState
        title="No slides to show"
        description="This presentation has no valid slides. Try generating it again."
      />
    );
  }
  if (mode === 'print') return <PrintDeck content={content} footer={footer} />;

  const slide = content.slides[current]!;
  const go = (d: number) => setIndex(Math.min(total - 1, Math.max(0, current + d)));
  const emit = (slides: Slide[]) => onChange?.({ ...content, slides });
  const patch = (p: Partial<Slide>) =>
    emit(content.slides.map((s, i) => (i === current ? { ...s, ...p } : s)));
  const addAfter = () => {
    const blank: Slide = {
      layout: 'bullets',
      title: 'New slide',
      subtitle: '',
      bullets: [''],
      rightBullets: [],
      speakerNotes: '',
    };
    emit([...content.slides.slice(0, current + 1), blank, ...content.slides.slice(current + 1)]);
    setIndex(current + 1);
  };
  const remove = () => {
    emit(content.slides.filter((_, i) => i !== current));
    setIndex(Math.max(0, current - 1));
  };
  const move = (d: number) => {
    const to = current + d;
    if (to < 0 || to >= total) return;
    const slides = [...content.slides];
    [slides[current], slides[to]] = [slides[to]!, slides[current]!];
    emit(slides);
    setIndex(to);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <section
          aria-roledescription="carousel"
          aria-label="Slides"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="flex flex-col gap-3 outline-offset-4"
        >
          <div
            className="border border-line-strong"
            aria-roledescription="slide"
            aria-label={`Slide ${current + 1} of ${total}`}
            role="group"
          >
            <SlideView slide={slide} theme={content.theme} number={current + 1} footer={footer} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => go(-1)}
                disabled={current === 0}
                aria-label="Previous slide"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <span className="min-w-24 text-center text-sm font-bold tabular-nums" aria-live="polite">
                Slide {current + 1} of {total}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => go(1)}
                disabled={current === total - 1}
                aria-label="Next slide"
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
            <p className="hidden text-xs text-muted sm:block">Use ← → to move between slides</p>
            <Button
              size="sm"
              onClick={() => setPresenting(true)}
              icon={<MonitorPlay className="size-4" aria-hidden />}
            >
              Present
            </Button>
          </div>
          <ol ref={thumbsRef} aria-label="Slide thumbnails" className="flex gap-2 overflow-x-auto pb-2">
            {content.slides.map((s, i) => (
              <li key={i} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === current ? 'true' : undefined}
                  aria-label={`Slide ${i + 1}: ${s.title}`}
                  className={clsx(
                    'block w-36 border-2 p-0.5',
                    i === current ? 'border-line-strong' : 'border-transparent hover:border-line',
                  )}
                >
                  <span aria-hidden className="pointer-events-none block">
                    <SlideView slide={s} theme={content.theme} number={i + 1} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        {editable && onChange ? (
          <SlideEditor
            slide={slide}
            index={current}
            total={total}
            onChange={patch}
            onAdd={addAfter}
            onDelete={remove}
            onMove={move}
          />
        ) : (
          <Card>
            <div className="px-4 py-3">
              <h3 className="eyebrow mb-1">Speaker notes</h3>
              <p className="whitespace-pre-line text-sm text-ink-2">
                {slide.speakerNotes || 'No notes for this slide.'}
              </p>
            </div>
          </Card>
        )}
      </div>

      <PrintDeck content={content} footer={footer} className="hidden print:block" />

      {presenting && (
        <PresentMode
          content={content}
          index={current}
          setIndex={setIndex}
          footer={footer}
          onExit={exitPresent}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Generate-form options
 * ---------------------------------------------------------------------------------------------- */

const SAMPLE: Slide = {
  layout: 'title',
  title: 'Photosynthesis',
  subtitle: 'Class 7 Science',
  bullets: [],
  rightBullets: [],
  speakerNotes: '',
};

export function OptionsFields({ value, onChange }: OptionsFieldsProps) {
  const current = PresentationOptions.safeParse(value && typeof value === 'object' ? value : {});
  const opts = current.success ? current.data : PresentationOptions.parse({});
  const [count, setCount] = useState(String(opts.slideCount));

  const emit = (next: Partial<typeof opts>) => onChange({ type: 'presentation', ...opts, ...next });

  // Make sure the parent holds a FULL options object from the start.
  const raw = value as
    | { type?: string; slideCount?: unknown; includeSpeakerNotes?: unknown; theme?: unknown }
    | null
    | undefined;
  const incomplete =
    !raw ||
    raw.type !== 'presentation' ||
    raw.slideCount === undefined ||
    raw.includeSpeakerNotes === undefined ||
    raw.theme === undefined;
  const { slideCount, includeSpeakerNotes, theme } = opts;
  useEffect(() => {
    if (incomplete) onChange({ type: 'presentation', slideCount, includeSpeakerNotes, theme });
  }, [incomplete, onChange, slideCount, includeSpeakerNotes, theme]);

  const commitCount = (v: string) => {
    const n = Math.round(Number(v));
    const clamped = Number.isFinite(n) ? Math.min(40, Math.max(3, n)) : opts.slideCount;
    setCount(String(clamped));
    emit({ slideCount: clamped });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Number of slides" hint="3 to 40, including the title and recap slides">
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={3}
              max={40}
              value={count}
              onChange={(e) => {
                setCount(e.target.value);
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 3 && n <= 40) emit({ slideCount: n });
              }}
              onBlur={(e) => commitCount(e.target.value)}
            />
          )}
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox
            label="Include speaker notes"
            checked={opts.includeSpeakerNotes}
            onChange={(e) => emit({ includeSpeakerNotes: e.target.checked })}
          />
        </div>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs font-bold text-ink-2">Theme</legend>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(THEMES) as Theme[]).map((th) => (
            <label
              key={th}
              className={clsx(
                'flex cursor-pointer flex-col gap-1.5 border-2 p-1.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
                opts.theme === th ? 'border-line-strong' : 'border-line hover:border-ink-2',
              )}
            >
              <input
                type="radio"
                name="presentation-theme"
                value={th}
                checked={opts.theme === th}
                onChange={() => emit({ theme: th })}
                className="sr-only"
              />
              <span aria-hidden className="pointer-events-none block">
                <SlideView slide={SAMPLE} theme={th} number={1} />
              </span>
              <span className="text-center text-xs font-bold">{THEMES[th].label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
