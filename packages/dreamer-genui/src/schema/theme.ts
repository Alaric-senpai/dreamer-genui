import { z } from 'zod';
import { EaseNameSchema } from './motion';

/**
 * Tutor-facing theme tokens (§6.8). Groups are optional; any colour must
 * parse as hex/hsl/oklch and every number is clamped by the theme resolver
 * (M2) before it ever reaches CSS. Never a raw CSS string, never `url()`.
 */
export const ColorTokensSchema = z.object({
  bg: z.string().optional(),
  surface: z.string().optional(),
  ink: z.string().optional(),
  muted: z.string().optional(),
  accent: z.string().optional(),
  info: z.string().optional(),
  success: z.string().optional(),
  warn: z.string().optional(),
  danger: z.string().optional(),
});
export type ColorTokens = z.infer<typeof ColorTokensSchema>;

// Font families are validated against the host allowlist by the resolver; the schema carries names only.
export const FontTokensSchema = z.object({
  display: z.string().optional(),
  body: z.string().optional(),
  mono: z.string().optional(),
});
export type FontTokens = z.infer<typeof FontTokensSchema>;

export const RadiusTokensSchema = z.object({
  sm: z.number().min(0).max(64).optional(),
  md: z.number().min(0).max(64).optional(),
  lg: z.number().min(0).max(64).optional(),
});
export type RadiusTokens = z.infer<typeof RadiusTokensSchema>;

export const MotionTokensSchema = z.object({
  /** Global tempo multiplier — 0.5 is twice as slow, 2 is twice as fast. Clamped to [0.25, 4]. */
  speed: z.number().min(0.25).max(4).optional(),
  ease: EaseNameSchema.optional(),
});
export type MotionTokens = z.infer<typeof MotionTokensSchema>;

export const TextureTokensSchema = z.object({
  grain: z.number().min(0).max(1).optional(),
  vignette: z.number().min(0).max(1).optional(),
});
export type TextureTokens = z.infer<typeof TextureTokensSchema>;

export const ThemeTokensSchema = z.object({
  color: ColorTokensSchema.optional(),
  font: FontTokensSchema.optional(),
  radius: RadiusTokensSchema.optional(),
  space: z.object({ scale: z.number().min(0.5).max(3).optional() }).optional(),
  motion: MotionTokensSchema.optional(),
  texture: TextureTokensSchema.optional(),
});
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

/** Ambience: a registered preset name, optionally with intensity 0..1. */
export const AmbienceSpecSchema = z.union([
  z.string().min(1),
  z.object({
    preset: z.string().min(1),
    intensity: z.number().min(0).max(1).optional(),
  }),
]);
export type AmbienceSpec = z.infer<typeof AmbienceSpecSchema>;

/**
 * ThemeSpec (§6.8): what the tutor may say about the board's mood and look.
 * `mood`/`ambience`/`surface` must name registered presets; `tokens` is the
 * advanced, policy-gated path. The resolver (core/theme, M2) turns this into
 * effective `--dg-*` variables under the host's policy and contrast rules.
 */
export const ThemeSpecSchema = z.object({
  mood: z.string().min(1).optional(),
  intensity: z.number().min(0).max(1).optional(),
  tokens: ThemeTokensSchema.optional(),
  ambience: AmbienceSpecSchema.optional(),
  surface: z.string().min(1).optional(),
  transition: z
    .object({
      duration: z.number().min(0).max(10_000).optional(),
      ease: EaseNameSchema.optional(),
    })
    .optional(),
});
export type ThemeSpec = z.infer<typeof ThemeSpecSchema>;
