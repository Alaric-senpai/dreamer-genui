import { createContext, useContext } from 'react';

/**
 * Scene tempo (§6.8 `motion.speed`, §9.1 rhythm). 1 = normal; slower moods
 * (e.g. solemn) pass <1; faster moods >1. The Board provides it from the
 * engine-resolved theme; the motion layer and kinetic engine scale their
 * timings through it — presets never carry tempo themselves.
 */
export const TempoContext = createContext(1);

export function useTempo(): number {
  return useContext(TempoContext);
}
