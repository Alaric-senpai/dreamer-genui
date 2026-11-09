import { z } from 'zod';
import { BlockSchema } from './blocks';
import type { Block } from './blocks';
import { NodeIdSchema } from './common';
import { EaseNameSchema } from './motion';
import { ThemeSpecSchema } from './theme';
import type { ThemeSpec } from './theme';

// Op: append
export const AppendOpSchema = z.object({
  op: z.literal('append'),
  blocks: z.array(BlockSchema),
  after: NodeIdSchema.optional(),
});
export type AppendOp = z.infer<typeof AppendOpSchema>;

// Op: attach
export const AttachOpSchema = z.object({
  op: z.literal('attach'),
  to: z.string(), // NodeRef
  blocks: z.array(BlockSchema),
  placement: z.enum(['right', 'left', 'above', 'below', 'overlay', 'inline']).optional().default('inline'),
  connector: z.enum(['line', 'arrow', 'bracket', 'none']).optional().default('none'),
  target: z.object({
    annotate: z.enum(['circle', 'underline', 'box', 'highlight', 'bracket', 'none']).optional(),
  }).optional(),
  mode: z.enum(['inline', 'drawer', 'spotlight']).optional().default('inline'),
  /** Optional theme scoped to the detour; reverts on `return`. */
  theme: ThemeSpecSchema.optional(),
});
export type AttachOp = z.infer<typeof AttachOpSchema>;

// Op: replace
export const ReplaceOpSchema = z.object({
  op: z.literal('replace'),
  blocks: z.array(BlockSchema),
  title: z.string().optional(),
  /** New board theme; `back()` restores the previous board's theme. */
  theme: ThemeSpecSchema.optional(),
});
export type ReplaceOp = z.infer<typeof ReplaceOpSchema>;

// Op: update
export const UpdateOpSchema = z.object({
  op: z.literal('update'),
  id: NodeIdSchema,
  props: z.record(z.unknown()),
});
export type UpdateOp = z.infer<typeof UpdateOpSchema>;

// Op: remove
export const RemoveOpSchema = z.object({
  op: z.literal('remove'),
  id: NodeIdSchema,
});
export type RemoveOp = z.infer<typeof RemoveOpSchema>;

// Op: theme — tutor-driven mood/theme change (§6.8).
export const ThemeOpSchema = z.object({
  op: z.literal('theme'),
  theme: ThemeSpecSchema,
  scope: z.enum(['board', 'detour']).optional().default('board'),
});
export type ThemeOp = z.infer<typeof ThemeOpSchema>;

// Op: camera — explicit virtual-camera move (§6.10). Presentation-only:
// validated here, executed by the renderer, not reduced into board state.
export const CameraOpSchema = z.object({
  op: z.literal('camera'),
  to: z.union([z.literal('overview'), z.string().min(1)]),
  zoom: z.number().min(0.5).max(2).optional(),
  duration: z.number().min(0).max(10_000).optional(),
  ease: EaseNameSchema.optional(),
});
export type CameraOp = z.infer<typeof CameraOpSchema>;
export type CameraTarget = z.infer<typeof CameraOpSchema>['to'];

// All ops discriminated union
export const OpSchema = z.discriminatedUnion('op', [
  AppendOpSchema,
  AttachOpSchema,
  ReplaceOpSchema,
  UpdateOpSchema,
  RemoveOpSchema,
  ThemeOpSchema,
  CameraOpSchema,
]);
export type Op = z.infer<typeof OpSchema>;
