'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import type { Simulation } from '@classiq/shared';
import { Button } from '@/components/ui';
import { SubjectIcon } from './subject-icon';

export const PHET_ATTRIBUTION = 'PhET Interactive Simulations, University of Colorado Boulder (CC-BY 4.0)';

/**
 * "Open in class": the simulation fills the screen for the projector, with a big title bar and Exit.
 * The iframe is sandboxed (scripts + same-origin for the sim itself, popups for its help links).
 */
export function ClassroomPlayer({ simulation, onExit }: { simulation: Simulation; onExit: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    exitRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Escape leaves browser full screen first (handled by the browser); a second Escape closes the player.
      if (e.key === 'Escape' && !document.fullscreenElement) onExit();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onExit]);

  const goFullScreen = () => {
    void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${simulation.title} (in class)`}
      className="fixed inset-0 z-50 flex flex-col bg-ink"
    >
      <div className="flex items-center gap-4 border-b border-line-strong bg-surface px-4 py-3">
        <SubjectIcon subject={simulation.subject} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-2xl font-black sm:text-3xl">{simulation.title}</h2>
          <p className="truncate text-xs text-muted">
            {simulation.subject}
            {simulation.source === 'catalog' && ` · ${PHET_ATTRIBUTION}`}
          </p>
        </div>
        <Button
          variant="secondary"
          size="lg"
          onClick={goFullScreen}
          icon={<Maximize2 className="size-5" aria-hidden />}
        >
          <span className="hidden sm:inline">Full screen</span>
          <span className="sr-only sm:hidden">Full screen</span>
        </Button>
        <Button ref={exitRef} size="lg" onClick={onExit} icon={<X className="size-5" aria-hidden />}>
          Exit
        </Button>
      </div>
      <iframe
        src={simulation.url}
        title={simulation.title}
        className="min-h-0 w-full flex-1 border-0 bg-surface"
        allow="fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups"
        referrerPolicy="no-referrer"
      />
    </div>,
    document.body,
  );
}
