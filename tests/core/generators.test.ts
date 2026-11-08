import { describe, expect, test } from 'vitest';
import { serializeBoard } from '../../packages/dreamer-genui/src/core/generators/serialize-board';
import { getSystemPromptGuide } from '../../packages/dreamer-genui/src/core/generators/prompt-guide';
import { getCapabilities, getDefaultCapabilities } from '../../packages/dreamer-genui/src/core/generators/capabilities';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import { createBoard } from '../../packages/dreamer-genui/src/core/reducer';

describe('serializeBoard', () => {
  test('empty board shows correct header', () => {
    const state = createBoard('board-1');
    const out = serializeBoard(state);
    expect(out).toContain('board-1');
    expect(out).toContain('Nodes: 0');
  });

  test('includes node ids and types', () => {
    const state = createBoard('b1');
    state.nodes['n1'] = { id: 'n1', block: { id: 'n1', type: 'text', variant: 'body', content: ['Hello'] }, state: 'complete' };
    state.nodes['n2'] = { id: 'n2', block: { id: 'n2', type: 'choices', intent: 'navigate', layout: 'chips', items: [] }, state: 'complete' };
    const out = serializeBoard(state);
    expect(out).toContain('n1');
    expect(out).toContain('text');
    expect(out).toContain('n2');
    expect(out).toContain('choices');
  });

  test('includes title', () => {
    const state = createBoard('b1');
    state.title = 'Photosynthesis';
    const out = serializeBoard(state);
    expect(out).toContain('Photosynthesis');
  });

  test('includes open detours', () => {
    const state = createBoard('b1');
    state.nodes['n1'] = { id: 'n1', block: { id: 'n1', type: 'text', variant: 'body', content: [] }, state: 'complete' };
    state.detours = [{ id: 'd1', targetNodeId: 'n1', blocks: [], openAt: 0 }];
    const out = serializeBoard(state);
    expect(out).toContain('Open detours');
    expect(out).toContain('n1');
  });

  test('includes history count', () => {
    const state = createBoard('b1');
    state.history = [{ id: 'h1', nodes: {} }, { id: 'h2', nodes: {} }];
    const out = serializeBoard(state);
    expect(out).toContain('History: 2');
  });
});

describe('getSystemPromptGuide', () => {
  test('returns a string containing operations section', () => {
    const reg = createRegistry();
    const guide = getSystemPromptGuide(reg);
    expect(guide).toContain('append');
    expect(guide).toContain('attach');
    expect(guide).toContain('replace');
  });

  test('returns a string containing block types', () => {
    const reg = createRegistry();
    const guide = getSystemPromptGuide(reg);
    expect(guide).toContain('text');
    expect(guide).toContain('choices');
    expect(guide).toContain('steps');
  });

  test('compact mode is shorter', () => {
    const reg = createRegistry();
    const full = getSystemPromptGuide(reg);
    const compact = getSystemPromptGuide(reg, { compact: true });
    expect(compact.length).toBeLessThan(full.length);
  });

  test('excludes ops when in exclude list', () => {
    const reg = createRegistry();
    const guide = getSystemPromptGuide(reg, { exclude: ['ops'] });
    expect(guide).not.toContain('## Operations');
  });
});

describe('getCapabilities', () => {
  test('returns array of type strings', () => {
    const reg = createRegistry();
    const caps = getCapabilities(reg);
    expect(Array.isArray(caps)).toBe(true);
    expect(caps.length).toBeGreaterThan(0);
  });

  test('getDefaultCapabilities returns default types', () => {
    const caps = getDefaultCapabilities();
    expect(caps).toContain('text');
    expect(caps).toContain('figure.image');
    expect(caps).toContain('choices');
    expect(caps).toContain('math');
  });

  test('capabilities include figure kinds', () => {
    const reg = createRegistry();
    const caps = getCapabilities(reg);
    expect(caps.some(c => c.startsWith('figure.'))).toBe(true);
  });
});
