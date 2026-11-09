/**
 * Engine-side CSS custom-property map. A theme preset is a flat map of
 * `--dg-*` variable names to values; applied on the board root so hosts
 * can override single tokens from CSS. (The tutor-facing `ThemeTokens`
 * spec lives in schema/theme.ts.)
 */
export type CssTokens = Record<string, string>;

/** Token keys every theme must define. */
export const TOKEN_KEYS = [
  // colour roles
  '--dgui-color-bg',
  '--dgui-color-fg',
  '--dgui-color-accent',
  '--dgui-color-info',
  '--dgui-color-success',
  '--dgui-color-warn',
  '--dgui-color-danger',
  '--dgui-color-muted',
  '--dgui-color-surface',
  '--dgui-color-border',
  // typography
  '--dgui-font-family',
  '--dgui-font-size',
  '--dgui-font-size-heading',
  // shape and space
  '--dgui-radius',
  '--dgui-space-1',
  '--dgui-space-2',
  '--dgui-space-3',
  '--dgui-space-4',
  // motion
  '--dgui-motion-duration',
  '--dgui-motion-easing',
] as const;

/** Light theme (default). */
export const lightTheme: CssTokens = {
  '--dgui-color-bg': '#ffffff',
  '--dgui-color-fg': '#1a1d21',
  '--dgui-color-accent': '#2563eb',
  '--dgui-color-info': '#0ea5e9',
  '--dgui-color-success': '#16a34a',
  '--dgui-color-warn': '#d97706',
  '--dgui-color-danger': '#dc2626',
  '--dgui-color-muted': '#6b7280',
  '--dgui-color-surface': '#f3f4f6',
  '--dgui-color-border': '#e5e7eb',
  '--dgui-font-family': 'system-ui, -apple-system, sans-serif',
  '--dgui-font-size': '16px',
  '--dgui-font-size-heading': '24px',
  '--dgui-radius': '12px',
  '--dgui-space-1': '4px',
  '--dgui-space-2': '8px',
  '--dgui-space-3': '16px',
  '--dgui-space-4': '24px',
  '--dgui-motion-duration': '300ms',
  '--dgui-motion-easing': 'cubic-bezier(0.22, 1, 0.36, 1)',
};

/** Dark theme. */
export const darkTheme: CssTokens = {
  ...lightTheme,
  '--dgui-color-bg': '#0f1115',
  '--dgui-color-fg': '#e5e7eb',
  '--dgui-color-accent': '#60a5fa',
  '--dgui-color-info': '#38bdf8',
  '--dgui-color-success': '#4ade80',
  '--dgui-color-warn': '#fbbf24',
  '--dgui-color-danger': '#f87171',
  '--dgui-color-muted': '#9ca3af',
  '--dgui-color-surface': '#1f2937',
  '--dgui-color-border': '#374151',
};

export type ThemeName = 'light' | 'dark';

/** Resolve a theme by name, with per-token overrides applied on top. */
export function resolveTheme(name: ThemeName, overrides?: CssTokens): CssTokens {
  const base = name === 'dark' ? darkTheme : lightTheme;
  return overrides ? { ...base, ...overrides } : { ...base };
}
