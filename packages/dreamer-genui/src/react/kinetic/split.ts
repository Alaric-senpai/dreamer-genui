/**
 * Kinetic text splitting (plain DOM — GSAP stays out, audit 3(d)).
 *
 * Pure functions so splitting is as testable as any engine operation.
 * Whitespace is preserved as its own unit type so the joined visual text
 * is always identical to the source (joinParts∘splitIntoParts = id).
 */

export type SplitMode = 'words' | 'chars' | 'none';
export type SplitPart = { text: string; kind: 'word' | 'char' | 'space' };

/** Split `text` into animatable units, preserving every whitespace run exactly. */
export function splitIntoParts(text: string, mode: SplitMode): SplitPart[] {
  if (!text) return [];
  if (mode === 'none') return [{ text, kind: 'word' }];
  if (mode === 'chars') {
    return [...text].map((ch) => ({ text: ch, kind: /\s/.test(ch) ? 'space' : 'char' }));
  }
  // words: runs of non-whitespace vs whitespace
  const parts: SplitPart[] = [];
  const re = /\S+|\s+/g;
  for (const token of text.match(re) ?? []) {
    if (/^\s+$/.test(token)) parts.push({ text: token, kind: 'space' });
    else parts.push({ text: token, kind: 'word' });
  }
  return parts;
}

/** Re-join parts into the exact visual text. */
export function joinParts(parts: SplitPart[]): string {
  return parts.map((p) => p.text).join('');
}
