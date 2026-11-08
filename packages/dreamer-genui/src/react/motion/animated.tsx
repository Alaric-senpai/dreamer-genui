import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { createContext, useContext, useMemo } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { Enter, Emphasis, Exit } from '../../schema/motion';
import {
  createMotionDriver,
  createReducedMotionDriver,
  type MotionDriver,
} from './driver';

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
  const anim = driver.enter(enter, docIndex);
  const emphasisCls = driver.emphasis(emphasis)?.className;
  const exitSpec = driver.exit(exit);
  const cls = [className, emphasisCls].filter(Boolean).join(' ') || undefined;

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
      transition={anim.transition}
      {...rest}
    >
      {children}
    </m.div>
  );
}
