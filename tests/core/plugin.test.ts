import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import {
  createRegistry,
  definePlugin,
  defineBlock,
  defineEffect,
  defineMood,
  defineLayout,
  defineMiddleware,
  defineProfile,
  defineStrings,
  defineModelConnector,
  defineModelPack,
  layoutDefinitionFor,
  ENGINE_VERSION,
  isNamespacedName,
  isCorePluginName,
  satisfiesEngine,
} from '../../packages/dreamer-genui/src/core';
import type { Registry } from '../../packages/dreamer-genui/src/core';

const errorsOf = () => {
  const errors: unknown[] = [];
  const registry = createRegistry({ onError: e => errors.push(e), strictPlugins: false });
  return { errors, registry };
};

/** A toy third-party plugin using ONLY the public SDK (§14 M4b-B accept). */
const toyPlugin = definePlugin({
  name: 'acme:toy',
  version: '1.0.0',
  provides: {
    blocks: {
      'acme:poll': defineBlock({
        schema: z.object({ id: z.string(), type: z.literal('acme:poll'), question: z.string() }),
        promptGuide: 'poll block for the toy plugin',
        fallback: 'Poll unavailable',
      }),
    },
    effects: {
      'acme:spin-in': defineEffect({ driver: 'motion', duration: 400, ease: 'overshoot', reducedMotion: 'fade' }),
    },
    moods: {
      'acme:vintage': defineMood({ name: 'acme:vintage', description: 'Toy vintage mood', tokens: {} as never }),
    },
    layouts: {
      'acme:triptych': defineLayout({ regions: ['left', 'center', 'right'], primary: 'center', narrow: 'stack' }),
    },
  },
});

describe('Plugin SDK (§8)', () => {
  test('a third-party plugin registers a block, effect, mood and layout', () => {
    const registry = createRegistry();
    expect(registry.use(toyPlugin)).toBe(true);

    expect(registry.getManifest('acme:poll')?.promptGuide).toBe('poll block for the toy plugin');
    expect(registry.get('effects', 'acme:spin-in')?.driver).toBe('motion');
    expect(registry.get('moods', 'acme:vintage')?.description).toBe('Toy vintage mood');
    expect(registry.get('layouts', 'acme:triptych')?.regions).toEqual(['left', 'center', 'right']);
    expect(registry.getCapabilities()).toContain('acme:poll');
  });

  test('third-party names must be vendor:namespaced', () => {
    const { errors, registry } = errorsOf();
    const bad = definePlugin({ name: 'rogue', version: '1.0.0', provides: {} });
    expect(registry.use(bad)).toBe(false);
    expect(errors.some(e => (e as { code: string }).code === 'plugin-conflict')).toBe(true);
  });

  test('unnamespaced provided types from third parties are rejected', () => {
    const { errors, registry } = errorsOf();
    registry.use(definePlugin({
      name: 'acme:bad',
      version: '1.0.0',
      provides: { blocks: { plain: defineBlock({ schema: z.never() }) } },
    }));
    expect(errors.some(e => (e as { code: string }).code === 'plugin-conflict')).toBe(true);
    expect(registry.getManifest('plain')).toBeUndefined();
  });

  test('duplicate registration is a plugin-conflict; override wins', () => {
    const { errors, registry } = errorsOf();
    registry.use(toyPlugin);
    expect(registry.use(toyPlugin)).toBe(false);
    expect(errors.some(e => (e as { code: string }).code === 'plugin-conflict')).toBe(true);

    const replacement = definePlugin({ ...toyPlugin, override: true });
    expect(registry.use(replacement)).toBe(true);
  });

  test('disable hides a plugin from capabilities and the guide', () => {
    const registry = createRegistry();
    registry.use(toyPlugin);
    expect(registry.getCapabilities()).toContain('acme:poll');
    registry.disable('acme:toy');
    expect(registry.getCapabilities()).not.toContain('acme:poll');
    registry.enable('acme:toy');
    expect(registry.getCapabilities()).toContain('acme:poll');
  });

  test('missing requires yields plugin-incompatible', () => {
    const { errors, registry } = errorsOf();
    registry.use(definePlugin({ name: 'acme:needs', version: '1.0.0', requires: ['nope'] }));
    expect(errors.some(e => (e as { code: string }).code === 'plugin-incompatible')).toBe(true);
  });

  test('incompatible engine ranges are rejected', () => {
    const { errors, registry } = errorsOf();
    registry.use(definePlugin({ name: 'acme:future', version: '1.0.0', engine: '^99.0.0' }));
    expect(errors.some(e => (e as { code: string }).code === 'plugin-incompatible')).toBe(true);
    expect(satisfiesEngine('^1.0.0', ENGINE_VERSION)).toBe(true);
    expect(satisfiesEngine('~0.9.0')).toBe(false);
  });

  test('install() receives the registry and can register middleware', () => {
    const registry = createRegistry();
    const install = vi.fn();
    registry.use(definePlugin({
      name: 'acme:installer',
      version: '1.0.0',
      install(ctx) {
        install(ctx);
        const installCtx = ctx as { registry?: { register?: (...args: unknown[]) => unknown } };
        installCtx.registry?.register?.('middleware', 'acme:noop', defineMiddleware({ name: 'acme:noop' }));
      },
    }));
    expect(install).toHaveBeenCalled();
  });

  test('legacy Plugin shape still works via normalizePlugin', () => {
    const registry = createRegistry();
    registry.use({
      name: 'legacy',
      version: '1.0.0',
      types: {
        legacyThing: { schema: z.object({ id: z.string(), type: z.literal('legacyThing') }) },
      },
    }, { builtin: true });
    expect(registry.getManifest('legacyThing')).toBeDefined();
  });

  test('layoutDefinitionFor derives regions from a spec', () => {
    expect(layoutDefinitionFor({ kind: 'split' }).regions).toEqual(['left', 'right']);
    expect(layoutDefinitionFor({ kind: 'stage', regions: ['top', 'center'] }).regions).toEqual(['top', 'center']);
    expect(layoutDefinitionFor({ kind: 'grid' }).primary).toBe('center');
  });

  test('name and version helpers', () => {
    expect(isNamespacedName('acme:poll')).toBe(true);
    expect(isNamespacedName('poll')).toBe(false);
    expect(isCorePluginName('math')).toBe(true);
    expect(isCorePluginName('acme:poll')).toBe(false);
  });

  test('defineModelConnector validates its shape; defineModelPack works', async () => {
    expect(() => defineModelConnector({ id: '', getManifest: async () => ({}), getAsset: async () => '' })).toThrow();
    const pack = defineModelPack({ id: 'pack', manifests: { m1: { id: 'm1' } } });
    expect(pack.id).toBe('pack');
    expect(await pack.getManifest('m1', { signal: new AbortController().signal })).toEqual({ id: 'm1' });
  });

  test('defineProfile and defineStrings are identity helpers usable via registry', () => {
    const registry = createRegistry();
    registry.register('profiles', 'acme:simple', defineProfile({ description: 'simple', exclude: ['math'] }));
    registry.register('strings', 'xx', defineStrings({ locale: 'xx', strings: { 'board.skip': 'X' } }));
    expect(registry.get('profiles', 'acme:simple')?.exclude).toEqual(['math']);
    expect(registry.get('strings', 'xx')?.strings['board.skip']).toBe('X');
  });
});
