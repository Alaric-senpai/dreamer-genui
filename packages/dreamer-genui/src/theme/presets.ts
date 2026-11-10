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

/** Example ambience presets — implementations live in the ambience runtime (M4); names usable now. */
export const EXAMPLE_AMBIENCE: AmbiencePreset[] = [
  { name: 'grain', description: 'Subtle film-grain texture.' },
  { name: 'vignette', description: 'Soft darkened edges drawing focus inward.' },
  { name: 'dust', description: 'Slow drifting motes.' },
  { name: 'embers', description: 'Sparse warm rising particles.' },
  { name: 'fog', description: 'Hazy depth behind content.' },
  { name: 'stars', description: 'A sparse night-sky field.' },
  { name: 'flicker', description: 'Unsteady, candle-like light.' },
];

/** Example board surfaces. */
export const EXAMPLE_SURFACES: SurfacePreset[] = [
  { name: 'flat', description: 'Plain responsive panel.' },
  { name: 'chalkboard', description: 'Matte hand-worked board.' },
  { name: 'paper', description: 'Warm paper feel.' },
];

/** Theme transition defaults (§6.8: tween, never a hard cut). */
export const DEFAULT_TRANSITION = { duration: 800, ease: 'smooth' as const };
