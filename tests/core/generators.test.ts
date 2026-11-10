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

  test('includes open detours with their block ids and types', () => {
    const state = createBoard('b1');
    state.nodes['n1'] = { id: 'n1', block: { id: 'n1', type: 'text', variant: 'body', content: [] }, state: 'complete' };
    state.detours = [{
      id: 'd1', targetNodeId: 'n1', openAt: 0,
      blocks: [{ id: 'botany-detail', type: 'text', variant: 'body', content: ['Botany studies plants.'] }],
    }];
    const out = serializeBoard(state);
    expect(out).toContain('Open detours');
    expect(out).toContain('n1');
    expect(out).toContain('botany-detail');   // detour node id visible to the tutor
    expect(out).toContain('text');
  });

  test('emits parent/item refs for choices items', () => {
    const state = createBoard('b1');
    state.nodes['branches'] = {
      id: 'branches',
      block: { id: 'branches', type: 'choices', intent: 'navigate', layout: 'list', items: [{ id: 'botany', label: 'Botany' }, { id: 'zoology', label: 'Zoology' }] },
      state: 'complete',
    };
    const out = serializeBoard(state);
    expect(out).toContain('branches/botany branches/zoology');
  });

  test('includes history count', () => {
    const state = createBoard('b1');
    state.history = [
      { id: 'h1', nodes: {}, firedCues: [], firedEvents: {}, flushed: false },
      { id: 'h2', nodes: {}, firedCues: [], firedEvents: {}, flushed: false },
    ];
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

  test('is registry-aware — includes the built-in manifest snippets', () => {
    const reg = createRegistry();
    const guide = getSystemPromptGuide(reg);
    expect(guide).toContain('## Block Types');
    expect(guide).toContain('intent=navigate emits select');      // choices snippet
    expect(guide).toContain('KaTeX-compatible');                  // math snippet
    expect(guide).toContain('**table**');                         // every registered type listed
    expect(guide).toContain('**group**');
  });

  test('include filters the listed types and reports unregistered ones', () => {
    const reg = createRegistry();
    const guide = getSystemPromptGuide(reg, { include: ['text', 'no-such-type'] });
    expect(guide).toContain('**text**');
    expect(guide).not.toContain('**choices**');
    expect(guide).toContain('not registered: no-such-type');
  });

  test('compact mode is shorter', () => {
    const reg = createRegistry();
    const full = getSystemPromptGuide(reg);
    const compact = getSystemPromptGuide(reg, { compact: true });
    expect(compact.length).toBeLessThan(full.length);
  });

  test('language appends an output-language instruction', () => {
    const reg = createRegistry();
    const guide = getSystemPromptGuide(reg, { language: 'Swahili' });
    expect(guide).toContain('Write all student-facing text in Swahili');
  });

  test('snapshot (default options, built-ins registry)', () => {
    const reg = createRegistry();
    expect(getSystemPromptGuide(reg)).toMatchSnapshot();
  });

  test('worked example escapes the mhchem macro correctly', () => {
    const reg = createRegistry();
    const guide = getSystemPromptGuide(reg);
    // In JSON the tex must read "\\ce{...}" (a single backslash when unescaped)
    expect(guide).toContain('"tex": "\\\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}"');
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
