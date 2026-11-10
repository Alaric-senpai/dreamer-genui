/**
 * Colour parsing and contrast math for the theme resolver.
 *
 * Accepts the protocol colour formats only: hex, hsl(), oklch(). Anything
 * else (url(), gradients, var(), calc(), free-form CSS) is unparsable here
 * and therefore rejected upstream — model output can never interpolate raw
 * CSS into the board.
 */

export interface RGB {
  /** 0..255 sRGB, integer-ish floats allowed internally. */
  r: number;
  g: number;
  b: number;
}

/** Parse a protocol colour to sRGB 0..255. Returns undefined for unsafe/unparsable input. */
export function parseColor(input: string): RGB | undefined {
  const s = input.trim();
  if (s.startsWith('#')) return parseHex(s);
  if (/^hsla?\(/i.test(s)) return parseHsl(s);
  if (/^oklch\(/i.test(s)) return parseOklch(s);
  return undefined;
}

function parseHex(s: string): RGB | undefined {
  if (!/^#[0-9a-fA-F]{3,8}$/.test(s)) return undefined;
  const hex = s.slice(1);
  const n = hex.length;
  if (n === 3 || n === 4) {
    const r = parseInt(hex[0]!, 16) * 17;
    const g = parseInt(hex[1]!, 16) * 17;
    const b = parseInt(hex[2]!, 16) * 17;
    return { r, g, b };
  }
  if (n === 6 || n === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return undefined;
}

/** "hsl(210 50% 20%)" / "hsl(210, 50%, 20%)" / optional alpha channel (ignored for contrast). */
function parseHsl(s: string): RGB | undefined {
  const m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[, ]+([\d.]+)%[, ]+([\d.]+)%(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i);
  if (!m) return undefined;
  const h = Number(m[1]) / 360;
  const sat = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  return hslToRgb(h, sat, l);
}

function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const v = clamp01(l) * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);
  return { r: r * 255, g: g * 255, b: b * 255 };
}

function hueToRgb(p: number, q: number, t: number): number {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

/** "oklch(0.62 0.18 250)" — L as number (0..1) or percent; hue in degrees; alpha ignored. */
function parseOklch(s: string): RGB | undefined {
  const m = s.match(/^oklch\(\s*([\d.]+)(%)?[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i);
  if (!m) return undefined;
  const L = m[2] ? Number(m[1]) / 100 : Number(m[1]);
  const c = Number(m[3]);
  const hueDeg = Number(m[4]);
  const a = c * Math.cos((hueDeg * Math.PI) / 180);
  const b = c * Math.sin((hueDeg * Math.PI) / 180);
  return oklabToRgb(L, a, b);
}

// oklab → linear sRGB (Björn Ottosson's matrices)
function oklabToRgb(L: number, a: number, b: number): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  r = gamma(clamp01(r));
  g = gamma(clamp01(g));
  bl = gamma(clamp01(bl));
  return { r: r * 255, g: g * 255, b: bl * 255 };
}

function gamma(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Render as a plain, protocol-safe CSS colour. */
export function formatRgb(c: RGB): string {
  return `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)})`;
}

/** Linear interpolation in sRGB space toward a target colour (t: 0..1). */
export function mix(c: RGB, target: RGB, t: number): RGB {
  return {
    r: c.r + (target.r - c.r) * t,
    g: c.g + (target.g - c.g) * t,
    b: c.b + (target.b - c.b) * t,
  };
}

/** WCAG relative luminance. */
export function relativeLuminance(c: RGB): number {
  const f = (v: number): number => {
    const x = clamp01(v / 255);
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** WCAG contrast ratio (1..21). */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Lighter-than check helper: which of two colours is the background "bright" one. */
export function isLight(c: RGB): boolean {
  return relativeLuminance(c) > 0.5;
}
