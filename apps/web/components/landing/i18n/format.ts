import { Fragment, createElement, type ReactNode } from 'react';

const PLACEHOLDER = /\{(\w+)\}/g;

/** Fills `{name}` placeholders in a copy template with plain values. Unknown placeholders stay as written. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(PLACEHOLDER, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Like fill(), but a placeholder can become a React node (a link, a styled timestamp). */
export function fillNodes(template: string, values: Record<string, ReactNode>): ReactNode {
  const parts = template.split(PLACEHOLDER);
  // split() with a capture group alternates text, key, text, key, …
  return parts.map((part, i) =>
    i % 2 === 1 ? createElement(Fragment, { key: i }, part in values ? values[part] : `{${part}}`) : part,
  );
}
