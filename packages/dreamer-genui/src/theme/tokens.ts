/**
 * Engine-side CSS custom-property map (§7.6).
 *
 * Every visual decision the library makes is expressed as a `--dg-*`
 * variable applied on the board root, at low specificity, wrapped in
 * `@layer dreamer-genui` (the layer lives in the compiled stylesheet —
 * M3d). The name map from schema `ThemeTokens` groups to variables is
 * logged in DECISIONS.md; the tutor-facing spec lives in schema/theme.ts.
 *
 * Layers (lowest to highest precedence, §6.8):
 *   `resolveTheme('light'|'dark')`  <  spec tokens via `tokensToVars`
 * (host baseline, mood blending and the contrast guardrail are applied
 * by the M2 engine-side resolver before tokens get here — everything
 * arriving in `tokensToVars` is already safe, parsed and clamped).
 */
import type { ThemeTokens } from '../schema/theme';
import { DEFAULT_TOKENS } from './presets';

export type CssTokens = Record<string, string>;

export type ThemeName = 'light' | 'dark';

/** Named-engine presets as partial schema ThemeTokens (light = DEFAULT_TOKENS). */
export const namedPresets: Record<ThemeName, Partial<ThemeTokens>> = {
  light: {
    color: { ...DEFAULT_TOKENS },
    font: {
      display: 'system-ui, -apple-system, sans-serif',
      body: 'system-ui, -apple-system, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    radius: { sm: 4, md: 8, lg: 16 },
    space: { scale: 1 },
    motion: { speed: 1, ease: 'smooth' },
    texture: { grain: 0, vignette: 0 },
  },
  dark: {
    color: {
      bg: '#14151b',
      surface: '#1d1f29',
      ink: '#e9eaf2',
      muted: '#9a9cae',
      accent: '#8faaff',
      info: '#5cc4f5',
      success: '#5fd08a',
      warn: '#ffb454',
      danger: '#f4727f',
    },
  },
};

/** Type-scale steps (§9: big contrast between hero and body). Plain CSS variables — not tutor-facing tokens. */
const lightTypeScale: CssTokens = {
  '--dg-text-hero': 'clamp(2.75rem, 11vw, 5.25rem)',
  '--dg-text-heading': 'clamp(1.7rem, 5.5vw, 2.4rem)',
  '--dg-text-body': '1.05rem',
  '--dg-text-small': '0.875rem',
  '--dg-text-kicker': '0.8rem',
  '--dg-line-height': '1.55',
};

const VARIABLE_PREFIX = '--dg-';

/** The full light-default variable map. Every named theme must define all of these. */
export const DEFAULT_VARS: CssTokens = {
  ...tokensToVars(namedPresets.light),
  ...lightTypeScale,
  '--dg-motion-duration-base': '700ms',
  '--dg-color-border': '#e2e2dc',
};

/** Resolve a named engine preset to a complete `--dg-*` map, with token overrides layered on top. */
export function resolveTheme(name: ThemeName, overrides?: Partial<ThemeTokens>): CssTokens {
  const base = name === 'dark' ? { ...DEFAULT_VARS, ...tokensToVars(namedPresets.dark) } : { ...DEFAULT_VARS };
  return overrides ? { ...base, ...tokensToVars(overrides) } : base;
}

/**
 * Map (already resolver-validated) schema tokens to `--dg-*` variable names.
 * Unset groups/roles stay out — the merge keeps the underlying layer visible.
 */
export function tokensToVars(t: ThemeTokens): CssTokens {
  const vars: CssTokens = {};
  if (t.color) {
    for (const [role, value] of Object.entries(t.color)) {
      if (value) vars[`${VARIABLE_PREFIX}color-${role}`] = value;
    }
  }
  if (t.font) {
    if (t.font.display) vars['--dg-font-display'] = t.font.display;
    if (t.font.body) vars['--dg-font-body'] = t.font.body;
    if (t.font.mono) vars['--dg-font-mono'] = t.font.mono;
  }
  if (t.radius) {
    if (t.radius.sm !== undefined) vars['--dg-radius-sm'] = `${t.radius.sm}px`;
    if (t.radius.md !== undefined) vars['--dg-radius-md'] = `${t.radius.md}px`;
    if (t.radius.lg !== undefined) vars['--dg-radius-lg'] = `${t.radius.lg}px`;
  }
  if (t.space && t.space.scale !== undefined) {
    vars['--dg-space-scale'] = String(t.space.scale);
  }
  if (t.motion) {
    if (t.motion.speed !== undefined) vars['--dg-motion-speed'] = String(t.motion.speed);
    if (t.motion.ease) vars['--dg-motion-ease'] = t.motion.ease;
  }
  if (t.texture) {
    if (t.texture.grain !== undefined) vars['--dg-texture-grain'] = String(t.texture.grain);
    if (t.texture.vignette !== undefined) vars['--dg-texture-vignette'] = String(t.texture.vignette);
  }
  return vars;
}
