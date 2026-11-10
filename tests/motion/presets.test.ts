import { describe, expect, test } from 'vitest';
import {
  EASE,
  ENTER_PRESETS,
  EMPHASIS_PRESETS,
  EXIT_PRESETS,
  KINETIC_PRESETS,
  applyTempo,
  DEFAULT_TEXT_ENTER,
} from '../../packages/dreamer-genui/src/motion/presets';
import { EnterEffectsSchema, EmphasisSchema, ExitSchema, EaseNameSchema } from '../../packages/dreamer-genui/src/schema/motion';

function optionsOf(schema: { options: readonly string[] }): string[] {
  return [...schema.options];
}

describe('EaseName → cubic-bezier table (§6.7)', () => {
  test('every named ease exists and is a valid 4-point curve', () => {
    for (const name of optionsOf(EaseNameSchema)) {
      const curve = EASE[name as keyof typeof EASE];
      expect(curve, name).toHaveLength(4);
      for (const [i, x] of [0, 2].entries()) {
        expect(curve[i === 0 ? 0 : 2]).toBeGreaterThanOrEqual(0);
        expect(curve[i === 0 ? 0 : 2]).toBeLessThanOrEqual(1);
        void x;
      }
      // anticipation/overshoot have y-values outside [0,1]
      for (const y of [curve[1], curve[3]]) {
        expect(y).toBeGreaterThanOrEqual(-1);
        expect(y).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('preset coverage — the table can never drift from the protocol enums', () => {
  test('ENTER_PRESETS covers every enter effect', () => {
    for (const effect of optionsOf(EnterEffectsSchema)) {
      const preset = ENTER_PRESETS[effect as keyof typeof ENTER_PRESETS];
      expect(preset, effect).toBeDefined();
      expect(preset.duration).toBeGreaterThanOrEqual(0); // 'none' is legitimately 0
      expect(['instant', 'fade'] as string[]).toContain(preset.reducedMotion);
      expect(EASE[preset.ease as keyof typeof EASE]).toBeDefined();
    }
  });

  test('EFF PRESETS covers every emphasis effect', () => {
    for (const effect of optionsOf(EmphasisSchema.shape.effect)) {
      expect(EMPHASIS_PRESETS[effect as keyof typeof EMPHASIS_PRESETS], effect).toBeDefined();
    }
  });

  test('EXIT_PRESETS covers every exit effect', () => {
    for (const effect of optionsOf(ExitSchema.shape.effect)) {
      expect(EXIT_PRESETS[effect as keyof typeof EXIT_PRESETS], effect).toBeDefined();
    }
  });

  test('kinetic presets carry split mode, base duration and stagger', () => {
    for (const [effect, preset] of Object.entries(KINETIC_PRESETS)) {
      expect(preset.split, effect).toBeDefined();
      expect(preset.duration, effect).toBeGreaterThan(0);
      expect(preset.stagger, effect).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('tempo multiplier (theme motion.speed, §6.8)', () => {
  test('speed 1 leaves durations untouched', () => {
    expect(applyTempo(400, 1)).toBe(400);
  });

  test('slower moods (speed 0.6) stretch durations', () => {
    expect(applyTempo(400, 0.6)).toBeCloseTo(400 / 0.6, 5);
  });

  test('faster pacing (speed 2) halves durations', () => {
    expect(applyTempo(400, 2)).toBe(200);
  });

  test('stagger stretches with tempo but the step stays proportional', () => {
    const base = applyTempo(60, 0.5);
    expect(base).toBeCloseTo(120, 5);
  });
});

describe('per-variant kinetic defaults (§9.2)', () => {
  test('hero slams, body staggers words, kicker wipes, numbers count up', () => {
    expect(DEFAULT_TEXT_ENTER.hero).toBe('slam');
    expect(DEFAULT_TEXT_ENTER.body).toBe('words');
    expect(DEFAULT_TEXT_ENTER.kicker).toBe('wipe');
    expect(DEFAULT_TEXT_ENTER.quote).toBe('words');
    for (const key of ['hero', 'body', 'kicker', 'quote', 'heading', 'note', 'definition']) {
      expect(DEFAULT_TEXT_ENTER[key], key).toBeDefined();
    }
  });
});
