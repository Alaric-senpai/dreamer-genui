import { describe, expect, it } from 'vitest';
import { BlockSchema, ReplySchema } from '../../packages/dreamer-genui/src/schema/index';
import {
  extractReplyObject,
  repairOp,
  repairReply,
  tidy,
  type PlaygroundRepairStats,
} from '../../apps/playground/app/(tailwind)/app/reply-repair';

const solvay = {
  v: 1,
  ops: [
    {
      op: 'append',
      blocks: [
        {
          id: 'solvay',
          type: 'figure',
          figure: {
            kind: 'flowchart',
            nodes: [
              { id: 'n1', label: 'Brine + NH₃', shape: 'input' },
              { id: 'n2', label: 'Absorption Tower', shape: 'process' },
              { id: 'n3', label: 'NaHCO₃', shape: 'output' },
            ],
            edges: [
              { from: 'n1', to: 'n2', kind: 'normal' },
              { from: 'n2', to: 'n3', label: 'CaO', kind: 'loop' },
              { from: 'n3', to: 'missing', kind: 'sideways' },
            ],
            inputs: [{ to: 'n1', label: 'Brine' }],
            outputs: [{ from: 'n3', label: 'Na₂CO₃' }],
          },
        },
      ],
    },
  ],
};

describe('playground reply repair', () => {
  it('strips reasoning tags and code fences', () => {
    const text = '```json\n<think>plan</think>{"v":1,"ops":[]}\n```';
    expect(tidy(text).trim()).toBe('{"v":1,"ops":[]}');
  });

  it('finds the reply object and ignores trailing prose and a second object', () => {
    const raw = `Here you go:\n${JSON.stringify(solvay)}\n\nLet me know if you want labels.\n{"v":1,"ops":[]}`;
    const found = extractReplyObject(raw);
    expect(found).not.toBeNull();
    expect((found?.value as { ops: unknown[] }).ops).toHaveLength(1);
    expect(found?.jsonText.startsWith('{"v":1')).toBe(true);
  });

  it('normalises model flowchart vocabulary so the figure passes the strict schema', () => {
    const repaired = repairOp(JSON.parse(JSON.stringify(solvay.ops[0]))) as {
      blocks: Array<{ figure: Record<string, unknown> }>;
    };
    const figure = repaired.blocks[0]!.figure as {
      nodes: Array<{ id: string; label: unknown; shape: string }>;
      edges: Array<{ from: string; to: string; kind?: string; label?: unknown }>;
      inputs: Array<{ label: unknown }>;
      outputs: Array<{ label: unknown }>;
      alt: string;
    };

    expect(BlockSchema.safeParse(repaired.blocks[0]).success).toBe(true);
    expect(figure.nodes.map((node) => node.shape)).toEqual(['io', 'step', 'io']);
    expect(figure.nodes[0]!.label).toEqual(['Brine + NH₃']);
    // Unknown edge kinds are dropped, known loops become recycle, and the
    // dangling edge to "missing" is removed.
    expect(figure.edges).toHaveLength(2);
    expect(figure.edges[1]!.kind).toBe('recycle');
    expect(figure.edges[1]!.label).toEqual(['CaO']);
    expect(figure.inputs[0]!.label).toEqual(['Brine']);
    expect(figure.alt).toBe('Figure');
  });

  it('salvages a block placed directly in ops as an append op', () => {
    const stats: PlaygroundRepairStats = { droppedOps: 0, salvagedBlocks: 0 };
    const reply = {
      v: 1,
      ops: [
        { type: 'text', id: 'loose', variant: 'body', content: ['Hello'] },
        { op: 'theme', theme: { mood: 'calm' } },
        { nope: true },
      ],
    };
    const repaired = repairReply(reply, stats) as { ops: Array<Record<string, unknown>> };
    expect(stats.salvagedBlocks).toBe(1);
    expect(stats.droppedOps).toBe(1);
    expect(ReplySchema.safeParse(repaired).success).toBe(true);
    expect(repaired.ops).toHaveLength(2);
    expect(repaired.ops[0]).toMatchObject({ op: 'append' });
    expect(repaired.ops[1]).toMatchObject({ op: 'theme' });
  });
});
