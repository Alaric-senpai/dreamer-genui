import { describe, expect, test } from 'vitest';
import { BlockSchema } from '../../packages/dreamer-genui/src/schema/blocks';

describe('Blocks', () => {
  test('parses text block body', () => {
    const block = { id: 't1', type: 'text', variant: 'body', content: ['Hello world'] };
    expect(BlockSchema.parse(block)).toMatchObject({ type: 'text', variant: 'body' });
  });

  test('parses text block definition with highlight', () => {
    const block = {
      id: 'def-bio',
      type: 'text',
      variant: 'definition',
      content: ['Biology is ', { mark: 'highlight', text: 'living things', color: 'accent' }],
    };
    expect(BlockSchema.parse(block).variant).toBe('definition');
  });

  test('parses figure block', () => {
    const block = {
      id: 'fig1',
      type: 'figure',
      figure: { kind: 'image', src: 'url', alt: 'desc' },
      caption: ['A diagram'],
    };
    expect(BlockSchema.parse(block).type).toBe('figure');
  });

  test('parses choices block navigate intent', () => {
    const block = {
      id: 'branches',
      type: 'choices',
      layout: 'chips',
      intent: 'navigate',
      items: [
        { id: 'botany', label: 'Botany', ref: 'branches/botany' },
        { id: 'zoology', label: 'Zoology', ref: 'branches/zoology' },
      ],
    };
    expect(BlockSchema.parse(block).intent).toBe('navigate');
  });

  test('parses choices block answer intent multi', () => {
    const block = {
      id: 'q1',
      type: 'choices',
      layout: 'list',
      intent: 'answer',
      multi: true,
      items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    };
    expect(BlockSchema.parse(block)).toMatchObject({ intent: 'answer', multi: true });
  });

  test('parses steps block sequential', () => {
    const block = {
      id: 'steps1',
      type: 'steps',
      reveal: 'sequential',
      items: [
        { id: 's1', title: 'Step 1', content: ['First do this'] },
        { id: 's2', title: 'Step 2', content: ['Then do that'] },
      ],
    };
    expect(BlockSchema.parse(block).reveal).toBe('sequential');
  });

  test('parses callout block with all tones', () => {
    for (const tone of ['info', 'success', 'warn', 'danger'] as const) {
      const block = { id: 'c1', type: 'callout', tone, content: ['Message'] };
      expect(BlockSchema.parse(block).tone).toBe(tone);
    }
  });

  test('parses group block with nested blocks', () => {
    const block = {
      id: 'g1',
      type: 'group',
      layout: 'row',
      blocks: [
        { id: 't1', type: 'text', variant: 'body', content: ['One'] },
        { id: 't2', type: 'text', variant: 'body', content: ['Two'] },
      ],
    };
    expect(BlockSchema.parse(block).layout).toBe('row');
  });

  test('parses table block', () => {
    const block = {
      id: 'tbl1',
      type: 'table',
      columns: [{ id: 'col1', label: 'Name' }, { id: 'col2', label: 'Age' }],
      rows: [
        { col1: ['Alice'], col2: ['12'] },
        { col2: ['Bob'], col1: ['13'] },
      ],
    };
    expect(BlockSchema.parse(block).type).toBe('table');
  });

  test('parses math block inline', () => {
    const block = { id: 'm1', type: 'math', tex: '\\ce{H2O}' };
    expect(BlockSchema.parse(block).tex).toBe('\\ce{H2O}');
  });

  test('parses math block display', () => {
    const block = { id: 'm1', type: 'math', tex: 'x = y + z', display: true };
    expect(BlockSchema.parse(block).display).toBe(true);
  });

  test('parses code block', () => {
    const block = { id: 'code1', type: 'code', lang: 'python', source: 'print("hello")' };
    expect(BlockSchema.parse(block)).toMatchObject({ lang: 'python' });
  });

  test('parses block with NodeBase fields (enter, exit)', () => {
    const block = {
      id: 't1',
      type: 'text',
      variant: 'body',
      content: ['Hello'],
      enter: { effect: 'rise', order: 1 },
      exit: { effect: 'fade' },
    };
    const parsed = BlockSchema.parse(block);
    expect(parsed.enter?.effect).toBe('rise');
    expect(parsed.exit?.effect).toBe('fade');
  });

  test('rejects unknown block type', () => {
    expect(() => BlockSchema.parse({ id: 'x', type: 'unknown-widget', name: 'test' })).toThrow();
  });

  test('rejects duplicate id not caught by schema (idempotence concern)', () => {
    // Duplicate detection happens at the board reducer level, not the schema level
    const block = { id: 'duplicate-id', type: 'text', variant: 'body', content: ['A'] };
    expect(BlockSchema.parse(block).id).toBe('duplicate-id');
  });

  test('rejects block with missing required fields', () => {
    expect(() => BlockSchema.parse({ id: 't1', type: 'text', variant: 'body' })).toThrow();
  });
});
