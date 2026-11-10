import { z } from 'zod';
import { NodeIdSchema, NodeRefSchema } from './common';

// ColorToken: theme token names, never raw colors. `ink` is the primary text colour.
export const ColorTokenSchema = z.enum(['accent', 'info', 'success', 'warn', 'danger', 'muted', 'ink']);
export type ColorToken = z.infer<typeof ColorTokenSchema>;

// Motion fields reused across marks and blocks
export const MotionFieldsSchema = z.object({
  order: z.number().optional(),
  delay: z.number().optional(),
  duration: z.number().optional(),
});
export type MotionFields = z.infer<typeof MotionFieldsSchema>;

// Named easing set (§6.7). Values live in motion/presets.ts — never here.
export const EaseNameSchema = z.enum(['smooth', 'snappy', 'overshoot', 'anticipate', 'linear']);
export type EaseName = z.infer<typeof EaseNameSchema>;

// Trigger: when a node (or mark) becomes eligible to enter (§6.2).
export const TriggerSchema = z.discriminatedUnion('on', [
  z.object({ on: z.literal('start') }),
  z.object({ on: z.literal('cue'), id: z.string().min(1) }),
  z.object({ on: z.literal('after'), node: NodeIdSchema }),
  z.object({ on: z.literal('event'), node: NodeRefSchema, event: z.enum(['focus', 'select', 'answer']) }),
]);
export type Trigger = z.infer<typeof TriggerSchema>;

// Enter effects (§6.7). Named preset — exported so generators/capabilities
// derive from the same enum instead of duplicating the list.
export const EnterEffectsSchema = z.enum([
  'reveal', 'rise', 'pop', 'sweep', 'draw', 'stagger', 'none',
  'typewriter', 'words', 'chars', 'slam', 'wipe', 'scribble',
  'zoom', 'count-up', 'morph',
]);
export type EnterEffect = z.infer<typeof EnterEffectsSchema>;

// Enter animation, with trigger (cue-based entrance) and text splitting
export const EnterSchema = z.object({
  effect: EnterEffectsSchema,
  order: z.number().optional(),
  delay: z.number().optional(),
  duration: z.number().optional(),
  trigger: TriggerSchema.optional(),
  split: z.enum(['words', 'chars', 'lines']).optional(),
});
export type Enter = z.infer<typeof EnterSchema>;

// Emphasis animation
export const EmphasisSchema = z.object({
  effect: z.enum(['pulse', 'underline', 'glow', 'shake', 'bounce', 'wobble']),
  order: z.number().optional(),
  trigger: TriggerSchema.optional(),
});
export type Emphasis = z.infer<typeof EmphasisSchema>;

// Exit animation
export const ExitSchema = z.object({
  effect: z.enum(['fade', 'shrink', 'wipe-out', 'none']),
});
export type Exit = z.infer<typeof ExitSchema>;
