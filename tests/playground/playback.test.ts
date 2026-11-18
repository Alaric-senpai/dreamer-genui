import { describe, expect, it } from 'vitest';
import type { Reply } from 'dreamer-genui';
import { planBeats } from '../../apps/playground/app/(tailwind)/app/playback';

// Ops in these tests are protocol literals before schema defaults are applied.
const reply = (ops: unknown[]): Reply => ({ v: 1, ops } as Reply);

describe('planBeats', () => {
  it('pages one block at a time and carries pending ops onto the next beat', () => {
    const beats = planBeats(
      reply([
        { op: 'theme', theme: { mood: 'grave' } },
        {
          op: 'append',
          blocks: [
            { id: 'intro', type: 'text', variant: 'body', content: ['First beat'] },
            { id: 'question', type: 'text', variant: 'body', content: ['Second block'] },
          ],
        },
        { op: 'layout', layout: { kind: 'split' } },
        { op: 'append', blocks: [{ id: 'next', type: 'text', variant: 'body', content: ['Next'] }] },
      ])
    );

    expect(beats).toHaveLength(3);
    expect(beats[0]?.ops.map((op) => op.op)).toEqual(['theme', 'append']);
    expect(beats[0]?.nodeIds).toEqual(['intro']);
    expect(beats[0]?.label).toContain('First beat');
    expect(beats[1]?.nodeIds).toEqual(['question']);
    expect(beats[1]?.ops[0]?.op).toBe('append');
    expect(beats[2]?.ops.map((op) => op.op)).toEqual(['layout', 'append']);
    expect(beats[2]?.nodeIds).toEqual(['next']);
  });

  it('applies a trailing non-visual op as a meta-only beat', () => {
    const beats = planBeats(reply([{ op: 'theme', theme: { mood: 'calm' } }]));
    expect(beats).toHaveLength(1);
    expect(beats[0]?.nodeIds).toEqual([]);
    expect(beats[0]?.label).toBe('Mood: calm');
  });

  it('keeps an attach detour together and includes its target', () => {
    const beats = planBeats(
      reply([
        {
          op: 'attach',
          to: 'diagram',
          blocks: [
            { id: 'explainer', type: 'text', variant: 'body', content: ['Explainer'] },
            { id: 'detail', type: 'text', variant: 'note', content: ['Detail'] },
          ],
        },
      ])
    );

    expect(beats).toHaveLength(1);
    expect(beats[0]?.nodeIds).toEqual(['diagram', 'explainer', 'detail']);
  });

  it('collects cue ids from nested triggers and camera paths', () => {
    const beats = planBeats(
      reply([
        {
          op: 'append',
          blocks: [
            {
              id: 'a',
              type: 'text',
              variant: 'body',
              content: ['A'],
              enter: { effect: 'rise', trigger: { on: 'cue', id: 'beat-a' } },
            },
            {
              id: 'b',
              type: 'text',
              variant: 'body',
              content: ['B'],
              enter: { effect: 'rise', trigger: { on: 'cue', id: 'beat-b' } },
            },
          ],
        },
        {
          op: 'camera',
          path: [
            { to: 'a', trigger: { on: 'cue', id: 'cam-a' } },
            { to: 'b', trigger: { on: 'cue', id: 'cam-b' } },
          ],
        },
      ])
    );

    expect(beats[0]?.cueIds).toEqual(['beat-a']);
    expect(beats[1]?.cueIds).toEqual(['beat-b', 'cam-a', 'cam-b']);
    expect(beats[1]?.nodeIds).toEqual(['b']);
  });
});
