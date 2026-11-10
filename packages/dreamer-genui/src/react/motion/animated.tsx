import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { createContext, useContext, useMemo } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { Enter, Emphasis, Exit } from '../../schema/motion';
import {
  createMotionDriver,
  createReducedMotionDriver,
  type MotionDriver,
} from './driver';
import { useTempo } from './tempo';

/** Internal context carrying the active MotionDriver (respects reduced motion). */
const MotionDriverContext = createContext<MotionDriver | null>(null);

/** LazyMotion wrapper + reduced-motion-aware driver selection. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const prefersReduced = useReducedMotion();
  const driver = useMemo(() => (prefersReduced ? createReducedMotionDriver() : createMotionDriver()), [prefersReduced]);
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionDriverContext.Provider value={driver}>{children}</MotionDriverContext.Provider>
    </LazyMotion>
  );
}

function useMotionDriver(): MotionDriver {
  return useContext(MotionDriverContext) ?? createReducedMotionDriver();
}

export interface AnimatedProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  enter?: Enter;
  emphasis?: Emphasis;
  exit?: Exit;
  /** Document order — used for sequencing when enter.order is absent. */
  docIndex: number;
  children: ReactNode;
}

/**
 * Wrapper that plays the node's enter preset on mount, applies the emphasis
 * class, and supports exit. Under reduced motion it renders a plain div —
 * content and interactions are identical, just unanimated.
 */
export function Animated({ enter, emphasis, exit, docIndex, children, className, ...rest }: AnimatedProps) {
  const driver = useMotionDriver();
  const tempo = useTempo();
  const anim = driver.enter(enter, docIndex);
  const emphasisCls = driver.emphasis(emphasis)?.className;
  const exitSpec = driver.exit(exit);
  const cls = [className, emphasisCls].filter(Boolean).join(' ') || undefined;

  // Scene tempo (theme `motion.speed`, §6.8): stretches durations and the
  // order-sequenced delays together so slower moods feel weightier end-to-end.
  const transition = useMemo(() => {
    if (!anim?.transition) return undefined;
    const speed = tempo > 0 ? tempo : 1;
    const scale = 1 / speed;
    return {
      duration: anim.transition.duration !== undefined ? anim.transition.duration * scale : undefined,
      delay: anim.transition.delay !== undefined ? anim.transition.delay * scale : undefined,
      ease: anim.transition.ease,
    };
  }, [anim?.transition, tempo]);

  if (!anim) {
    return (
      <div className={cls} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <m.div
      className={cls}
      initial={anim.initial}
      animate={anim.animate}
      exit={exitSpec?.exit ?? anim.exit}
      transition={transition ?? anim.transition}
      {...rest}
    >
      {children}
    </m.div>
  );
}
