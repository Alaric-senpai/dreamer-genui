import { describe, expect, test } from 'vitest';
import {
  isFlowPlacement,
  resolvePlacement,
} from '../../packages/dreamer-genui/src/react/components/detour';
import type { Detour } from '../../packages/dreamer-genui/src/core/types';

function detour(overrides: Partial<Detour> = {}): Detour {
  return {
    id: 'd1',
    targetNodeId: 'n1',
    targetRef: 'n1',
    blocks: [],
    openAt: 0,
    placement: 'inline',
    connector: 'none',
    mode: 'inline',
    ...overrides,
  };
}

describe('attachment placement (§7.5)', () => {
  test('wide boards keep the authored side placement', () => {
    expect(resolvePlacement(detour({ placement: 'right' }), 1100)).toBe('right');
    expect(resolvePlacement(detour({ placement: 'left' }), 1100)).toBe('left');
    expect(resolvePlacement(detour({ placement: 'above' }), 1100)).toBe('above');
  });

  test('spotlight and drawer modes win on wide boards', () => {
    expect(resolvePlacement(detour({ placement: 'right', mode: 'spotlight' }), 1100)).toBe('spotlight');
    expect(resolvePlacement(detour({ placement: 'right', mode: 'drawer' }), 1100)).toBe('drawer');
  });

  test('below 900px side placements fall back to below', () => {
    expect(resolvePlacement(detour({ placement: 'right' }), 820)).toBe('below');
    expect(resolvePlacement(detour({ placement: 'left' }), 820)).toBe('below');
    expect(resolvePlacement(detour({ placement: 'overlay' }), 820)).toBe('below');
  });

  test('below 720px every floating mode/placement falls back to flow', () => {
    expect(resolvePlacement(detour({ placement: 'right' }), 600)).toBe('below');
    expect(resolvePlacement(detour({ placement: 'overlay' }), 600)).toBe('below');
    expect(resolvePlacement(detour({ placement: 'right', mode: 'spotlight' }), 600)).toBe('below');
    expect(resolvePlacement(detour({ placement: 'inline' }), 600)).toBe('inline');
    expect(resolvePlacement(detour({ placement: 'below' }), 600)).toBe('below');
  });

  test('unmeasured boards (0) keep the authored placement', () => {
    expect(resolvePlacement(detour({ placement: 'right' }), 0)).toBe('right');
  });

  test('flow placements are inline and below only', () => {
    expect(isFlowPlacement('inline')).toBe(true);
    expect(isFlowPlacement('below')).toBe(true);
    expect(isFlowPlacement('right')).toBe(false);
    expect(isFlowPlacement('spotlight')).toBe(false);
  });
});
