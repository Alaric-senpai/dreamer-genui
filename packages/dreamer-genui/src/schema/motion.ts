import { z } from 'zod';

// ColorToken: theme token names, never raw colors
export const ColorTokenSchema = z.enum(['accent', 'info', 'success', 'warn', 'danger', 'muted']);
export type ColorToken = z.infer<typeof ColorTokenSchema>;

// Motion fields reused across marks and blocks
export const MotionFieldsSchema = z.object({
  order: z.number().optional(),
  delay: z.number().optional(),
  duration: z.number().optional(),
});
export type MotionFields = z.infer<typeof MotionFieldsSchema>;

// Enter animation
export const EnterSchema = z.object({
  effect: z.enum(['reveal', 'rise', 'pop', 'sweep', 'draw', 'stagger', 'none']),
  order: z.number().optional(),
  delay: z.number().optional(),
  duration: z.number().optional(),
});
export type Enter = z.infer<typeof EnterSchema>;

// Emphasis animation
export const EmphasisSchema = z.object({
  effect: z.enum(['pulse', 'underline', 'glow']),
  order: z.number().optional(),
});
export type Emphasis = z.infer<typeof EmphasisSchema>;

// Exit animation
export const ExitSchema = z.object({
  effect: z.enum(['fade', 'shrink', 'none']),
});
export type Exit = z.infer<typeof ExitSchema>;
