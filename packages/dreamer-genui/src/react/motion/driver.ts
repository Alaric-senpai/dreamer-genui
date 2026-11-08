import type { Enter, Emphasis, Exit } from '../../schema/motion';

/** A motion-safe animation spec for the `motion` library (transform/opacity only). */
export interface MotionAnimation {
  initial: Record<string, number | string>;
  animate: Record<string, number | string>;
  exit?: Record<string, number | string>;
  transition: { duration?: number; delay?: number; ease?: [number, number, number, number] };
}

/**
 * MotionDriver maps protocol effect presets (AGENTS 6.6) to concrete
 * animation specs. The protocol never carries raw animation parameters
 * beyond order/delay/duration — the driver owns the actual values.
 * Implementations must animate transform/opacity only (no layout thrash).
 */
export interface MotionDriver {
  /** Enter preset for a node at document index `docIndex`. `null` = render instantly. */
  enter(enter: Enter | undefined, docIndex: number): MotionAnimation | null;
  /** Emphasis preset applied after enter. `null` = none. */
  emphasis(emphasis: Emphasis | undefined): { className: string } | null;
  /** Exit preset. `null` = none. */
  exit(exit: Exit | undefined): Pick<MotionAnimation, 'exit' | 'transition'> | null;
}

/** Seconds per order step for sequenced entrances (same order plays together). */
export const STAGGER_SECONDS = 0.12;

/** Default (motion) driver: named enter/exit presets on transform/opacity. */
export function createMotionDriver(): MotionDriver {
  function enterAnimation(enter: Enter | undefined, docIndex: number): MotionAnimation | null {
    const effect = enter?.effect ?? 'reveal';
    if (effect === 'none') return null;
    const delay = enter?.delay !== undefined ? enter.delay / 1000 : (enter?.order ?? docIndex) * STAGGER_SECONDS;
    const duration = enter?.duration !== undefined ? enter.duration / 1000 : 0.3;
    const transition = { duration, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
    switch (effect) {
      case 'rise':
        return { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition };
      case 'pop':
        return { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 }, transition };
      case 'sweep':
        return { initial: { opacity: 0, x: -24 }, animate: { opacity: 1, x: 0 }, transition };
      case 'draw':
      case 'reveal':
      case 'stagger':
      default:
        // draw is SVG-specific (GSAP, M5); stagger reveals children via the
        // container fade for now — refine when figure internals land.
        return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition };
    }
  }

  return {
    enter: enterAnimation,
    emphasis(emphasis) {
      if (!emphasis) return null;
      return { className: `dgui-emphasis-${emphasis.effect}` };
    },
    exit(exit) {
      if (!exit || exit.effect === 'none') return null;
      const spec: Record<string, number> = exit.effect === 'shrink' ? { opacity: 0, scale: 0.9 } : { opacity: 0 };
      return {
        exit: spec,
        transition: { duration: 0.2 },
      };
    },
  };
}

/** Reduced-motion driver: everything renders instantly, content identical. */
export function createReducedMotionDriver(): MotionDriver {
  return {
    enter: () => null,
    emphasis: () => null,
    exit: () => null,
  };
}
