import { describe, expect, test } from 'vitest';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { LibraryError } from '../../packages/dreamer-genui/src/core/types';

describe('createRegistry', () => {
  test('has all built-in types registered', () => {
    const reg = createRegistry();
    const caps = reg.getCapabilities();
    expect(caps).toContain('text');
    expect(caps).toContain('choices');
    expect(caps).toContain('steps');
    expect(caps).toContain('callout');
    expect(caps).toContain('group');
    expect(caps).toContain('table');
    expect(caps).toContain('math');
    expect(caps).toContain('code');
    expect(caps).toContain('figure');
  });

  test('resolve valid text block returns valid', () => {
    const reg = createRegistry();
    const result = reg.resolve('text', { id: 't1', type: 'text', variant: 'body', content: ['Hello'] });
    expect(result.valid).toBe(true);
    expect(result.manifest).toBeDefined();
  });

  test('resolve unknown type returns unknown-type error', () => {
    const errors: LibraryError[] = [];
    const reg = createRegistry({ onError: e => errors.push(e) });
    const result = reg.resolve('made-up-widget', { id: 'x', type: 'made-up-widget' });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('unknown-type');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('unknown-type');
  });

  test('resolve invalid props returns invalid-node error', () => {
    const reg = createRegistry();
    // text requires variant but we omit it
    const result = reg.resolve('text', { id: 't1', type: 'text' });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('invalid-node');
  });

  test('registerLoader + getLoader works', () => {
    const reg = createRegistry();
    let called = false;
    reg.registerLoader('text', () => { called = true; return {}; });
    const loader = reg.getLoader('text');
    expect(loader).toBeDefined();
    loader!();
    expect(called).toBe(true);
  });

  test('getLoader for unregistered type returns undefined', () => {
    const reg = createRegistry();
    expect(reg.getLoader('figure')).toBeUndefined();
  });

  test('getManifest returns manifest for registered type', () => {
    const reg = createRegistry();
    const m = reg.getManifest('text');
    expect(m).toBeDefined();
    expect(m?.promptGuide).toBeDefined();
  });

  test('getManifest for unknown type returns undefined', () => {
    const reg = createRegistry();
    expect(reg.getManifest('made-up')).toBeUndefined();
  });

  test('getCapabilities returns all registered types', () => {
    const reg = createRegistry();
    const caps = reg.getCapabilities();
    expect(caps.length).toBeGreaterThan(0);
    expect(caps).toContain('text');
  });
});
