import type { ColorTokens } from '../schema/theme';
import { contrastRatio, isLight, mix, parseColor, RGB } from './color';

/**
 * Contrast guardrail (§6.8): the resolver enforces minimum text contrast
 * by adjusting `ink`, `muted` and accent-family colours when a requested
 * palette would be unreadable. Deterministic: same input → same output.
 *
 * Targets follow WCAG AA — 4.5:1 for body text roles (ink, muted),
 * 3:1 for accent-family roles (large text/UI).
 * Checked against BOTH bg and surface so text stays readable on cards.
 */

const BODY_TARGET = 4.5;
const ACCENT_TARGET = 3.0;
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

export interface ContrastResult {
  tokens: ColorTokens;
  /** Names of roles that were rewritten to stay readable. */
  adjusted: string[];
}

const ACCENT_ROLES: (keyof ColorTokens)[] = ['accent', 'info', 'success', 'warn', 'danger'] as (keyof ColorTokens)[];

export function enforceContrast(color: ColorTokens): ContrastResult {
  const out: ColorTokens = { ...color };
  const adjusted: string[] = [];
  const bg = parseColorValue(color.bg);
  const surface = parseColorValue(color.surface);
  const backgrounds: RGB[] = [];
  if (bg) backgrounds.push(bg);
  if (surface) backgrounds.push(surface);
  if (backgrounds.length === 0) return { tokens: out, adjusted };

  const ensure = (name: string, target: number): void => {
    const original = parseColorValue(color[name as keyof ColorTokens]);
    if (!original) return;
    if (passes(original, backgrounds, target)) return;
    const fixed = adjustToTarget(original, backgrounds, target);
    if (fixed) {
      out[name as keyof ColorTokens] = `rgb(${Math.round(fixed.r)} ${Math.round(fixed.g)} ${Math.round(fixed.b)})`;
      adjusted.push(name);
    }
  };

  ensure('ink', BODY_TARGET);
  ensure('muted', BODY_TARGET);
  for (const role of ACCENT_ROLES) {
    ensure(role, ACCENT_TARGET);
  }

  return { tokens: out, adjusted };
}

function parseColorValue(v: string | undefined): RGB | undefined {
  return v ? parseColor(v) : undefined;
}

function passes(c: RGB, backgrounds: RGB[], target: number): boolean {
  return backgrounds.every(bg => contrastRatio(c, bg) >= target);
}

/**
 * Move the text colour away from the background until it reaches the target:
 * mix toward white on dark backgrounds, toward black on light ones.
 * 20 steps; the last step is the pure opposite so the guardrail always
 * terminates at a readable value.
 */
function adjustToTarget(c: RGB, backgrounds: RGB[], target: number): RGB | undefined {
  const darkestBg = backgrounds.reduce((a, b) => (lum(a) <= lum(b) ? a : b));
  const targetColor = isLight(darkestBg) ? BLACK : WHITE;
  for (let t = 0.08; t < 1; t += 0.08) {
    const candidate = mix(c, targetColor, t);
    if (passes(candidate, backgrounds, target)) return candidate;
  }
  return targetColor;
}

function lum(c: RGB): number {
  // cheap luminance ordering; full math lives in color.ts
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}
