import type { Enter, Emphasis, Exit, EnterEffect } from '../../schema/motion';
import {
  EASE,
  ENTER_PRESETS,
  EMPHASIS_PRESETS,
  EXIT_PRESETS,
  ORDER_STEP_MS,
  type KineticEffect,
  KINETIC_PRESETS,
} from '../../motion/presets';
import type { EaseName } from '../../schema/motion';

/** Seconds per order step for sequenced entrances (same order plays together). */
export const STAGGER_SECONDS = ORDER_STEP_MS / 1000;

/** A motion-safe animation spec for the `motion` library (transform/opacity only). */
export interface MotionAnimation {
  initial: Record<string, number | string>;
  animate: Record<string, number | string>;
  exit?: Record<string, number | string>;
  transition: { duration?: number; delay?: number; ease?: [number, number, number, number] };
}

/**
 * MotionDriver maps protocol effect presets (§6.7) to concrete animation
 * specs — every timing/easing comes from motion/presets.ts, never inline.
 * The protocol never carries raw animation parameters beyond order/delay/
 * duration. Implementations must animate transform/opacity only.
 *
 * Text-level kinetic effects (words/chars/slam/typewriter/wipe/count-up/
 * scribble) are handled by the kinetic engine, so the driver returns null
 * for them — the container must not double-animate.
 */
export interface MotionDriver {
  /** Enter preset for a node at document index `docIndex`. `null` = render instantly (or kinetic handles it). */
  enter(enter: Enter | undefined, docIndex: number): MotionAnimation | null;
  /** Emphasis preset applied after enter. `null` = none. */
  emphasis(emphasis: Emphasis | undefined): { className: string; preset: (typeof EMPHASIS_PRESETS)[keyof typeof EMPHASIS_PRESETS] } | null;
  /** Exit preset. `null` = none. */
  exit(exit: Exit | undefined): Pick<MotionAnimation, 'exit' | 'transition'> | null;
}

/** Effects the kinetic text engine owns (container must stay static). */
const KINETIC_EFFECTS: ReadonlySet<string> = new Set(Object.keys(KINETIC_PRESETS) as KineticEffect[]);

function baseTransition(enter: Enter | undefined, docIndex: number, preset: (typeof ENTER_PRESETS)[EnterEffect], reduced: boolean): MotionAnimation['transition'] {
  const ms = enter?.duration ?? preset.duration;
  const delay = enter?.delay !== undefined ? enter.delay : (enter?.order ?? docIndex) * ORDER_STEP_MS;
  return {
    duration: ms / 1000,
    delay: delay / 1000,
    ease: reduced ? EASE.linear : EASE[preset.ease],
  };
}

function containerInitial(effect: EnterEffect): Record<string, number> | Record<string, number | string> {
  switch (effect) {
    case 'rise':
      return { opacity: 0, y: 24 };
    case 'pop':
      return { opacity: 0, scale: 0.7 };
    case 'sweep':
      return { opacity: 0, x: -28 };
    case 'zoom':
      return { opacity: 0, scale: 1.35 };
    case 'morph': // text-morph internals land later (M5); crossfade keeps the protocol honest
    case 'draw': // SVG draw-on is M5; the container crossfade keeps content visible
    case 'reveal':
    case 'stagger':
      return { opacity: 0 };
    default:
      return { opacity: 0 };
  }
}

/** Default (motion) driver: named presets on transform/opacity, timings from the table. */
export function createMotionDriver(): MotionDriver {
  function enterAnimation(enter: Enter | undefined, docIndex: number): MotionAnimation | null {
    const effect = enter?.effect;
    if (!effect || effect === 'none' || KINETIC_EFFECTS.has(effect)) return null;
    const preset = ENTER_PRESETS[effect];
    return {
      initial: containerInitial(effect),
      animate: { opacity: 1, ...(effect === 'rise' || effect === 'pop' || effect === 'sweep' ? { y: 0, x: 0, scale: 1 } : {}), ...(effect === 'zoom' ? { scale: 1 } : {}) },
      transition: baseTransition(enter, docIndex, preset, false),
    };
  }

  return {
    enter: enterAnimation,
    emphasis(emphasis) {
      if (!emphasis) return null;
      const preset = EMPHASIS_PRESETS[emphasis.effect];
      if (!preset) return null;
      return { className: `dg-emphasis-${emphasis.effect}`, preset };
    },
    exit(exit) {
      if (!exit) return null;
      const preset = EXIT_PRESETS[exit.effect];
      if (!preset || preset.duration === 0) return null;
      // wipe-out is text-level (clip sweep) in M3b; fade fallback keeps exits graceful
      const spec: Record<string, number> =
        exit.effect === 'shrink' ? { opacity: 0, scale: 0.92 } : { opacity: 0 };
      return {
        exit: spec,
        transition: { duration: preset.duration / 1000, ease: EASE[preset.ease] },
      };
    },
  };
}

/** Reduced-motion driver: everything renders instantly, content identical (§6.7). */
export function createReducedMotionDriver(): MotionDriver {
  return {
    enter: () => null,
    emphasis: () => null,
    exit: () => null,
  };
}
