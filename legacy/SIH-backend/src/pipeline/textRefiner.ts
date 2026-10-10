import { ASR_CORRECTIONS } from './library.js';

const FILLER_RE =
  /\b(?:so,? )?(?:um+|uh+|erm+|hmm+|mm-hmm|uh-huh|you know|i mean|sort of|kind of|like|basically|actually|literally|okay so|alright so|as i was saying|in fact|right\?)(?=[\s,.!?;:]|$)[,.]?/gi;

/**
 * Deterministic text refinement:
 * 1. Restores technical terms from common ASR errors.
 * 2. Strips filler words.
 * 3. Formats spacing, capitalization, and terminal punctuation.
 */
export function cleanRefineText(raw: string): string {
  let text = raw;

  // 1. Terminology correction
  for (const { pattern, replacement } of ASR_CORRECTIONS) {
    text = text.replace(pattern, replacement);
  }

  // 2. Strip conversational fillers
  text = text.replace(FILLER_RE, ' ');
  text = text.replace(/\s+([,.!?;:])/g, '$1'); // no space before punctuation
  text = text.replace(/([,.!?;:])(?=[^\s\d])/g, '$1 '); // space after punctuation
  text = text.replace(/\s{2,}/g, ' ').trim();

  // 3. Sentence capitalization
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p, c) => p + c.toUpperCase());
  text = text.replace(/\bi\b/g, 'I');

  // 4. Ensure trailing punctuation
  if (text.length > 0 && !/[.!?]$/.test(text)) {
    text += '.';
  }

  return text;
}

