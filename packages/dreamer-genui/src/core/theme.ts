import type { ThemeSpec, ThemeTokens, ColorTokens } from '../schema/theme';
import type { EaseName } from '../schema/motion';
import { createError } from './errors';
import type { LibraryError } from './types';
import type { Registry, MoodPreset } from './registry';
import { DEFAULT_TOKENS, DEFAULT_TRANSITION } from '../theme/presets';
import { enforceContrast } from '../theme/contrast';
import { parseColor, mix, RGB } from '../theme/color';

export type ThemePolicy = 'none' | 'moods' | 'moods+tokens';

/**
 * What a resolved theme looks like once policy, validation, contrast and
 * defaults have been applied. This is the thing the reducer stores and the
 * M3 CSS layer writes to variables — never a raw ThemeSpec.
 */
export interface ResolvedTheme {
  /** The spec as submitted (already schema-validated). */
  spec: ThemeSpec;
  mood?: string;
  intensity: number;
  ambience?: { preset: string; intensity: number };
  surface?: string;
  tokens: ThemeTokens;
  transition: { duration: number; ease: EaseName };
}

export interface ThemeContext {
  /** "none" → every theme request rejected; "moods" → mood/ambience/surface
   *  only; "moods+tokens" → tutor may set tokens too. Default "moods". */
  policy: ThemePolicy;
  /** Optional host allowlists; anything outside is rejected with a warning. */
  allowedMoods?: string[];
  allowedAmbience?: string[];
  allowedFonts?: string[];
  /** Host theme (below tutor requests, above library defaults). */
  baseline?: ThemeSpec;
  /** Notified when the guardrail rewrites colours to stay readable (§6.8). */
  onThemeAdjusted?: (roles: string[]) => void;
}

export interface ThemeResolution {
  theme?: ResolvedTheme;
  /** Per-piece rejections — always non-fatal warnings, never thrown. */
  warnings: LibraryError[];
  /** Colour roles rewritten by the contrast guardrail. */
  adjusted: string[];
}

const NUMERIC_CLAMPS = {
  radius: [0, 64] as const,
  scale: [0.5, 3] as const,
  speed: [0.25, 4] as const,
  texture: [0, 1] as const,
};

const clamp = (v: number, [lo, hi]: readonly [number, number]): number => Math.min(hi, Math.max(lo, v));

/** Characters/constructs a font-family token may never contain. */
const UNSAFE_CSS = /[;{}@/()]|url\(|expression\(|var\(|calc\(|data:/i;

/**
 * Pure, headless theme resolver. Turns a ThemeSpec into a ResolvedTheme under
 * host policy: registered moods/ambience/surfaces, sanitised fonts, parsed
 * colours, clamped numbers, WCAG AA contrast, and per-piece `theme-rejected`
 * warnings. Never fatal: the resolved result keeps every valid piece, so a
 * decent tutor request always improves rather than breaks the board.
 */
export function createThemeResolver(
  registry: Registry,
  context: ThemeContext = { policy: 'moods' },
): (spec: ThemeSpec) => ThemeResolution {
  return (spec: ThemeSpec): ThemeResolution => {
    const warnings: LibraryError[] = [];
    const adjusted = new Set<string>();
    const reject = (detail: string): void => {
      warnings.push(createError('theme-rejected', detail));
    };

    if (context.policy === 'none') {
      reject('Theme changes are disabled by theme policy "none"');
      return { theme: undefined, warnings, adjusted: [] };
    }
    const tokensAllowed = context.policy === 'moods+tokens';

    // --- mood ---
    let mood: MoodPreset | undefined;
    if (spec.mood) {
      if (context.allowedMoods && !context.allowedMoods.includes(spec.mood)) {
        reject(`Mood "${spec.mood}" is not in the host allowlist`);
      } else {
        const preset = registry.getMood(spec.mood);
        if (!preset) reject(`Mood "${spec.mood}" is not registered`);
        else mood = preset;
      }
    }
    const intensity = spec.intensity !== undefined ? clamp(spec.intensity, [0, 1]) : 1;

    // --- tokens: defaults < host baseline < mood < spec ---
    const tokens = buildTokens(
      spec,
      mood,
      intensity,
      baseTokens(context.baseline, context.allowedFonts),
      tokensAllowed,
      warnings,
      adjusted,
      context.allowedFonts,
    );

    // --- ambience (spec wins over mood) ---
    let ambience: ResolvedTheme['ambience'] | undefined;
    if (mood?.ambience) ambience = { preset: mood.ambience, intensity: 1 };
    if (spec.ambience !== undefined) {
      const a =
        typeof spec.ambience === 'string'
          ? { preset: spec.ambience, intensity: 1 }
          : { preset: spec.ambience.preset, intensity: spec.ambience.intensity ?? 1 };
      if (context.allowedAmbience && !context.allowedAmbience.includes(a.preset)) {
        reject(`Ambience "${a.preset}" is not in the host allowlist`);
      } else if (!registry.getAmbience(a.preset)) {
        reject(`Ambience "${a.preset}" is not registered`);
      } else {
        ambience = a;
      }
    }

    // --- surface (spec wins over mood) ---
    let surface: string | undefined = mood?.surface;
    if (spec.surface !== undefined) {
      if (!registry.getSurface(spec.surface)) reject(`Surface "${spec.surface}" is not registered`);
      else surface = spec.surface;
    }

    // --- contrast guardrail (always; shipped presets must already pass) ---
    const guarded = enforceContrast(tokens.color!);
    tokens.color = guarded.tokens;
    for (const role of guarded.adjusted) adjusted.add(role);
    if (adjusted.size > 0) context.onThemeAdjusted?.([...adjusted]);

    const theme: ResolvedTheme = {
      spec,
      mood: mood?.name,
      intensity,
      ambience,
      surface,
      tokens,
      transition: {
        duration: spec.transition?.duration ?? DEFAULT_TRANSITION.duration,
        ease: spec.transition?.ease ?? DEFAULT_TRANSITION.ease,
      },
    };

    return { theme, warnings, adjusted: [...adjusted] };
  };
}

// --- token composition -------------------------------------------------------

function baseTokens(baseline: ThemeSpec | undefined, allowedFonts: string[] | undefined): ThemeTokens {
  const out = cloneTokens({ color: DEFAULT_TOKENS });
  if (baseline?.tokens) {
    // Host baseline is trusted: its tokens are always allowed, but only its
    // own allowlist applies (it may relist fonts).
    overlaySpecTokens(out, baseline.tokens, [], new Set<string>(), allowedFonts);
  }
  return out;
}

function buildTokens(
  spec: ThemeSpec,
  mood: MoodPreset | undefined,
  intensity: number,
  base: ThemeTokens,
  tokensAllowed: boolean,
  warnings: LibraryError[],
  adjusted: Set<string>,
  allowedFonts?: string[],
): ThemeTokens {
  const out = cloneTokens(base);

  // Mood overlay: colour roles blend toward the base by intensity;
  // other groups come from the mood as-is.
  if (mood) {
    if (mood.tokens.color) {
      out.color = { ...out.color, ...blendColors(mood.tokens.color, out.color!, intensity) };
    }
    const { color: _c, ...rest } = mood.tokens;
    if (rest.font) out.font = { ...out.font, ...rest.font };
    if (rest.radius) out.radius = clampRadius({ ...out.radius, ...rest.radius });
    if (rest.space) out.space = { ...out.space, ...rest.space };
    if (rest.motion) out.motion = { ...out.motion, ...rest.motion };
    if (rest.texture) out.texture = { ...out.texture, ...rest.texture };
  }

  // Tutor tokens (advanced, policy-gated).
  if (spec.tokens) {
    if (!tokensAllowed) {
      warnings.push(
        createError('theme-rejected', 'Theme tokens require theme policy "moods+tokens"; spec.tokens was ignored'),
      );
    } else {
      overlaySpecTokens(out, spec.tokens, warnings, adjusted, allowedFonts);
    }
  }

  return out;
}

/** Overlay validated, sanitised, clamped spec tokens onto `out`. */
function overlaySpecTokens(
  out: ThemeTokens,
  spec: NonNullable<ThemeSpec['tokens']>,
  warnings: LibraryError[],
  adjusted: Set<string>,
  allowedFonts?: string[],
): void {
  if (spec.color) {
    for (const [key, value] of Object.entries(spec.color) as [keyof ColorTokens, string | undefined][]) {
      if (value === undefined) continue;
      const parsed = parseColor(value);
      if (!parsed) {
        warnings.push(createError('theme-rejected', `Colour "${key}" was not a parsable hex/hsl/oklch value and was dropped`));
        continue;
      }
      out.color = { ...out.color!, [key]: value };
    }
  }
  if (spec.font) {
    for (const [key, value] of Object.entries(spec.font) as [keyof NonNullable<ThemeTokens['font']>, string | undefined][]) {
      if (value === undefined) continue;
      if (UNSAFE_CSS.test(value)) {
        warnings.push(createError('theme-rejected', `Font "${key}" contains CSS-unsafe characters and was dropped`));
        continue;
      }
      if (allowedFonts && !allowedFonts.includes(value)) {
        warnings.push(createError('theme-rejected', `Font "${value}" is not in the host allowlist; "${key}" was dropped`));
        continue;
      }
      out.font = { ...out.font!, [key]: value };
    }
  }
  if (spec.radius) out.radius = clampRadius({ ...out.radius, ...spec.radius });
  if (spec.space) out.space = { ...out.space, ...spec.space };
  if (spec.motion) out.motion = { ...out.motion, ...spec.motion };
  if (spec.texture) out.texture = { ...out.texture, ...spec.texture };
}

// --- font allowlist is passed through parameters; no module-level state. ---

function clampRadius(r: NonNullable<ThemeTokens['radius']>): NonNullable<ThemeTokens['radius']> {
  return {
    sm: r.sm !== undefined ? clamp(r.sm, NUMERIC_CLAMPS.radius) : undefined,
    md: r.md !== undefined ? clamp(r.md, NUMERIC_CLAMPS.radius) : undefined,
    lg: r.lg !== undefined ? clamp(r.lg, NUMERIC_CLAMPS.radius) : undefined,
  };
}

function blendColors(incoming: ColorTokens, base: ColorTokens, alpha: number): ColorTokens {
  const result: ColorTokens = { ...incoming };
  for (const [key, value] of Object.entries(incoming) as [keyof ColorTokens, string][]) {
    if (alpha >= 1) {
      result[key] = value;
      continue;
    }
    const from = base[key] !== undefined ? parseColor(base[key]!) : undefined;
    const to = parseColor(value);
    if (!to) continue;
    const targetRgb = from ?? fallbackRgb(key);
    const mixed: RGB = mix(targetRgb, to, alpha);
    result[key] = `rgb(${Math.round(mixed.r)} ${Math.round(mixed.g)} ${Math.round(mixed.b)})`;
  }
  return result;
}

function fallbackRgb(role: keyof ColorTokens): RGB {
  const fallback = DEFAULT_TOKENS[role] ?? '#808080';
  return parseColor(fallback) ?? { r: 128, g: 128, b: 128 };
}

function cloneTokens(t: ThemeTokens): ThemeTokens {
  return {
    color: t.color ? { ...t.color } : { ...DEFAULT_TOKENS },
    font: t.font ? { ...t.font } : undefined,
    radius: t.radius ? { ...t.radius } : undefined,
    space: t.space ? { ...t.space } : undefined,
    motion: t.motion ? { ...t.motion } : undefined,
    texture: t.texture ? { ...t.texture } : undefined,
  };
}
