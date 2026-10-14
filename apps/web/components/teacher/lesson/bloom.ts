import type { BloomLevel } from '@classiq/shared';

/** Display names for Bloom's taxonomy levels (lesson questions, question papers, insights). */
export const BLOOM_LABEL: Record<BloomLevel, string> = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyze: 'Analyse',
  evaluate: 'Evaluate',
  create: 'Create',
};
