import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Registry } from '../core/registry';
import type { LibraryError } from '../core/types';
import type { UIEvent } from '../schema/events';
import type { ThemeName, ThemeTokens } from '../theme/tokens';
import { resolveTheme } from '../theme/tokens';
import { MotionProvider } from './motion/animated';

/** UI strings — all overridable for i18n. */
export interface UIStrings {
  return: string;
  continue: string;
  hint: string;
}

export const defaultStrings: UIStrings = {
  return: 'Return',
  continue: 'Continue',
  hint: 'Hint',
};

export interface DreamerContextValue {
  registry: Registry;
  theme: ThemeTokens;
  /** Host-facing event sink. */
  onEvent?: (event: UIEvent) => void;
  /** Host-facing error sink. */
  onError?: (err: LibraryError) => void;
  strings: UIStrings;
}

const DreamerContext = createContext<DreamerContextValue | null>(null);

export interface DreamerProviderProps {
  registry: Registry;
  theme?: ThemeName | ThemeTokens;
  /** Per-token overrides on top of a named preset. */
  themeOverrides?: ThemeTokens;
  onEvent?: (event: UIEvent) => void;
  onError?: (err: LibraryError) => void;
  strings?: Partial<UIStrings>;
  children: ReactNode;
}

/**
 * Root provider: carries the registry, active theme tokens (as CSS custom
 * properties on a wrapper div), and the host-facing event/error sinks.
 */
export function DreamerProvider({ registry, theme = 'light', themeOverrides, onEvent, onError, strings, children }: DreamerProviderProps) {
  const tokens = typeof theme === 'string' ? resolveTheme(theme, themeOverrides) : { ...resolveTheme('light'), ...theme };
  const value: DreamerContextValue = {
    registry,
    theme: tokens,
    onEvent,
    onError,
    strings: { ...defaultStrings, ...strings },
  };
  return (
    <div style={tokens as React.CSSProperties} data-dreamer-root="">
      <DreamerContext.Provider value={value}>
        <MotionProvider>{children}</MotionProvider>
      </DreamerContext.Provider>
    </div>
  );
}

/** Access the provider context. Throws if used outside DreamerProvider. */
export function useDreamer(): DreamerContextValue {
  const ctx = useContext(DreamerContext);
  if (!ctx) throw new Error('dreamer-genui: useDreamer must be used inside <DreamerProvider>');
  return ctx;
}

/** Emit a UIEvent to the host (provider sink + any Board-level sink). */
export function useEmitEvent(): (event: UIEvent) => void {
  const { onEvent } = useDreamer();
  return (event) => onEvent?.(event);
}
