/**
 * Ambience particle math (§6.9) — headless, deterministic, testable.
 *
 * The React layer only paints these particles. Counts are capped here so every
 * preset (including host-registered ones) obeys the same frame budget; the
 * same module seeds and steps particles, which keeps captures and tests
 * reproducible.
 */
import type { AmbienceParticleConfig } from '../theme/presets';

export const MAX_PARTICLES = 80;
export const LITE_PARTICLES = 24;

export interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  phase: number;
  twinkle: number;
}

/** Deterministic 32-bit PRNG (mulberry32) — no Math.random in captures. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cap the requested count for the active quality tier. */
export function particleCount(config: AmbienceParticleConfig, lite: boolean): number {
  const requested = Math.max(0, Math.floor(config.count));
  return Math.min(requested, lite ? LITE_PARTICLES : MAX_PARTICLES);
}

/** Seed particles across a surface. Deterministic for a given seed + size. */
export function seedParticles(
  config: AmbienceParticleConfig,
  width: number,
  height: number,
  lite: boolean,
  seed = 7,
): Particle[] {
  const count = particleCount(config, lite);
  const random = seededRandom(seed);
  const particles: Particle[] = [];
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: random() * width,
      y: random() * height,
      size: config.minSize + random() * Math.max(0, config.maxSize - config.minSize),
      speed: config.speed * (0.6 + random() * 0.8),
      drift: config.drift * (0.5 + random() * 1.2),
      phase: random() * Math.PI * 2,
      twinkle: random(),
    });
  }
  return particles;
}

/** Advance particles by `dt` seconds, wrapping at the surface edges. */
export function stepParticles(
  particles: readonly Particle[],
  dt: number,
  width: number,
  height: number,
  direction: AmbienceParticleConfig['direction'],
): Particle[] {
  const seconds = Math.min(0.1, Math.max(0, dt));
  return particles.map((p) => {
    let { x, y } = p;
    switch (direction) {
      case 'up':
        y -= p.speed * seconds;
        break;
      case 'down':
        y += p.speed * seconds;
        break;
      case 'left':
        x -= p.speed * seconds;
        break;
      case 'right':
        x += p.speed * seconds;
        break;
      case 'drift':
        x += Math.sin(p.phase + seconds * 0.6) * p.drift * seconds;
        y += Math.cos(p.phase + seconds * 0.4) * p.drift * 0.35 * seconds;
        break;
      case 'static':
        // stars only twinkle
        break;
    }
    // wrap so the field never depletes
    if (y < -p.size) y = height + p.size;
    if (y > height + p.size) y = -p.size;
    if (x < -p.size) x = width + p.size;
    if (x > width + p.size) x = -p.size;
    return { ...p, x, y };
  });
}

/** Paint the field. `color` is a resolved CSS colour, never model text. */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly Particle[],
  color: string,
  time: number,
): void {
  for (const p of particles) {
    const alpha = p.twinkle ? 0.35 + 0.65 * Math.abs(Math.sin(p.phase + time * 0.7)) : 0.75;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
