import { describe, expect, test } from 'vitest';
import { splitIntoParts, joinParts, type SplitPart } from '../../packages/dreamer-genui/src/react/kinetic/split';

describe('splitIntoParts (§6.2 split — kinetic text)', () => {
  test('words split keeps whitespace as its own units', () => {
    const parts = splitIntoParts('hello kinetic world', 'words');
    expect(parts.map((p) => p.text)).toEqual(['hello', ' ', 'kinetic', ' ', 'world']);
    expect(parts.every((p) => p.kind === 'word' || p.kind === 'space')).toBe(true);
  });

  test('chars split preserves spaces but splits punctuation too', () => {
    const parts = splitIntoParts('a b!', 'chars');
    expect(parts.map((p) => p.text)).toEqual(['a', ' ', 'b', '!']);
  });

  test('multi-space runs collapse into one space unit (no empty parts)', () => {
    const parts = splitIntoParts('a    b', 'words');
    expect(parts.map((p) => p.text)).toEqual(['a', '    ', 'b']);
  });

  test('tab/newline runs count as whitespace units', () => {
    const parts = splitIntoParts("a\t\nb", 'chars');
    expect(parts.some((p) => p.text.includes('\t'))).toBe(true);
  });

  test('none yields exactly one part', () => {
    const parts = splitIntoParts('some text', 'none');
    expect(parts).toEqual([{ text: 'some text', kind: 'word' }]);
  });

  test('empty string yields no parts', () => {
    expect(splitIntoParts('', 'words')).toEqual([]);
    expect(splitIntoParts('', 'chars')).toEqual([]);
  });

  test('joinParts is a lossless identity for the visual text', () => {
    for (const split of ['words', 'chars', 'none'] as const) {
      const text = 'The count is 42 — wow!';
      const parts: SplitPart[] = splitIntoParts(text, split);
      expect(joinParts(parts)).toBe(text);
    }
  });

  test('words never contain spaces from the outside run (split boundary is exact)', () => {
    const parts = splitIntoParts('one two', 'words');
    for (const p of parts) {
      if (p.kind === 'word') {
        expect(p.text.trim()).toBe(p.text);
        expect(p.text).not.toContain(' ');
      }
    }
  });
});
