'use client';

import { useEffect } from 'react';

/**
 * Sets <html lang> for a translated product page. The root layout (shared by the whole app) renders
 * lang="en", and the page's wrapper already carries its own lang (so content, fonts and screen readers are
 * right from the first byte). This puts the language on <html> too once the page is running (not before:
 * changing it ahead of hydration makes React report a mismatch), keeps it right after client-side navigation,
 * and puts English back when the visitor leaves (e.g. to /login).
 */
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    return () => {
      root.lang = 'en';
    };
  }, [lang]);
  return null;
}
