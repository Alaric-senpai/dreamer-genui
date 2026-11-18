import { describe, expect, test } from 'vitest';
import { layoutOrbit, orbitRingPath, ORBIT_DURATION_MS } from '../../packages/dreamer-genui/src/core/orbit';

describe('layoutOrbit (§6.7 orbit diagram)', () => {
  test('places a root at the centre and evenly spaces the rim', () => {
    const placed = layoutOrbit(['core', 'a', 'b', 'c'], { root: 'core' });
    expect(placed.map(p => p.id)).toEqual(['core', 'a', 'b', 'c']);
    expect(placed[0]).toMatchObject({ id: 'core', x: 0, y: 0, ring: 0 });
    expect(placed[1]?.x).toBeCloseTo(0, 5);
    expect(placed[1]?.y).toBeCloseTo(-0.78, 5);
    expect(placed[2]?.y).toBeCloseTo(0.39, 2);
    expect(placed[3]?.y).toBeCloseTo(0.39, 2);
  });

  test('without a root, every node joins the ring', () => {
    const placed = layoutOrbit(['a', 'b', 'c', 'd']);
    expect(placed.every(p => p.ring === 1)).toBe(true);
    expect(placed[0]?.y).toBeCloseTo(-0.78);
    expect(placed[2]?.y).toBeCloseTo(0.78);
  });

  test('respects radius, start angle, and guards non-finite input', () => {
    const placed = layoutOrbit(['a'], { radius: 0.5, startAngle: 0 });
    expect(placed[0]?.x).toBeCloseTo(0.5);
    expect(placed[0]?.y).toBeCloseTo(0);
    const guarded = layoutOrbit(['a', 'b'], { radius: Number.NaN, startAngle: Number.POSITIVE_INFINITY });
    expect(guarded[0]?.y).toBeCloseTo(-0.78);
  });

  test('unknown root id leaves every node on the ring', () => {
    const placed = layoutOrbit(['a', 'b'], { root: 'missing' });
    expect(placed).toHaveLength(2);
    expect(placed.every(p => p.ring === 1)).toBe(true);
  });

  test('empty input and a root-only diagram are stable', () => {
    expect(layoutOrbit([])).toEqual([]);
    expect(layoutOrbit(['solo'], { root: 'solo' })).toEqual([
      { id: 'solo', x: 0, y: 0, angle: 0, ring: 0 },
    ]);
  });

  test('exports the ring path and revolution duration', () => {
    expect(orbitRingPath(0.5)).toContain('A 0.5 0.5');
    expect(ORBIT_DURATION_MS).toBe(21000);
  });
});
