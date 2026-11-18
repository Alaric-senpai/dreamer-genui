/**
 * Motion presets — the ONE tunable table (§9.1: keep them in one place).
 * Every EnterEffect, Emphasis, Exit, ease curve and kinetic-text timing lives
 * here; the protocol (schema/motion.ts) never carries raw parameters, and no
 * component hardcodes a duration.
 *
 * `duration` is in ms at tempo 1; scene tempo (theme `motion.speed`) scales
 * everything through `applyTempo`. Each preset declares its reduced-motion
 * behavior: 'instant' (step straight to final visual) or 'fade' (short fade).
 */
import type { EnterEffect, EaseName } from '../schema/motion';

/** Named easing set (§6.3): cubic-bezier curves, x in [0,1]. */
export const EASE: Record<EaseName, [number, number, number, number]> = {
  smooth: [0.22, 0.61, 0.24, 1], // gentle settle, WebGrains easeOutQuint analog
  snappy: [0.2, 0.94, 0.32, 1.04], // decisive, tiny overshoot
  overshoot: [0.34, 1.56, 0.64, 1], // springy overshoot
  anticipate: [0.68, -0.55, 0.265, 1.55], // wind-up then land
  linear: [0, 0, 1, 1], // deliberate tickers/typewriter only
};

/** Scale a duration (or stagger step) by the scene tempo (theme `motion.speed`). */
export function applyTempo(ms: number, speed: number): number {
  const s = speed > 0 ? speed : 1;
  return ms / s;
}

/** The one short fade used when a preset's reduced-motion behavior is 'fade' (§9.3). */
export const REDUCED_FADE_MS = 150;

/** Gap between consecutive order steps for sequenced container entrances (§9.1: beats, not pages). */
export const ORDER_STEP_MS = 120;

/** Provisional cue lead measured against the reference (§6.17); re-measure at M6d. */
export const CUE_LEAD_MS = 180;

/** Pointer travel and tap ripple (§6.18). */
export const POINTER_TRAVEL_MS = 600;
export const POINTER_RIPPLE_MS = 400;

/** Orbit diagram revolution time for the pure layout (§6.18). */
export const ORBIT_REVOLUTION_MS = 21_000;

/** Camera drift: slow continuous push-in over this window (§6.18). */
export const DRIFT_DURATION_MS = 10_000;
export const DRIFT_ZOOM = 1.06;

export interface EnterPreset {
  /** Base duration at tempo 1. */
  duration: number;
  ease: EaseName;
  /** Reduced-motion behavior (§6.7): instant or a short plain fade. */
  reducedMotion: 'instant' | 'fade';
}

/** Container enter presets (§6.7). Kinetic text effects live in KINETIC_PRESETS. */
export const ENTER_PRESETS: Record<EnterEffect, EnterPreset> = {
  reveal: { duration: 300, ease: 'smooth', reducedMotion: 'instant' },
  rise: { duration: 340, ease: 'smooth', reducedMotion: 'instant' },
  pop: { duration: 380, ease: 'overshoot', reducedMotion: 'instant' },
  sweep: { duration: 340, ease: 'snappy', reducedMotion: 'instant' },
  draw: { duration: 800, ease: 'linear', reducedMotion: 'instant' }, // M5: SVG paths
  stagger: { duration: 300, ease: 'smooth', reducedMotion: 'fade' },
  none: { duration: 0, ease: 'linear', reducedMotion: 'instant' },
  typewriter: { duration: 1200, ease: 'linear', reducedMotion: 'instant' },
  words: { duration: 320, ease: 'smooth', reducedMotion: 'fade' },
  chars: { duration: 260, ease: 'snappy', reducedMotion: 'fade' },
  slam: { duration: 420, ease: 'overshoot', reducedMotion: 'instant' },
  wipe: { duration: 380, ease: 'snappy', reducedMotion: 'instant' },
  scribble: { duration: 600, ease: 'linear', reducedMotion: 'instant' }, // refined in M5
  zoom: { duration: 320, ease: 'overshoot', reducedMotion: 'instant' },
  'count-up': { duration: 800, ease: 'linear', reducedMotion: 'instant' },
  morph: { duration: 700, ease: 'smooth', reducedMotion: 'instant' },
  'tilt-rise': { duration: 620, ease: 'overshoot', reducedMotion: 'instant' },
  assemble: { duration: 700, ease: 'smooth', reducedMotion: 'instant' },
  iris: { duration: 900, ease: 'smooth', reducedMotion: 'instant' },
};

export type EmphasisEffect = 'pulse' | 'underline' | 'glow' | 'shake' | 'bounce' | 'wobble';

export interface EmphasisPreset {
  duration: number;
  ease: EaseName;
  /** Looping emphasis repeats; one-shot plays once and settles. */
  loop: boolean;
}

/** Emphasis plays after enter (§6.7). CSS-class driven in M3; restyled in M3d. */
export const EMPHASIS_PRESETS: Record<EmphasisEffect, EmphasisPreset> = {
  pulse: { duration: 700, ease: 'smooth', loop: false },
  underline: { duration: 450, ease: 'snappy', loop: false },
  glow: { duration: 900, ease: 'smooth', loop: true },
  shake: { duration: 420, ease: 'snappy', loop: false },
  bounce: { duration: 600, ease: 'overshoot', loop: true },
  wobble: { duration: 700, ease: 'anticipate', loop: true },
};

export type ExitEffect = 'fade' | 'shrink' | 'wipe-out' | 'none';

export interface ExitPreset {
  duration: number;
  ease: EaseName;
}

export const EXIT_PRESETS: Record<ExitEffect, ExitPreset> = {
  fade: { duration: 200, ease: 'smooth' },
  shrink: { duration: 240, ease: 'snappy' },
  'wipe-out': { duration: 300, ease: 'snappy' },
  none: { duration: 0, ease: 'linear' },
};

export type KineticEffect = 'words' | 'chars' | 'typewriter' | 'slam' | 'wipe' | 'scribble' | 'count-up' | 'assemble' | 'morph';

export interface KineticPreset {
  /** How the inline text is split for this effect. */
  split: 'words' | 'chars' | 'none';
  /** Per-unit (word/char/step) duration at tempo 1. */
  duration: number;
  /** Gap between consecutive units, in ms. */
  stagger: number;
  ease: EaseName;
  reducedMotion: 'instant' | 'fade';
}

/** Text-level presets (§9.1 kinetic typography). */
export const KINETIC_PRESETS: Record<KineticEffect, KineticPreset> = {
  words: { split: 'words', duration: 280, stagger: 60, ease: 'smooth', reducedMotion: 'fade' },
  chars: { split: 'chars', duration: 220, stagger: 36, ease: 'snappy', reducedMotion: 'fade' },
  typewriter: { split: 'none', duration: 26, stagger: 0, ease: 'linear', reducedMotion: 'instant' }, // per char "type" step
  slam: { split: 'words', duration: 380, stagger: 90, ease: 'overshoot', reducedMotion: 'instant' },
  wipe: { split: 'none', duration: 420, stagger: 0, ease: 'snappy', reducedMotion: 'instant' },
  scribble: { split: 'none', duration: 700, stagger: 0, ease: 'linear', reducedMotion: 'instant' },
  'count-up': { split: 'none', duration: 900, stagger: 0, ease: 'linear', reducedMotion: 'instant' },
  assemble: { split: 'words', duration: 600, stagger: 18, ease: 'overshoot', reducedMotion: 'fade' },
  morph: { split: 'words', duration: 700, stagger: 18, ease: 'smooth', reducedMotion: 'fade' },
};

/** Reference-matched typewriter cadence: 45–65 ms per grapheme (§6.18). */
export const TYPEWRITER_CADENCE_MS = 55;

/** Caret blink period for typewriter text (§6.18). */
export const CARET_BLINK_MS = 900;

export type SceneTransitionKind = 'cut' | 'fade' | 'wipe' | 'push' | 'iris' | 'morph';

export interface TransitionPreset {
  duration: number;
  ease: EaseName;
  reducedMotion: 'instant' | 'fade';
}

/**
 * Scene transition presets (§6.18), measured from the reference: the default
 * fade is 450 ms, push 650 ms, wipe 600 ms, iris 900 ms and morph 700 ms.
 * `transitions-default` registers these through the public `defineTransition`.
 */
export const TRANSITION_PRESETS: Record<SceneTransitionKind, TransitionPreset> = {
  cut: { duration: 0, ease: 'linear', reducedMotion: 'instant' },
  fade: { duration: 450, ease: 'smooth', reducedMotion: 'fade' },
  wipe: { duration: 600, ease: 'snappy', reducedMotion: 'fade' },
  push: { duration: 650, ease: 'smooth', reducedMotion: 'fade' },
  iris: { duration: 900, ease: 'smooth', reducedMotion: 'fade' },
  morph: { duration: 700, ease: 'smooth', reducedMotion: 'fade' },
};

/** Which kinetic container effect each text variant defaults to (§9.2 — kinetic by default). */
export const DEFAULT_TEXT_ENTER: Record<string, EnterEffect> = {
  hero: 'slam',
  heading: 'chars',
  body: 'words',
  definition: 'reveal',
  note: 'reveal',
  kicker: 'wipe',
  quote: 'words',
};
