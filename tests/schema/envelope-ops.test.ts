import { describe, expect, test } from 'vitest';
import { ReplySchema } from '../../packages/dreamer-genui/src/schema/envelope';
import { OpSchema, AppendOpSchema, AttachOpSchema, ReplaceOpSchema, UpdateOpSchema, RemoveOpSchema } from '../../packages/dreamer-genui/src/schema/ops';

describe('Reply envelope', () => {
  test('parses valid v1 reply', () => {
    const reply = { v: 1, ops: [] };
    expect(ReplySchema.parse(reply)).toEqual(reply);
  });

  test('rejects v other than 1', () => {
    expect(() => ReplySchema.parse({ v: 2, ops: [] })).toThrow();
  });

  test('rejects missing v', () => {
    expect(() => ReplySchema.parse({ ops: [] })).toThrow();
  });

  test('rejects missing ops', () => {
    expect(() => ReplySchema.parse({ v: 1 })).toThrow();
  });
});

describe('Op: append', () => {
  test('parses minimal append op', () => {
    const op = { op: 'append', blocks: [] };
    expect(AppendOpSchema.parse(op)).toEqual({ ...op, after: undefined });
  });

  test('parses append with blocks and after', () => {
    const op = { op: 'append', blocks: [{ id: 'n1', type: 'text', variant: 'body', content: ['hello'] }], after: 'prev-node' };
    expect(AppendOpSchema.parse(op)).toMatchObject({ op: 'append', after: 'prev-node' });
  });

  test('rejects append without op field', () => {
    expect(() => AppendOpSchema.parse({ blocks: [] })).toThrow();
  });
});

describe('Op: attach', () => {
  test('parses minimal attach op', () => {
    const op = { op: 'attach', to: 'target-id', blocks: [] };
    const parsed = AttachOpSchema.parse(op);
    expect(parsed.op).toBe('attach');
    expect(parsed.placement).toBe('inline');
    expect(parsed.connector).toBe('none');
    expect(parsed.mode).toBe('inline');
  });

  test('parses attach with all placement options', () => {
    for (const placement of ['right', 'left', 'above', 'below', 'overlay', 'inline'] as const) {
      const op = { op: 'attach', to: 'target', blocks: [], placement };
      expect(AttachOpSchema.parse(op).placement).toBe(placement);
    }
  });

  test('parses attach with connector and target annotate', () => {
    const op = {
      op: 'attach', to: 'btn', blocks: [],
      connector: 'arrow',
      target: { annotate: 'circle' as const },
    };
    const parsed = AttachOpSchema.parse(op);
    expect(parsed.connector).toBe('arrow');
    expect(parsed.target?.annotate).toBe('circle');
  });
});

describe('Op: replace', () => {
  test('parses replace with title', () => {
    const op = { op: 'replace', blocks: [], title: 'New Topic' };
    expect(ReplaceOpSchema.parse(op)).toMatchObject({ op: 'replace', title: 'New Topic' });
  });

  test('parses replace without title', () => {
    const op = { op: 'replace', blocks: [] };
    expect(ReplaceOpSchema.parse(op).title).toBeUndefined();
  });
});

describe('Op: update', () => {
  test('parses update with props', () => {
    const op = { op: 'update', id: 'node-1', props: { highlight: true } };
    expect(UpdateOpSchema.parse(op)).toMatchObject({ op: 'update', id: 'node-1' });
  });
});

describe('Op: remove', () => {
  test('parses remove op', () => {
    const op = { op: 'remove', id: 'node-1' };
    expect(RemoveOpSchema.parse(op)).toMatchObject({ op: 'remove', id: 'node-1' });
  });
});

describe('Op discriminated union', () => {
  test('parses all op types', () => {
    const ops = [
      { op: 'append', blocks: [] },
      { op: 'attach', to: 'x', blocks: [] },
      { op: 'replace', blocks: [] },
      { op: 'update', id: 'x', props: {} },
      { op: 'remove', id: 'x' },
    ];
    for (const op of ops) {
      expect(OpSchema.parse(op).op).toBe(op.op);
    }
  });

  test('rejects unknown op type', () => {
    expect(() => OpSchema.parse({ op: 'delete', id: 'x' })).toThrow();
  });
});
