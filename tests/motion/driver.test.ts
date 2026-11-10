import { describe, expect, test } from 'vitest';
import { createMotionDriver, createReducedMotionDriver } from '../../packages/dreamer-genui/src/react/motion/driver';
import { KINETIC_PRESETS } from '../../packages/dreamer-genui/src/motion/presets';

const driver = createMotionDriver();

describe('MotionDriver ownership contract (DECISIONS M3 batch-2 ruling)', () => {
  test('the driver never animates the container for a kinetic effect — the text engine owns it', () => {
    for (const effect of Object.keys(KINETIC_PRESETS)) {
      expect(driver.enter({ effect } as never, 0), effect).toBeNull();
    }
  });

  test('container-level effects produce transform/opacity-only animations', () => {
    for (const effect of ['reveal', 'rise', 'pop', 'sweep', 'zoom', 'stagger', 'draw', 'morph'] as const) {
      const anim = driver.enter({ effect } as never, 2);
      expect(anim, effect).not.toBeNull();
      expect(anim!.initial).toHaveProperty('opacity', 0);
      for (const spec of [anim!.initial, anim!.animate]) {
        for (const key of Object.keys(spec)) {
          expect(['opacity', 'y', 'x', 'scale'], `${effect}.${String(key)}`).toContain(String(key));
        }
      }
      expect(anim!.transition.duration).toBeGreaterThan(0);
      // docIndex sequences the entrance when order is absent
      expect(anim!.transition.delay).toBeCloseTo(2 * 0.12, 5);
    }
  });

  test('explicit order wins over docIndex; explicit duration wins over the preset', () => {
    const anim = driver.enter({ effect: 'rise', order: 4, duration: 900 } as never, 2);
    expect(anim!.transition.delay).toBeCloseTo(0.48, 5);
    expect(anim!.transition.duration).toBeCloseTo(0.9, 5);
  });

  test('emphasis returns the driver-owned class and preset; exit respects the table (none → null)', () => {
    const emphasis = driver.emphasis({ effect: 'pulse' } as never);
    expect(emphasis!.className).toBe('dg-emphasis-pulse');
    expect(emphasis!.preset.duration).toBeGreaterThan(0);
    expect(driver.emphasis(undefined)).toBeNull();
    expect(driver.exit(undefined)).toBeNull();
    expect(driver.exit({ effect: 'none' } as never)).toBeNull();
    const fade = driver.exit({ effect: 'fade' } as never);
    expect(fade!.exit).toEqual({ opacity: 0 });
    // transform/opacity only in exits, too
    for (const key of Object.keys(fade!.exit!)) expect(['opacity', 'scale']).toContain(key);
  });

  test('reduced-motion driver: everything off — content identical, instantly', () => {
    const reduced = createReducedMotionDriver();
    expect(reduced.enter({ effect: 'rise' } as never, 0)).toBeNull();
    expect(reduced.emphasis({ effect: 'pulse' } as never)).toBeNull();
    expect(reduced.exit({ effect: 'fade' } as never)).toBeNull();
  });
});
