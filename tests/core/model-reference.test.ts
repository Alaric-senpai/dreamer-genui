import { describe, expect, test } from 'vitest';
import { normalizeModelReference } from '../../packages/dreamer-genui/src/core/model';

/**
 * The lightweight 3D scaffolding accepts two source shapes (§6.16):
 * a direct asset link (`modelUrl`) or a registry reference
 * (`model: { id, source }`) resolved through a host-configured connector.
 */
describe('normalizeModelReference', () => {
  test('a direct asset URL bypasses every connector', () => {
    expect(
      normalizeModelReference({ modelUrl: 'https://cdn.example/models/heart.glb' }, ['demo']),
    ).toEqual({ kind: 'url', url: 'https://cdn.example/models/heart.glb' });
  });

  test('string model ids resolve in connector priority order', () => {
    expect(normalizeModelReference({ model: 'assembly' }, ['demo'])).toEqual({
      kind: 'registry',
      ref: 'assembly',
    });
    expect(normalizeModelReference({ model: 'demo:assembly' }, ['demo'])).toEqual({
      kind: 'registry',
      ref: 'demo:assembly',
    });
  });

  test('{ id, source } selects the connector registered under source', () => {
    expect(
      normalizeModelReference({ model: { id: 'assembly', source: 'demo' } }, ['demo']),
    ).toEqual({ kind: 'registry', ref: 'demo:assembly', source: 'demo' });
  });

  test('an unknown source falls back to bare-id resolution', () => {
    expect(
      normalizeModelReference({ model: { id: 'assembly', source: 'platform' } }, ['demo']),
    ).toEqual({ kind: 'registry', ref: 'assembly', source: 'platform' });
  });

  test('requires exactly one of model or modelUrl', () => {
    expect(normalizeModelReference({}).kind).toBe('invalid');
    expect(
      normalizeModelReference({
        model: 'assembly',
        modelUrl: 'https://cdn.example/models/assembly.glb',
      }),
    ).toMatchObject({ kind: 'invalid', error: { code: 'invalid-node' } });
  });
});
