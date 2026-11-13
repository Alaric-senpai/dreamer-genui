import type { ThemeTokens } from '../schema/theme';

/**
 * Example theme presets and library defaults. ALL NAMES AND VALUES ARE
 * EXAMPLES ONLY — everything here is overridable/removable by the host
 * (registerMood/registerAmbience/registerSurface on the registry) and every
 * published value is centralised here so the reference pass (v3) can retune
 * it in one place. Nothing in code may branch on a mood name.
 */

/** Zero-config palette: the default board look with no theme ever applied. */
export const DEFAULT_TOKENS: Required<Pick<ThemeTokens, 'color'>>['color'] = {
  bg: '#f7f7f5',
  surface: '#ffffff',
  ink: '#1f1f1d',
  muted: '#565650',
  accent: '#2e5dc4',
  info: '#2563eb',
  success: '#15803d',
  warn: '#b45309',
  danger: '#b91c1c',
};

export interface MoodPreset {
  name: string;
  /** Shown to the tutor in the prompt guide — what the mood is FOR. */
  description: string;
  tokens: ThemeTokens;
  ambience?: string;
  surface?: string;
}

export interface AmbiencePreset {
  name: string;
  description: string;
  /**
   * Generic implementation kind (§6.9). Presets are data: the renderer picks a
   * layer kind, never a preset name, so hosts can register their own without
   * touching library code.
   */
  layer?: AmbienceLayerKind;
  /** 0..1, multiplied into the layer opacity. Defaults to 1. */
  intensity?: number;
  particles?: AmbienceParticleConfig;
}

export type AmbienceLayerKind = 'grain' | 'vignette' | 'haze' | 'flicker' | 'particles';

export type AmbienceColorRole = 'ink' | 'muted' | 'accent' | 'info' | 'success' | 'warn' | 'danger';

export interface AmbienceParticleConfig {
  /** Requested count; the runtime caps it (and halves it in lite mode). */
  count: number;
  color: AmbienceColorRole;
  minSize: number;
  maxSize: number;
  /** Vertical speed in px/second (negative = up). */
  speed: number;
  /** Horizontal sway amplitude in px/second. */
  drift: number;
  twinkle: boolean;
  direction: 'up' | 'down' | 'left' | 'right' | 'drift' | 'static';
}

export interface SurfacePreset {
  name: string;
  description: string;
}

/** Example moods (§6.8) — data, not code. */
export const EXAMPLE_MOODS: MoodPreset[] = [
  {
    name: 'calm',
    description: 'Clear and steady default register for standard explanations.',
    tokens: {
      color: {
        bg: '#f7f7f5',
        surface: '#ffffff',
        ink: '#1f1f1d',
        muted: '#565650',
        accent: '#2e5dc4',
        info: '#2563eb',
        success: '#15803d',
        warn: '#b45309',
        danger: '#b91c1c',
      },
      radius: { sm: 4, md: 10, lg: 16 },
      motion: { speed: 1, ease: 'smooth' },
    },
  },
  {
    name: 'solemn',
    description: 'Quiet, heavy register for grave or serious subject matter.',
    tokens: {
      color: {
        bg: '#14161c',
        surface: '#1d2129',
        ink: '#e8e6e0',
        muted: '#a8a5a0',
        accent: '#d3a866',
        info: '#7aa5d8',
        success: '#7cae7c',
        warn: '#cfa257',
        danger: '#d47a6a',
      },
      radius: { sm: 3, md: 6, lg: 10 },
      motion: { speed: 0.7, ease: 'smooth' },
      texture: { grain: 0.25, vignette: 0.55 },
    },
    ambience: 'fog',
    surface: 'chalkboard',
  },
  {
    name: 'playful',
    description: 'Bright, springy register for light topics and celebration.',
    tokens: {
      color: {
        bg: '#fff8ec',
        surface: '#ffffff',
        ink: '#2b2016',
        muted: '#6b5f51',
        accent: '#e2653a',
        info: '#2e86c7',
        success: '#3f9d55',
        warn: '#b97400',
        danger: '#d64545',
      },
      radius: { sm: 8, md: 18, lg: 28 },
      motion: { speed: 1.25, ease: 'overshoot' },
      texture: { grain: 0.05, vignette: 0 },
    },
    surface: 'paper',
  },
  {
    name: 'eerie',
    description: 'Strained, flickering register for spooky or unsettling passages.',
    tokens: {
      color: {
        bg: '#0b0d15',
        surface: '#121523',
        ink: '#cdd6e8',
        muted: '#7d8699',
        accent: '#8fd0ff',
        info: '#6fa8d8',
        success: '#6fae8f',
        warn: '#c9a94f',
        danger: '#d46560',
      },
      motion: { speed: 0.6, ease: 'anticipate' },
      texture: { grain: 0.35, vignette: 0.7 },
    },
    ambience: 'flicker',
  },
];

/** Example ambience presets — data + generic layer kind; the runtime is in react/ambience. */
export const EXAMPLE_AMBIENCE: AmbiencePreset[] = [
  { name: 'grain', description: 'Subtle film-grain texture.', layer: 'grain', intensity: 0.8 },
  { name: 'vignette', description: 'Soft darkened edges drawing focus inward.', layer: 'vignette', intensity: 0.9 },
  {
    name: 'dust',
    description: 'Slow drifting motes.',
    layer: 'particles',
    particles: { count: 44, color: 'ink', minSize: 1, maxSize: 2.4, speed: 0, drift: 14, twinkle: true, direction: 'drift' },
  },
  {
    name: 'embers',
    description: 'Sparse warm rising particles.',
    layer: 'particles',
    particles: { count: 26, color: 'accent', minSize: 1.4, maxSize: 3.2, speed: 18, drift: 9, twinkle: true, direction: 'up' },
  },
  { name: 'fog', description: 'Hazy depth behind content.', layer: 'haze', intensity: 0.7 },
  {
    name: 'stars',
    description: 'A sparse night-sky field.',
    layer: 'particles',
    particles: { count: 56, color: 'ink', minSize: 0.8, maxSize: 1.8, speed: 0, drift: 0, twinkle: true, direction: 'static' },
  },
  { name: 'flicker', description: 'Unsteady, candle-like light.', layer: 'flicker', intensity: 0.85 },
];

/** Example board surfaces. */
export const EXAMPLE_SURFACES: SurfacePreset[] = [
  { name: 'flat', description: 'Plain responsive panel.' },
  { name: 'chalkboard', description: 'Matte hand-worked board.' },
  { name: 'paper', description: 'Warm paper feel.' },
];

/** Theme transition defaults (§6.8: tween, never a hard cut). */
export const DEFAULT_TRANSITION = { duration: 800, ease: 'smooth' as const };
