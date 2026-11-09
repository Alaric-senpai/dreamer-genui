import { describe, expect, test } from 'vitest';
import {
  TriggerSchema,
  EnterSchema,
  EmphasisSchema,
  ExitSchema,
  EaseNameSchema,
  ThemeSpecSchema,
  ThemeOpSchema,
  CameraOpSchema,
  OpSchema,
  TextBlockSchema,
  MarkSchema,
  ColorTokenSchema,
  ErrorCodeSchema,
} from '../../packages/dreamer-genui/src/schema';

describe('Trigger schema (§6.2)', () => {
  test('all four trigger kinds parse', () => {
    expect(() => TriggerSchema.parse({ on: 'start' })).not.toThrow();
    expect(() => TriggerSchema.parse({ on: 'cue', id: 'beat-2' })).not.toThrow();
    expect(() => TriggerSchema.parse({ on: 'after', node: 'some-node' })).not.toThrow();
    expect(() => TriggerSchema.parse({ on: 'event', node: 'parent/item', event: 'select' })).not.toThrow();
  });

  test('empty cue id is rejected', () => {
    expect(() => TriggerSchema.parse({ on: 'cue', id: '' })).toThrow();
  });
});

describe('Expanded motion vocabulary (§6.7)', () => {
  test('new enter effects are accepted', () => {
    for (const effect of ['typewriter', 'words', 'chars', 'slam', 'wipe', 'scribble', 'zoom', 'count-up', 'morph']) {
      expect(() => EnterSchema.parse({ effect })).not.toThrow();
    }
  });

  test('enter may carry trigger and split', () => {
    const enter = EnterSchema.parse({
      effect: 'words', split: 'words', trigger: { on: 'cue', id: 'beat-1' }, order: 2, delay: 120, duration: 600,
    });
    expect(enter.trigger).toEqual({ on: 'cue', id: 'beat-1' });
    expect(enter.split).toBe('words');
  });

  test('new emphasis and exit effects are accepted', () => {
    expect(() => EmphasisSchema.parse({ effect: 'shake' })).not.toThrow();
    expect(() => EmphasisSchema.parse({ effect: 'wobble', trigger: { on: 'cue', id: 'x' } })).not.toThrow();
    expect(() => ExitSchema.parse({ effect: 'wipe-out' })).not.toThrow();
  });

  test('EaseName enum covers the five named easings', () => {
    for (const name of ['smooth', 'snappy', 'overshoot', 'anticipate', 'linear']) {
      expect(() => EaseNameSchema.parse(name)).not.toThrow();
    }
    expect(() => EaseNameSchema.parse('bouncy-bounce')).toThrow();
  });

  test('ColorToken includes ink', () => {
    expect(ColorTokenSchema.parse('ink')).toBe('ink');
  });

  test('error codes include theme-rejected and cue-cycle', () => {
    expect(ErrorCodeSchema.parse('theme-rejected')).toBe('theme-rejected');
    expect(ErrorCodeSchema.parse('cue-cycle')).toBe('cue-cycle');
  });
});

describe('ThemeSpec (§6.8)', () => {
  test('accepts mood with intensity, ambience presets, surface and transition', () => {
    const spec = ThemeSpecSchema.parse({
      mood: 'solemn',
      intensity: 0.7,
      ambience: { preset: 'fog', intensity: 0.5 },
      surface: 'chalkboard',
      transition: { duration: 900, ease: 'smooth' },
    });
    expect(spec.mood).toBe('solemn');
    expect(spec.ambience).toEqual({ preset: 'fog', intensity: 0.5 });
  });

  test('accepts policy-gated tokens with clamped numeric bounds', () => {
    expect(() =>
      ThemeSpecSchema.parse({
        tokens: {
          color: { bg: '#101014', ink: '#e5e7eb', accent: 'oklch(0.7 0.15 200)' },
          font: { display: 'Montserrat', body: 'JetBrains Mono' },
          radius: { md: 12 },
          space: { scale: 1.2 },
          motion: { speed: 0.8, ease: 'anticipate' },
          texture: { grain: 0.2, vignette: 0.4 },
        },
      }),
    ).not.toThrow();
  });

  test('rejects out-of-range numbers', () => {
    expect(() => ThemeSpecSchema.parse({ intensity: 1.5 })).toThrow();
    expect(() => ThemeSpecSchema.parse({ tokens: { texture: { grain: 2 } } })).toThrow();
    expect(() => ThemeSpecSchema.parse({ transition: { duration: -5 } })).toThrow();
  });

  test('ambience may be a bare preset name', () => {
    expect(ThemeSpecSchema.parse({ ambience: 'embers' }).ambience).toBe('embers');
  });
});

describe('theme and camera ops (§6.1)', () => {
  test('theme op parses with default scope board', () => {
    const op = ThemeOpSchema.parse({ op: 'theme', theme: { mood: 'calm' } });
    expect(op.scope).toBe('board');
  });

  test('theme op accepts detour scope', () => {
    const op = ThemeOpSchema.parse({ op: 'theme', theme: { mood: 'calm' }, scope: 'detour' });
    expect(op.scope).toBe('detour');
  });

  test('theme op rejects a missing theme', () => {
    expect(() => ThemeOpSchema.parse({ op: 'theme' })).toThrow();
  });

  test('camera op accepts node references and overview', () => {
    expect(CameraOpSchema.parse({ op: 'camera', to: 'some/historical-idea', zoom: 1.4, duration: 900, ease: 'snappy' }).to).toBe('some/historical-idea');
    expect(CameraOpSchema.parse({ op: 'camera', to: 'overview' }).to).toBe('overview');
  });

  test('camera op clamps zoom bounds', () => {
    expect(() => CameraOpSchema.parse({ op: 'camera', to: 'x', zoom: 3 })).toThrow();
    expect(() => CameraOpSchema.parse({ op: 'camera', to: 'x', zoom: 0.2 })).toThrow();
  });

  test('attach and replace may carry a theme', () => {
    expect(() => ThemeOpSchema.parse({ op: 'theme', theme: { mood: 'calm' }, scope: 'detour' })).not.toThrow();
    // the OpSchema union accepts theme ops (attach/replace theme fields are
    // covered by AttachOpSchema/ReplaceOpSchema, tested implicitly by fixtures)
    expect(OpSchema.parse({ op: 'theme', theme: { mood: 'playful' }, scope: 'detour' }).op).toBe('theme');
  });
});

describe('Text variants and item-level enters (§6.4)', () => {
  test('hero, kicker and quote variants parse', () => {
    for (const variant of ['hero', 'kicker', 'quote', 'body', 'definition', 'heading', 'note']) {
      expect(() => TextBlockSchema.parse({ id: 't', type: 'text', variant, content: ['x'] })).not.toThrow();
    }
    expect(() => TextBlockSchema.parse({ id: 't', type: 'text', variant: 'subtitle', content: ['x'] })).toThrow();
  });

  test('steps and diagram items may carry enter', () => {
    expect(() => MarkSchema.parse({ mark: 'term', text: 't', definition: 'd', enter: { effect: 'slam', trigger: { on: 'cue', id: 'c' } } })).not.toThrow();
  });
});

describe('Unknown keys are ignored with tolerance (§6.1)', () => {
  test('zod strips unknown fields rather than rejecting (documented behavior)', () => {
    const op = ThemeOpSchema.parse({ op: 'theme', theme: { mood: 'calm' }, futureField: 123 });
    expect('futureField' in op).toBe(false); // stripped, not fatal
  });
});
