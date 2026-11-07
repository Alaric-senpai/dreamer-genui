import { describe, expect, test } from 'vitest';
import { UIEventSchema } from '../../packages/dreamer-genui/src/schema/events';
import { schemaToJsonSchema } from '../../packages/dreamer-genui/src/schema/json-schema';
import { ReplySchema } from '../../packages/dreamer-genui/src/schema/envelope';
import { BlockSchema } from '../../packages/dreamer-genui/src/schema/blocks';

describe('UIEvent', () => {
  test('parses focus event', () => {
    const event = { type: 'focus', nodeId: 'n1', ref: 'child-1', label: 'Option A' };
    const parsed = UIEventSchema.parse(event) as { type: string; nodeId: string; ref?: string; label?: string };
    expect(parsed.type).toBe('focus');
    expect(parsed.nodeId).toBe('n1');
    expect(parsed.ref).toBe('child-1');
    expect(parsed.label).toBe('Option A');
  });

  test('parses select event', () => {
    const event = { type: 'select', nodeId: 'choices1', ref: 'item-2' };
    const parsed = UIEventSchema.parse(event) as { type: string; nodeId: string; ref?: string };
    expect(parsed.type).toBe('select');
    expect(parsed.nodeId).toBe('choices1');
    expect(parsed.ref).toBe('item-2');
  });

  test('parses answer event string', () => {
    expect(UIEventSchema.parse({ type: 'answer', nodeId: 'q1', value: 'b' })).toMatchObject({ type: 'answer', value: 'b' });
  });

  test('parses answer event string array', () => {
    expect(UIEventSchema.parse({ type: 'answer', nodeId: 'q1', value: ['a', 'c'] })).toMatchObject({ type: 'answer', value: ['a', 'c'] });
  });

  test('parses action return event', () => {
    expect(UIEventSchema.parse({ type: 'action', nodeId: 'detour-target', action: 'return' })).toMatchObject({ type: 'action', action: 'return' });
  });

  test('parses action continue event', () => {
    expect(UIEventSchema.parse({ type: 'action', action: 'continue' })).toMatchObject({ action: 'continue' });
  });

  test('parses action custom string event', () => {
    expect(UIEventSchema.parse({ type: 'action', action: 'show-hint' })).toMatchObject({ action: 'show-hint' });
  });

  test('rejects unknown event type', () => {
    expect(() => UIEventSchema.parse({ type: 'click', nodeId: 'x' })).toThrow();
  });
});

describe('JSON Schema export', () => {
  test('ReplySchema produces an object with $schema', () => {
    const jsonSchema = schemaToJsonSchema(ReplySchema);
    expect(jsonSchema).toHaveProperty('$schema');
    expect(jsonSchema).toHaveProperty('type');
  });

  test('BlockSchema produces valid JSON Schema (stringifies without error)', () => {
    const jsonSchema = schemaToJsonSchema(BlockSchema);
    const str = JSON.stringify(jsonSchema);
    expect(() => JSON.parse(str)).not.toThrow();
    // Should be a union type
    const parsed = JSON.parse(str);
    const hasUnionType = parsed.oneOf !== undefined || parsed.anyOf !== undefined;
    expect(hasUnionType).toBe(true);
  });
});

describe('Schema integration: parse a real reply', () => {
  test('parses a full reply with mixed ops and blocks', () => {
    const reply = {
      v: 1,
      ops: [
        {
          op: 'append',
          blocks: [
            {
              id: 'intro',
              type: 'text',
              variant: 'definition',
              content: ['Biology is the study of living things'],
              enter: { effect: 'rise', order: 1 },
            },
          ],
        },
        {
          op: 'attach',
          to: 'intro',
          blocks: [
            {
              id: 'detail-1',
              type: 'callout',
              tone: 'info',
              content: ['Living things include plants, animals and microorganisms'],
            },
          ],
          placement: 'inline',
          connector: 'arrow',
          mode: 'spotlight',
        },
      ],
    };
    const parsed = ReplySchema.parse(reply);
    expect(parsed.v).toBe(1);
    expect(parsed.ops).toHaveLength(2);
  });
});
