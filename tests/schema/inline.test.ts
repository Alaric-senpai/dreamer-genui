import { describe, expect, test } from 'vitest';
import { InlineSchema, MarkSchema } from '../../packages/dreamer-genui/src/schema/inline';

describe('Inline', () => {
  test('parses plain string', () => {
    expect(InlineSchema.parse('hello')).toBe('hello');
  });

  test('rejects plain string array (inline is string | Mark, arrays must be Inline[])', () => {
    // Per spec: Inline = string | Mark. To parse string arrays, use z.array(InlineSchema)
    expect(() => InlineSchema.parse(['hello', 'world'])).toThrow();
  });

  test('parses highlight mark with color token', () => {
    const mark = { mark: 'highlight' as const, text: 'living things', color: 'accent' };
    expect(MarkSchema.parse(mark)).toEqual(mark);
  });

  test('parses emphasis mark', () => {
    const mark = { mark: 'emphasis' as const, text: 'important' };
    expect(MarkSchema.parse(mark)).toEqual(mark);
  });

  test('parses term mark with definition', () => {
    const mark = { mark: 'term' as const, text: 'Biology', definition: 'the study of living things' };
    expect(MarkSchema.parse(mark)).toEqual(mark);
  });

  test('parses focusable mark with ref', () => {
    const mark = { mark: 'focusable' as const, text: 'Branches', ref: 'branches/botany' };
    expect(MarkSchema.parse(mark)).toEqual(mark);
  });

  test('parses annotate mark with all kinds', () => {
    for (const kind of ['circle', 'underline', 'box', 'bracket', 'strike'] as const) {
      const mark = { mark: 'annotate' as const, text: 'Cell', kind };
      const parsed = MarkSchema.parse(mark) as { kind: string };
      expect(parsed.kind).toBe(kind);
    }
  });

  test('parses math mark', () => {
    const mark = { mark: 'math' as const, tex: '\\ce{H2O}' };
    expect(MarkSchema.parse(mark)).toEqual(mark);
  });

  test('rejects unknown mark type', () => {
    expect(() => MarkSchema.parse({ mark: 'bold', text: 'text' })).toThrow();
  });

  test('rejects invalid color token', () => {
    expect(() => InlineSchema.parse({ mark: 'highlight', text: 'x', color: 'rainbow' })).toThrow();
  });

  // Inline[] (array of inline) is a TypeScript type; actual usage is covered by block schema tests
  // which use content: Inline[] in the text block
});
