'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let instance: Lenis | null = null;

/** The running Lenis instance, or null (reduced motion, capture mode, not mounted yet). */
export function getLenis() {
  return instance;
}

/**
 * Scroll to an in-page target, through Lenis when it runs, natively otherwise. Both honour the target's
 * scroll-margin-top (set for every [id] on the landing page in story.tsx), which clears the fixed header.
 */
export function scrollToTarget(target: string | HTMLElement) {
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (!el) return;
  if (instance) {
    instance.scrollTo(el);
  } else {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}

/** Move keyboard focus to a scrolled-to section without a second jump. */
export function focusTarget(el: HTMLElement) {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/**
 * Lenis smooth scrolling for the landing page, driven by GSAP's ticker so ScrollTrigger and Lenis
 * share one clock. Off under prefers-reduced-motion (native scrolling; scroll-margin-top keeps
 * anchors clear of the header).
 */
export function SmoothScroll() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const root = document.documentElement;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let tick: ((time: number) => void) | null = null;

    const start = () => {
      if (instance || mq.matches || root.dataset.capture === '1') return;
      const lenis = new Lenis({
        stopInertiaOnNavigate: true,
        autoRaf: false,
      });
      lenis.on('scroll', ScrollTrigger.update);
      tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      instance = lenis;
    };
    const stop = () => {
      if (tick) gsap.ticker.remove(tick);
      tick = null;
      instance?.destroy();
      instance = null;
    };
    const onChange = () => (mq.matches ? stop() : start());

    // Same-page anchors (#try, #faq…): one smooth path that clears the header and moves focus for keyboard users.
    const onClick = (e: MouseEvent) => {
      if (!instance || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const hash = link?.getAttribute('href');
      if (!hash || hash === '#') return;
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!el) return;
      e.preventDefault();
      scrollToTarget(el);
      history.pushState(null, '', hash);
      focusTarget(el);
    };

    start();
    mq.addEventListener('change', onChange);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      mq.removeEventListener('change', onChange);
      stop();
    };
  }, []);

  return null;
}
