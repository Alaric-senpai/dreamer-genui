import { describe, expect, test } from 'vitest';
import {
  LITE_PARTICLES,
  MAX_PARTICLES,
  particleCount,
  seedParticles,
  stepParticles,
} from '../../packages/dreamer-genui/src/ambience/particles';
import type { AmbienceParticleConfig } from '../../packages/dreamer-genui/src/theme/presets';

const CONFIG: AmbienceParticleConfig = {
  count: 200,
  color: 'ink',
  minSize: 1,
  maxSize: 3,
  speed: 20,
  drift: 10,
  twinkle: true,
  direction: 'up',
};

describe('ambience particles (§6.9)', () => {
  test('counts are capped for desktop and lite budgets', () => {
    expect(particleCount(CONFIG, false)).toBe(MAX_PARTICLES);
    expect(particleCount(CONFIG, true)).toBe(LITE_PARTICLES);
    expect(particleCount({ ...CONFIG, count: 10 }, false)).toBe(10);
    expect(particleCount({ ...CONFIG, count: -4 }, false)).toBe(0);
  });

  test('seeding is deterministic for the same seed and size', () => {
    const a = seedParticles(CONFIG, 320, 480, false, 42);
    const b = seedParticles(CONFIG, 320, 480, false, 42);
    expect(a).toEqual(b);
    const c = seedParticles(CONFIG, 320, 480, false, 43);
    expect(c).not.toEqual(a);
    expect(a.every((p) => p.x >= 0 && p.x <= 320 && p.y >= 0 && p.y <= 480)).toBe(true);
  });

  test('stepping advances rising particles and wraps them at the top', () => {
    const particles = seedParticles(CONFIG, 320, 100, false, 7);
    const stepped = stepParticles(particles, 0.05, 320, 100, 'up');
    expect(stepped[0]!.y).toBeLessThan(particles[0]!.y);

    const nearTop = [{ x: 10, y: 0.5, size: 2, speed: 100, drift: 0, phase: 0, twinkle: 0 }];
    const wrapped = stepParticles(nearTop, 0.05, 320, 100, 'up');
    expect(wrapped[0]!.y).toBeGreaterThan(100);
  });

  test('static stars never move', () => {
    const particles = seedParticles({ ...CONFIG, direction: 'static', speed: 0, drift: 0 }, 320, 300, false, 3);
    const stepped = stepParticles(particles, 1, 320, 300, 'static');
    expect(stepped).toEqual(particles);
  });
});
