import Link from 'next/link';
import clsx from 'clsx';
import type { MouseEvent, ReactNode } from 'react';

/**
 * Landing-page call-to-action links. Shared by every landing section.
 *
 * PrimaryCta — pulse-yellow slab with a hard navy offset shadow; it "presses down" into the shadow when active.
 * SecondaryCta — quiet outline in the current ink; `onDark` swaps to chalk for board-green backgrounds.
 *
 * Internal paths (`/…`) render a Next <Link>; mailto:, #anchors and external URLs render a plain <a>.
 */

type Tone = 'onLight' | 'onDark';
type Size = 'sm' | 'md' | 'lg';

export interface CtaProps {
  href: string;
  children: ReactNode;
  /** Background the button sits on. Default 'onLight' (wall / chalk). */
  variant?: Tone;
  size?: Size;
  className?: string;
  /** Optional leading/trailing icon, decorative. */
  icon?: ReactNode;
  'aria-label'?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

const base =
  'group/cta relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card border-2 ' +
  'font-display font-bold tracking-[-0.01em] select-none ' +
  'transition-[transform,box-shadow,background-color,color] duration-200 ease-snap ' +
  'focus-visible:outline-2 focus-visible:outline-offset-4';

const sizes: Record<Size, string> = {
  /** Compact: the phone header, where the bar has room for little else. */
  sm: 'h-10 px-3 text-sm',
  md: 'min-h-11 h-11 px-5 text-[0.9375rem]',
  lg: 'min-h-11 h-13 px-7 text-base sm:h-14 sm:px-8 sm:text-[1.0625rem]',
};

const primary: Record<Tone, string> = {
  onLight:
    'bg-pulse text-uniform border-uniform shadow-[4px_4px_0_var(--cp-uniform)] ' +
    'hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--cp-uniform)] ' +
    'active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0_0_0_var(--cp-uniform)] ' +
    'focus-visible:outline-uniform',
  onDark:
    'bg-pulse text-uniform border-uniform shadow-[4px_4px_0_var(--cp-chalk)] ' +
    'hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--cp-chalk)] ' +
    'active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0_0_0_var(--cp-chalk)] ' +
    'focus-visible:outline-pulse',
};

const secondary: Record<Tone, string> = {
  onLight:
    'bg-chalk/60 text-uniform border-uniform hover:bg-chalk active:translate-y-px focus-visible:outline-uniform',
  onDark:
    'bg-transparent text-chalk border-chalk/70 hover:border-chalk hover:bg-chalk/10 active:translate-y-px focus-visible:outline-pulse',
};

/** Class names for a CTA-styled element that isn't a link (e.g. a <button>). */
export function ctaClassName(kind: 'primary' | 'secondary', variant: Tone = 'onLight', size: Size = 'lg') {
  return clsx(base, sizes[size], kind === 'primary' ? primary[variant] : secondary[variant]);
}

function isInternal(href: string) {
  return href.startsWith('/') && !href.startsWith('//');
}

function Cta({ href, children, className, icon, 'aria-label': ariaLabel, onClick, classes }: CtaProps & { classes: string }) {
  const content = (
    <>
      <span>{children}</span>
      {icon ? (
        <span aria-hidden className="inline-flex">
          {icon}
        </span>
      ) : null}
    </>
  );
  const cls = clsx(classes, className);
  return isInternal(href) ? (
    <Link href={href} className={cls} aria-label={ariaLabel} onClick={onClick}>
      {content}
    </Link>
  ) : (
    <a href={href} className={cls} aria-label={ariaLabel} onClick={onClick}>
      {content}
    </a>
  );
}

export function PrimaryCta({ variant = 'onLight', size = 'lg', ...props }: CtaProps) {
  return <Cta {...props} classes={clsx(base, sizes[size], primary[variant])} />;
}

export function SecondaryCta({ variant = 'onLight', size = 'lg', ...props }: CtaProps) {
  return <Cta {...props} classes={clsx(base, sizes[size], secondary[variant])} />;
}
