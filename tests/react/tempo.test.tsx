import { describe, expect, test } from 'vitest';
import { tempoOf } from '../../packages/dreamer-genui/src/react/motion/tempo';

/** tempoOf: scene tempo from a resolved theme (1 when unset/invalid). */
describe('tempoOf (theme motion.speed → scene tempo)', () => {
  test('speed from the resolved theme tokens', () => {
    expect(tempoOf({ tokens: { motion: { speed: 0.6 } } })).toBe(0.6);
    expect(tempoOf({ tokens: { motion: { speed: 2 } } })).toBe(2);
  });

  test('unset motion, unset theme, or invalid speed → 1', () => {
    expect(tempoOf({ tokens: {} })).toBe(1);
    expect(tempoOf({})).toBe(1);
    expect(tempoOf(undefined)).toBe(1);
    expect(tempoOf(null)).toBe(1);
    expect(tempoOf({ tokens: { motion: { speed: 0 } } })).toBe(1);
    expect(tempoOf({ tokens: { motion: { speed: -3 } } })).toBe(1);
  });
});
