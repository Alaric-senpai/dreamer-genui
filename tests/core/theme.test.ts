// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { BoardResolver } from '../../packages/dreamer-genui/src/core/resolver';
import { computeEntryPlan } from '../../packages/dreamer-genui/src/core/cues';
import type { LibraryError } from '../../packages/dreamer-genui/src/core/types';
import type { UIEvent } from '../../packages/dreamer-genui/src/schema/events';

function textBlock(id: string, trigger?: unknown): Record<string, unknown> {
  return {
    id,
    type: 'text',
    variant: 'body',
    content: [id],
    ...(trigger !== undefined ? { enter: trigger } : {}),
  };
}

describe('theme op through the resolver', () => {
  test('applies a registered mood to board state', () => {
    const r = new BoardResolver();
    r.applyOps({ v: 1, ops: [{ op: 'theme', theme: { mood: 'solemn' } }] });
    const state = r.getState();
    expect(state.theme?.mood).toBe('solemn');
    expect(state.theme?.surface).toBe('chalkboard');
    expect(state.theme?.ambience?.preset).toBe('fog');
    // slow tempo from the preset
    expect(state.theme?.tokens.motion?.speed).toBeLessThan(1);
  });

  test('camera op is validated but leaves state unchanged', () => {
    const r = new BoardResolver();
    r.applyOps({
      v: 1,
      ops: [
        { op: 'append', blocks: [textBlock('a')] },
        { op: 'camera', to: 'a', zoom: 1.4 },
      ],
    });
    expect(r.getState().nodes['a']).toBeDefined();
  });

  test('unregistered mood → theme-rejected warning, valid parts still resolve', () => {
    const errors: LibraryError[] = [];
    const r = new BoardResolver({ onError: e => errors.push(e) });
    r.applyOps({ v: 1, ops: [{ op: 'theme', theme: { mood: 'forbidden-frolic', ambience: 'fog' } }] });
    expect(errors.some(e => e.code === 'theme-rejected' && e.detail?.includes('forbidden-frolic'))).toBe(true);
    const state = r.getState();
    expect(state.theme?.mood).toBeUndefined();
    expect(state.theme?.ambience?.preset).toBe('fog'); // valid piece kept
  });

  test('policy "none" rejects theme changes entirely', () => {
    const r = new BoardResolver({ theme: { policy: 'none' } });
    r.applyOps({ v: 1, ops: [{ op: 'theme', theme: { mood: 'calm' } }] });
    expect(r.getState().theme).toBeUndefined();
  });

  test('policy "moods" strips tokens with a warning, keeps the mood', () => {
    const r = new BoardResolver({ theme: { policy: 'moods' } });
    r.applyOps({
      v: 1,
      ops: [{ op: 'theme', theme: { mood: 'calm', tokens: { color: { bg: '#ff0000' } } } }],
    });
    const theme = r.getState().theme;
    expect(theme?.mood).toBe('calm');
    expect(theme?.tokens.color?.bg).not.toBe('#ff0000');
  });

  test('policy "moods+tokens" applies tokens; unparsable colours dropped with a warning', () => {
    const r = new BoardResolver({ theme: { policy: 'moods+tokens' } });
    r.applyOps({
      v: 1,
      ops: [{ op: 'theme', theme: { tokens: { color: { bg: 'url(https://x.example)' } } } }],
    });
    expect(r.getState().theme?.tokens.color?.bg).not.toContain('url');
  });

  test('unreadable palette is auto-corrected by the contrast guardrail', () => {
    const adjustedSeen: string[][] = [];
    const r = new BoardResolver({
      theme: {
        policy: 'moods+tokens',
        onThemeAdjusted: roles => adjustedSeen.push(roles),
      },
    });
    r.applyOps({
      v: 1,
      ops: [
        {
          op: 'theme',
          theme: {
            tokens: {
              color: { bg: '#0c0c10', surface: '#101018', ink: '#171720', accent: '#1a1a26', muted: '#101018' },
            },
          },
        },
      ],
    });
    const color = r.getState().theme?.tokens.color;
    expect(color?.ink).not.toBe('#171720'); // adjusted
    expect(adjustedSeen.length).toBeGreaterThan(0);
    expect(adjustedSeen[0]).toContain('ink');
  });

  test('detour-scoped theme attaches to the open detour, not the board', () => {
    const r = new BoardResolver();
    r.applyOps({ v: 1, ops: [{ op: 'append', blocks: [textBlock('a')] }] });
    r.applyOps({
      v: 1,
      ops: [{ op: 'attach', to: 'a', blocks: [textBlock('d1', undefined)] }],
    });
    r.applyOps({ v: 1, ops: [{ op: 'theme', theme: { mood: 'eerie' }, scope: 'detour' }] });
    const state = r.getState();
    expect(state.theme).toBeUndefined();
    expect(state.detours[0]?.theme?.mood).toBe('eerie');
  });
});

describe('history with theme and cues', () => {
  test('replace resets fired cues, back() restores board, theme and cues', () => {
    const r = new BoardResolver();
    r.applyOps({
      v: 1,
      ops: [
        { op: 'append', blocks: [textBlock('a', { effect: 'reveal', trigger: { on: 'cue', id: 'beat-1' } })] },
        { op: 'theme', theme: { mood: 'solemn' } },
      ],
    });
    r.cue('beat-1');
    expect(r.getState().firedCues).toEqual(['beat-1']);
    expect(r.getState().theme?.mood).toBe('solemn');

    r.applyOps({
      v: 1,
      ops: [{ op: 'replace', title: 'Next', blocks: [textBlock('b')] }],
    });
    expect(r.getState().firedCues).toEqual([]);
    expect(r.getState().theme).toBeUndefined();

    r.back();
    const restored = r.getState();
    expect(restored.nodes['a']).toBeDefined();
    expect(restored.firedCues).toEqual(['beat-1']);
    expect(restored.theme?.mood).toBe('solemn');
  });

  test('replace carries its own theme for the new board', () => {
    const r = new BoardResolver();
    r.applyOps({
      v: 1,
      ops: [{ op: 'replace', theme: { mood: 'playful' }, blocks: [textBlock('b')] }],
    });
    expect(r.getState().theme?.mood).toBe('playful');
  });
});

describe('cue engine through the resolver', () => {
  test('cue() fires cues; pending nodes enter; onEnter/onCue notifications fire', () => {
    const cues: string[] = [];
    const entered: string[] = [];
    const r = new BoardResolver();
    r.cueBus.subscribe(id => cues.push(id));
    r.enterBus.subscribe(id => entered.push(id));
    r.applyOps({
      v: 1,
      ops: [{ op: 'append', blocks: [textBlock('a', { effect: 'words', trigger: { on: 'cue', id: 'beat-1' } })] }],
    });
    expect(computeEntryPlan(r.getState()).pending).toEqual(['a']);
    r.cue('beat-1');
    expect(cues).toEqual(['beat-1']);
    expect(entered).toEqual(['a']);
    expect(computeEntryPlan(r.getState()).entered).toEqual(['a']);
  });

  test('cue-cycle: cyclic after-triggers are rewritten to start with a cue-cycle warning', () => {
    const errors: LibraryError[] = [];
    const r = new BoardResolver({ onError: e => errors.push(e) });
    const results = r.applyOps({
      v: 1,
      ops: [
        {
          op: 'append',
          blocks: [
            textBlock('cycle-a', { effect: 'reveal', trigger: { on: 'after', node: 'cycle-b' } }),
            textBlock('cycle-b', { effect: 'reveal', trigger: { on: 'after', node: 'cycle-a' } }),
          ],
        },
      ],
    });
    expect(results.every(x => x.status === 'applied')).toBe(true);
    expect(errors.some(e => e.code === 'cue-cycle')).toBe(true);
    // both nodes fall back to start → entered immediately
    expect(computeEntryPlan(r.getState()).entered).toEqual(['cycle-a', 'cycle-b']);
  });

  test('flush() and seek() reach the store-level state', () => {
    const r = new BoardResolver();
    r.applyOps({
      v: 1,
      ops: [
        { op: 'append', blocks: [
          textBlock('a', { effect: 'words', trigger: { on: 'cue', id: 'b1' } }),
          textBlock('b', { effect: 'words', trigger: { on: 'cue', id: 'b2' } }),
          textBlock('c', { effect: 'words', trigger: { on: 'cue', id: 'b3' } }),
        ] },
      ],
    });
    r.seek('b2');
    expect(r.getState().firedCues).toEqual(['b1', 'b2']);
    r.flush();
    expect(r.getState().flushed).toBe(true);
    expect(computeEntryPlan(r.getState()).pending).toEqual([]);
  });

  test('UIEvents automatically satisfy event triggers', () => {
    const r = new BoardResolver();
    r.applyOps({
      v: 1,
      ops: [{ op: 'append', blocks: [
        textBlock('card'),
        textBlock('b', { effect: 'pop', trigger: { on: 'event', node: 'card', event: 'select' } }),
      ] }],
    });
    expect(computeEntryPlan(r.getState()).pending).toEqual(['b']);
    const ev: UIEvent = { type: 'select', nodeId: 'card', ref: 'card/x', label: 'X' };
    r.events.emit(ev);
    expect(computeEntryPlan(r.getState()).entered).toEqual(['card', 'b']);
  });
});
