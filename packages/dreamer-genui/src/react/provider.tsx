import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Registry } from '../core/registry';
import type { LibraryError } from '../core/types';
import type { UIEvent } from '../schema/events';
import { MotionProvider } from './motion/animated';
import { BoardEmitContext } from './emit-context';
import type { ComponentOverride } from './anatomy';
import { createTranslator } from '../core/strings';
import { createAssetResolver } from '../core/assets';
import type { AssetResolveFunction, AssetResolver } from '../core/assets';

/** UI strings — all overridable for i18n. */
export interface UIStrings {
  return: string;
  continue: string;
  hint: string;
  /** Accessible name for the attached explainer region (§7.5). */
  explainer: string;
  /** Visible skip control that flushes pending entries (§6.3/§7.7). */
  skip: string;
  /** Dismiss control on a dismissible alert (§6.19). */
  dismiss: string;
  /** Carousel navigation. */
  previous: string;
  next: string;
  slide: string;
  carousel: string;
  /** Accessible name for an unlabelled interactive card. */
  card: string;
  /** Fallback accessible name for an unlabelled progress bar. */
  progress: string;
}

export const defaultStrings: UIStrings = {
  return: 'Return',
  continue: 'Continue',
  hint: 'Hint',
  explainer: 'Explainer',
  skip: 'Skip',
  dismiss: 'Dismiss',
  previous: 'Previous',
  next: 'Next',
  slide: 'Slide',
  carousel: 'Carousel',
  card: 'Card',
  progress: 'Progress',
};

export type ColorScheme = 'auto' | 'light' | 'dark';

/** Host/user density setting (§6.10), not tutor-controlled. */
export type Density = 'compact' | 'comfortable' | 'large';

export interface DreamerContextValue {
  registry: Registry;
  /** 'auto' resolves via the OS colour scheme (media query, SSR-safe default light). */
  colorScheme: ColorScheme;
  scheme: 'light' | 'dark';
  strings: UIStrings;
  /** BCP-47 locale used to resolve the strings registry (§7.11). */
  locale: string;
  /** Logical writing direction; `rtl` mirrors `left`/`right` slots. */
  dir: 'ltr' | 'rtl';
  density: Density;
  /** Translate a registered strings key (`board.*`, `assessment.*`, ...). */
  t: (key: string, values?: Record<string, string | number>) => string;
  /** Host-facing sinks for events emitted outside any <Board>. */
  onEvent?: (event: UIEvent) => void;
  onError?: (err: LibraryError) => void;
  /** Component overrides (§8.5.4): built-in component name → replacement. */
  components: Record<string, ComponentOverride | undefined>;
  /** Cached asset resolver (§7.6); always present, no-op when host supplies nothing. */
  assets: AssetResolver;
}

const DreamerContext = createContext<DreamerContextValue | null>(null);
export { DreamerContext };

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
  /** Locale for the strings registry; defaults to `en`. */
  locale?: string;
  /** Writing direction; `rtl` mirrors logical left/right placements. */
  dir?: 'ltr' | 'rtl';
  /** Host/user density; not normally tutor-controlled. */
  density?: Density;
  /** Slot/part/type replacement (§8.5.4), keyed by built-in component name
   *  (see `docs/components/`). Overrides receive `renderDefault()` plus the
   *  component's own props. */
  components?: Record<string, ComponentOverride | undefined>;
  /** Host asset callback for `{ asset: id }` references (§7.6). The library
   *  never fetches: this callback owns all network access; results are cached
   *  and deduplicated. */
  resolveAsset?: AssetResolveFunction;
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
export function DreamerProvider({
  registry,
  colorScheme = 'light',
  onEvent,
  onError,
  strings,
  locale = 'en',
  dir = 'ltr',
  density = 'comfortable',
  components,
  resolveAsset,
  children,
}: DreamerProviderProps) {
  const scheme = useMediaScheme(colorScheme === 'auto');
  const t = useMemo(() => createTranslator(registry, locale), [registry, locale]);
  const assets = useMemo(() => createAssetResolver(resolveAsset ?? (() => undefined)), [resolveAsset]);
  const mergedStrings = useMemo<UIStrings>(
    () => ({
      return: strings?.return ?? t('board.return'),
      continue: strings?.continue ?? t('board.continue'),
      hint: strings?.hint ?? t('board.hint'),
      explainer: strings?.explainer ?? defaultStrings.explainer,
      skip: strings?.skip ?? t('board.skip'),
      dismiss: strings?.dismiss ?? defaultStrings.dismiss,
      previous: strings?.previous ?? defaultStrings.previous,
      next: strings?.next ?? defaultStrings.next,
      slide: strings?.slide ?? defaultStrings.slide,
      carousel: strings?.carousel ?? defaultStrings.carousel,
      card: strings?.card ?? defaultStrings.card,
      progress: strings?.progress ?? defaultStrings.progress,
    }),
    [strings, t]
  );
  const value = useMemo<DreamerContextValue>(
    () => ({
      registry,
      colorScheme,
      scheme,
      onEvent,
      onError,
      strings: mergedStrings,
      locale,
      dir,
      density,
      t,
      components: components ?? {},
      assets,
    }),
    [registry, colorScheme, scheme, onEvent, onError, mergedStrings, locale, dir, density, t, components, assets]
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
