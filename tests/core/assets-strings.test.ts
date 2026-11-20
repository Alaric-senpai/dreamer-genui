import { describe, expect, test, vi } from 'vitest';
import { createAssetResolver } from '../../packages/dreamer-genui/src/core/assets';
import {
  createTranslator,
  formatString,
  resolveStrings,
  SWAHILI_STRINGS,
} from '../../packages/dreamer-genui/src/core/strings';
import { defineStrings, defineProfile } from '../../packages/dreamer-genui/src/core/plugin';
import { createRegistry } from '../../packages/dreamer-genui/src/core';
import { profileBlockTypes, profileIncludes } from '../../packages/dreamer-genui/src/core/profiles';
import { getSystemPromptGuide } from '../../packages/dreamer-genui/src/core/generators/prompt-guide';
import { computeMountedNodes } from '../../packages/dreamer-genui/src/core/mounted';
import { createBoard } from '../../packages/dreamer-genui/src/core/reducer';
import type { BoardState } from '../../packages/dreamer-genui/src/core/types';

describe('asset resolver (§7.6)', () => {
  test('resolves through the host callback and caches results', async () => {
    const resolve = vi.fn(() => 'https://assets.example/a.png');
    const assets = createAssetResolver(resolve);
    await expect(assets.resolve('a')).resolves.toBe('https://assets.example/a.png');
    await expect(assets.resolve('a')).resolves.toBe('https://assets.example/a.png');
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(assets.has('a')).toBe(true);
    expect(assets.peek('a')).toBe('https://assets.example/a.png');
    expect(assets.size()).toBe(1);
  });

  test('deduplicates concurrent requests for the same id', async () => {
    const resolve = vi.fn(async () => 'url');
    const assets = createAssetResolver(resolve);
    const [first, second] = await Promise.all([assets.resolve('x'), assets.resolve('x')]);
    expect(first).toBe('url');
    expect(second).toBe('url');
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  test('host misses and throwing callbacks resolve to undefined (non-fatal)', async () => {
    const assets = createAssetResolver(id => (id === 'known' ? 'url' : undefined));
    await expect(assets.resolve('known')).resolves.toBe('url');
    await expect(assets.resolve('unknown')).resolves.toBeUndefined();

    const throwing = createAssetResolver(() => {
      throw new Error('network down');
    });
    await expect(throwing.resolve('x')).resolves.toBeUndefined();
    expect(throwing.has('x')).toBe(false);
  });

  test('LRU eviction respects maxEntries; clear drops one or all', async () => {
    const assets = createAssetResolver(id => `u-${id}`, { maxEntries: 2 });
    await assets.resolve('a');
    await assets.resolve('b');
    expect(assets.size()).toBe(2);
    await assets.resolve('c'); // evicts the oldest ('a')
    expect(assets.has('a')).toBe(false);
    expect(assets.has('b')).toBe(true);
    expect(assets.has('c')).toBe(true);

    assets.clear('b');
    expect(assets.has('b')).toBe(false);
    assets.clear();
    expect(assets.size()).toBe(0);
  });
});

describe('strings registry (§7.11)', () => {
  test('English defaults resolve without any registered bundle', () => {
    const t = createTranslator(createRegistry());
    expect(t('board.skip')).toBe('Skip');
    expect(t('board.empty')).toBe('Nothing on the board yet.');
  });

  test('Swahili (or any registered locale) overrides with English fallback for gaps', () => {
    const registry = createRegistry();
    registry.register('strings', 'sw', defineStrings({ locale: 'sw', strings: SWAHILI_STRINGS }));
    const t = createTranslator(registry, 'sw');
    expect(t('board.skip')).toBe('Ruka');
    expect(t('assessment.of')).toBe('kati ya');
    expect(t.locale).toBe('sw');

    // A partial custom locale is gap-filled from English.
    registry.register('strings', 'xx', defineStrings({ locale: 'xx', strings: { 'board.skip': 'X' } }));
    const partial = createTranslator(registry, 'xx');
    expect(partial('board.skip')).toBe('X');
    expect(partial('board.return')).toBe('Back');
  });

  test('placeholder interpolation via formatString', () => {
    expect(formatString('Question {n} of {total}', { n: 2, total: 10 })).toBe('Question 2 of 10');
    expect(formatString('Question {n} of {total}')).toBe('Question {n} of {total}');
    expect(formatString('Hi {missing}', { other: 1 })).toBe('Hi {missing}');
  });

  test('resolveStrings merges the fallback chain in order', () => {
    const registry = createRegistry();
    registry.register('strings', 'sw', defineStrings({ locale: 'sw', strings: { 'board.skip': 'Ruka' } }));
    registry.register('strings', 'sw-KE', defineStrings({ locale: 'sw-KE', strings: { 'board.skip': 'Ruka sasa' } }));
    const strings = resolveStrings(registry, 'sw-KE', ['sw']);
    expect(strings['board.skip']).toBe('Ruka sasa');
    expect(strings['board.return']).toBe('Back');
  });
});

describe('capability profiles (§9.4)', () => {
  test('built-in lesson profile excludes the assessment shell', () => {
    const registry = createRegistry();
    const types = profileBlockTypes(registry, 'lesson');
    expect(types).toContain('text');
    expect(types).toContain('question');
    expect(types).not.toContain('assessment');
    expect(profileIncludes(registry, 'lesson', 'flashcards')).toBe(true);
  });

  test('assessment profile keeps the shell but trims content types', () => {
    const registry = createRegistry({ plugins: { assessment: true } });
    const types = profileBlockTypes(registry, 'assessment');
    expect(types).toContain('assessment');
    expect(types).not.toContain('table');
    expect(types).not.toContain('math');
  });

  test('minimal profile is small and custom profiles register via defineProfile', () => {
    const registry = createRegistry({ strictPlugins: false });
    expect(profileBlockTypes(registry, 'minimal')).toEqual(['text', 'choices', 'callout', 'group']);

    registry.register('profiles', 'acme:tiny', defineProfile({ description: 'tiny', include: ['text'] }));
    expect(profileBlockTypes(registry, 'acme:tiny')).toEqual(['text']);
    expect(profileIncludes(registry, 'acme:tiny', 'choices')).toBe(false);
  });

  test('the prompt guide filters by profile and honours guideOverrides', () => {
    const registry = createRegistry();
    const guide = getSystemPromptGuide(registry, { profile: 'minimal' });
    expect(guide).toContain('**text**');
    expect(guide).not.toContain('**assessment**');
    expect(guide).toContain('Profile: minimal');

    const overridden = getSystemPromptGuide(registry, {
      profile: 'minimal',
      guideOverrides: { text: 'custom text guide' },
    });
    expect(overridden).toContain('custom text guide');
  });
});

describe('mounted-node cap (§7.6)', () => {
  const stateFor = (ids: string[]): BoardState => {
    const state = createBoard();
    for (const id of ids) {
      state.nodes[id] = { id, block: { id, type: 'text', variant: 'body', content: [id] }, state: 'complete' };
    }
    return state;
  };

  test('under the cap everything entered stays mounted', () => {
    const plan = computeMountedNodes(stateFor(['a', 'b', 'c']), { entered: ['a', 'b'] });
    expect(plan).toEqual({ mounted: ['a', 'b'], archived: [] });
  });

  test('beyond the cap, the oldest entered nodes archive (state untouched)', () => {
    const state = stateFor(['a', 'b', 'c', 'd', 'e']);
    const plan = computeMountedNodes(state, { entered: ['a', 'b', 'c', 'd', 'e'], maxMountedNodes: 3 });
    expect(plan.archived).toEqual(['a', 'b']);
    expect(plan.mounted).toEqual(['c', 'd', 'e']);
    // Board state is unaffected: archiving is a render concern only.
    expect(Object.keys(state.nodes)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('protected nodes stay mounted even when old', () => {
    const state = stateFor(['a', 'b', 'c', 'd']);
    const plan = computeMountedNodes(state, { entered: ['a', 'b', 'c', 'd'], maxMountedNodes: 2, protectedIds: ['a'] });
    expect(plan.archived).toEqual(['b']);
    expect(plan.mounted).toEqual(['a', 'c', 'd']);
  });

  test('the cap is clamped to at least 1', () => {
    const plan = computeMountedNodes(stateFor(['a', 'b']), { entered: ['a', 'b'], maxMountedNodes: 0 });
    expect(plan.mounted).toEqual(['b']);
    expect(plan.archived).toEqual(['a']);
  });
});
