'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Printer } from 'lucide-react';
import { Button, Card, Checkbox, EmptyState, ErrorState, LoadingBlock } from '@/components/ui';
import { RESOURCE_TYPE_LABEL, useResource } from '@/components/teacher/resources/meta';
import { resourceUi } from '@/components/teacher/resources/types';

/**
 * Clean print layout: the type's Viewer in read-only print mode, rendered over the app shell (a portal on
 * <body>). While printing, every other child of <body> is hidden, so only the resource reaches the page.
 * Opens the browser's print dialog once the content is ready (Save as PDF gives the PDF).
 */
export default function PrintResourcePage() {
  const { id } = useParams<{ id: string }>();
  const q = useResource(id);
  const [mounted, setMounted] = useState(false);
  const [showAnswers, setShowAnswers] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const printed = useRef(false);

  useEffect(() => setMounted(true), []);

  // Hide everything except the print root while printing (Ctrl+P too).
  useEffect(() => {
    const hidden: HTMLElement[] = [];
    const before = () => {
      for (const el of Array.from(document.body.children)) {
        if (el instanceof HTMLElement && el !== rootRef.current && !el.hidden) {
          el.hidden = true;
          hidden.push(el);
        }
      }
    };
    const after = () => {
      for (const el of hidden.splice(0)) el.hidden = false;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      after();
    };
  }, []);

  const ready = q.data?.status === 'ready' && q.data.content !== null;
  useEffect(() => {
    if (!ready || printed.current) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [ready]);

  if (!mounted) return null;

  const resource = q.data;
  const Viewer = resource ? resourceUi[resource.type].Viewer : null;

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas text-ink print:static print:overflow-visible print:bg-surface"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 print:hidden">
        <Link href={`/teacher/resources/${id}`} className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden /> Back to resource
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox label="Include answers" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
          <Button icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()} disabled={!ready}>
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 print:max-w-none print:p-0">
        {q.isPending ? (
          <LoadingBlock label="Loading resource…" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !ready || !resource || !Viewer ? (
          <Card>
            <EmptyState title="Nothing to print yet" description="This resource is still being generated or has no content." />
          </Card>
        ) : (
          <article className="bg-surface p-8 shadow-card rounded-card print:rounded-none print:p-0 print:shadow-none">
            <header className="mb-6 border-b border-line pb-4 text-center">
              <p className="eyebrow">{RESOURCE_TYPE_LABEL[resource.type]}</p>
              <h1 className="font-display text-2xl font-black">{resource.title}</h1>
              {resource.course && <p className="mt-1 text-sm text-muted">{resource.course.title}</p>}
            </header>
            <Viewer resource={resource} editable={false} mode="print" showAnswers={showAnswers} />
          </article>
        )}
      </main>
    </div>,
    document.body,
  );
}
