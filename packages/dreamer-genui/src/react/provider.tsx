import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Registry } from '../core/registry';
import type { LibraryError } from '../core/types';
import type { UIEvent } from '../schema/events';
import { MotionProvider } from './motion/animated';
import { BoardEmitContext } from './emit-context';

/** UI strings — all overridable for i18n. */
export interface UIStrings {
  return: string;
  continue: string;
  hint: string;
  /** Accessible name for the attached explainer region (§7.5). */
  explainer: string;
  /** Visible skip control that flushes pending entries (§6.3/§7.7). */
  skip: string;
}

export const defaultStrings: UIStrings = {
  return: 'Return',
  continue: 'Continue',
  hint: 'Hint',
  explainer: 'Explainer',
  skip: 'Skip',
};

export type ColorScheme = 'auto' | 'light' | 'dark';

export interface DreamerContextValue {
  registry: Registry;
  /** 'auto' resolves via the OS colour scheme (media query, SSR-safe default light). */
  colorScheme: ColorScheme;
  scheme: 'light' | 'dark';
  strings: UIStrings;
  /** Host-facing sinks for events emitted outside any <Board>. */
  onEvent?: (event: UIEvent) => void;
  onError?: (err: LibraryError) => void;
}

const DreamerContext = createContext<DreamerContextValue | null>(null);

export interface DreamerProviderProps {
  registry: Registry;
  /** Engine-level configuration (theme policy/allowlists/baseline, registry, error sink)
   *  is passed at store creation: `createBoardStore({ registry, theme: {...} })` — ops
   *  can arrive before React renders, so policy must exist before mount. This provider
   *  owns the *presentation* layer only. See DECISIONS.md, M3 ruling. */
  colorScheme?: ColorScheme;
  onEvent?: (event: UIEvent) => void;
  onError?: (err: LibraryError) => void;
  strings?: Partial<UIStrings>;
  children: ReactNode;
}

function useMediaScheme(auto: boolean): 'light' | 'dark' {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!auto || typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    () => {
      if (!auto) return 'light';
      if (typeof window === 'undefined' || !window.matchMedia) return 'light';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    () => 'light' as const
  );
}

/**
 * Presentation-level root (§10): carries the registry, the colour-scheme
 * preference and the host-facing event/error sinks. It applies no theme of
 * its own — the resolved board theme flows from the store's state (engine
 * resolver, M2) onto the `<Board>` root as `--dg-*` variables.
 */
export function DreamerProvider({ registry, colorScheme = 'light', onEvent, onError, strings, children }: DreamerProviderProps) {
  const scheme = useMediaScheme(colorScheme === 'auto');
  const value = useMemo<DreamerContextValue>(
    () => ({
      registry,
      colorScheme,
      scheme,
      onEvent,
      onError,
      strings: { ...defaultStrings, ...strings },
    }),
    [registry, colorScheme, scheme, onEvent, onError, strings]
  );
  return (
    <DreamerContext.Provider value={value}>
      <MotionProvider>{children}</MotionProvider>
    </DreamerContext.Provider>
  );
}

/** Access the provider context. Throws if used outside DreamerProvider. */
export function useDreamer(): DreamerContextValue {
  const ctx = useContext(DreamerContext);
  if (!ctx) throw new Error('dreamer-genui: useDreamer must be used inside <DreamerProvider>');
  return ctx;
}

/** Emit a UIEvent. Inside a <Board>, events go onto the board's bus (so both
 * provider-level and board-level sinks fire); outside, straight to the
 * provider sink. */
export function useEmitEvent(): (event: UIEvent) => void {
  const boardEmit = useContext(BoardEmitContext);
  const { onEvent } = useDreamer();
  return boardEmit ?? ((event) => onEvent?.(event));
}
