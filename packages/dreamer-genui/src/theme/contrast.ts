import type { ColorTokens } from '../schema/theme';
import { contrastRatio, mix, parseColor, RGB } from './color';

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
  if (!bg) return { tokens: out, adjusted };

  let backgrounds: RGB[] = surface ? [bg, surface] : [bg];

  const bestScore = (c: RGB): number =>
    Math.min(...backgrounds.map(B => contrastRatio(c, B)));
  const originalScore = (name: string): number => {
    const c = parseColorValue(color[name as keyof ColorTokens]);
    return c ? bestScore(c) : Infinity;
  };
  const passes = (c: RGB, target: number): boolean => bestScore(c) >= target;

  /**
   * Adjust a TEXT role for readability against ALL backgrounds: try both
   * directions (toward white / toward black), take the smallest step that
   * passes, otherwise the best achievable improvement. Never returns a
   * colour worse than the original for that role.
   */
  const adjustText = (c: RGB, target: number): RGB | undefined => {
    let bestRgb: RGB | undefined;
    let bestRatio = bestScore(c);
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      for (const dir of [WHITE, BLACK]) {
        const cand = mix(c, dir, t);
        const score = bestScore(cand);
        if (score >= target) return cand;
        if (score > bestRatio) {
          bestRatio = score;
          bestRgb = cand;
        }
      }
    }
    return bestRgb;
  };

  /**
   * Phase 1 — ink. If no ink adjustment can satisfy BOTH bg and surface, the
   * palette is internally contradictory (e.g. white bg + saturated dark-green
   * surface); move surface toward bg until ink passes, then proceed.
   */
  const ink = parseColorValue(color.ink);
  if (ink) {
    let ok = passes(ink, BODY_TARGET);
    const fixed = ok ? undefined : adjustText(ink, BODY_TARGET);
    if (fixed) {
      ok = passes(fixed, BODY_TARGET);
      if (ok) applyTextFix('ink', fixed);
    }
    if (!ok && surface && backgrounds.length > 1) {
      for (let t = 0.1; t <= 1.0001 && !ok; t += 0.1) {
        const candidate = mix(surface, bg, t);
        backgrounds = [bg, candidate];
        const fixed2 = adjustText(parseColorValue(color.ink)!, BODY_TARGET);
        if (fixed2 && passes(fixed2, BODY_TARGET)) {
          out.surface = `rgb(${Math.round(candidate.r)} ${Math.round(candidate.g)} ${Math.round(candidate.b)})`;
          adjusted.push('surface');
          applyTextFix('ink', fixed2);
          ok = true;
        }
      }
    }
    if (!ok && fixed) applyTextFix('ink', fixed);
  }

  // Phase 2 — the remaining roles, text-adjust only (never worse than original).
  adjustRole('muted', BODY_TARGET);
  for (const role of ACCENT_ROLES) adjustRole(role, ACCENT_TARGET);

  return { tokens: out, adjusted };

  // --- helpers ---

  function adjustRole(name: string, target: number): void {
    const original = parseColorValue(color[name as keyof ColorTokens]);
    if (!original) return;
    if (passes(original, target)) return;
    const fixed = adjustText(original, target);
    if (!fixed) return;
    // only accept an improvement (the fallback path may not reach target)
    if (bestScore(fixed) > originalScore(name)) {
      out[name as keyof ColorTokens] = `rgb(${Math.round(fixed.r)} ${Math.round(fixed.g)} ${Math.round(fixed.b)})`;
      adjusted.push(name);
    }
  }

  function applyTextFix(name: string, fixed: RGB): void {
    out[name as keyof ColorTokens] = `rgb(${Math.round(fixed.r)} ${Math.round(fixed.g)} ${Math.round(fixed.b)})`;
    if (!adjusted.includes(name)) adjusted.push(name);
  }
}

function parseColorValue(v: string | undefined): RGB | undefined {
  return v ? parseColor(v) : undefined;
}
