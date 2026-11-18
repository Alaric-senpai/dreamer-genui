import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ReplySchema } from '../../packages/dreamer-genui/src/schema/envelope';
import {
  AccordionBlockSchema,
  BlockSchema,
  CardBlockSchema,
  KbdBlockSchema,
  TabsBlockSchema,
} from '../../packages/dreamer-genui/src/schema/blocks';

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'ui-kit-blocks.json'), 'utf8'));

describe('UI-kit block schemas (§6.19)', () => {
  test('the canonical fixture parses as a Reply', () => {
    const reply = ReplySchema.parse(fixture);
    const op = reply.ops[0];
    const blocks = op?.op === 'append' ? op.blocks : [];
    expect(blocks.map((block) => block.type)).toEqual(
      expect.arrayContaining([
        'card',
        'alert',
        'accordion',
        'collapsible',
        'tabs',
        'progress',
        'counter',
        'avatar',
        'separator',
        'carousel',
        'kbd',
      ])
    );
  });

  test('every UI-kit block round-trips through BlockSchema', () => {
    const blocks = fixture.ops[0].blocks as unknown[];
    for (const block of blocks) {
      expect(() => BlockSchema.parse(block)).not.toThrow();
    }
  });

  test('cards accept nesting through the public block union', () => {
    const card = {
      id: 'c1',
      type: 'card',
      blocks: [{ id: 'inner', type: 'badge', text: ['nested'] }],
    };
    const parsed = CardBlockSchema.parse(card);
    expect(parsed.blocks[0]?.type).toBe('badge');
  });

  test('accordion and tabs require at least one item', () => {
    expect(() => AccordionBlockSchema.parse({ id: 'a', type: 'accordion', items: [] })).toThrow();
    expect(() => TabsBlockSchema.parse({ id: 't', type: 'tabs', tabs: [] })).toThrow();
  });

  test('kbd requires at least one non-empty key', () => {
    expect(() => KbdBlockSchema.parse({ id: 'k', type: 'kbd', keys: [] })).toThrow();
    expect(() => KbdBlockSchema.parse({ id: 'k', type: 'kbd', keys: [''] })).toThrow();
  });

  test('progress is bounded to 0..100', () => {
    expect(() => BlockSchema.parse({ id: 'p', type: 'progress', value: 101 })).toThrow();
    expect(() => BlockSchema.parse({ id: 'p', type: 'progress', value: -1 })).toThrow();
  });

  test('UI-kit blocks still honour the node contract (enter/slot/alt)', () => {
    const parsed = BlockSchema.parse({
      id: 'k',
      type: 'kbd',
      keys: ['K'],
      enter: { effect: 'pop' },
      slot: 'right',
      alt: 'Shortcut K',
    });
    expect(parsed.enter?.effect).toBe('pop');
    expect(parsed.slot).toBe('right');
  });
});
