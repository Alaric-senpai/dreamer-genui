import { z } from 'zod';
import { BlockSchema } from './blocks';
import type { Block } from './blocks';
import { NodeIdSchema } from './common';
import { EaseNameSchema, TriggerSchema } from './motion';
import { ThemeSpecSchema } from './theme';
import type { ThemeSpec } from './theme';
import { LayoutSpecSchema, LayoutTransitionSchema, SlotSchema } from './layout';

// Op: append
export const AppendOpSchema = z.object({
  op: z.literal('append'),
  blocks: z.array(BlockSchema),
  after: NodeIdSchema.optional(),
  /** Claim a region in the current layout (§6.4). */
  slot: SlotSchema.optional(),
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
  /** New board layout; history snapshots keep theirs (§6.4). */
  layout: LayoutSpecSchema.optional(),
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

// Op: theme — tutor-driven mood/theme change (§6.10).
export const ThemeOpSchema = z.object({
  op: z.literal('theme'),
  theme: ThemeSpecSchema,
  scope: z.enum(['board', 'detour']).optional().default('board'),
});
export type ThemeOp = z.infer<typeof ThemeOpSchema>;

/**
 * One virtual-camera move (§6.12). Presentation-only. `to` frames a node or
 * the overview; pan is the consequence of framing, not a raw offset. Bounds:
 * zoom 0.5–2 in the schema (the renderer clamps to 1–1.6), tilt ±15°, dolly
 * −3..3 normalized units.
 */
export const CameraMoveSchema = z.object({
  to: z.union([z.literal('overview'), z.string().min(1)]).optional(),
  preset: z.enum(['overview', 'closeup', 'wide']).optional(),
  zoom: z.number().min(0.5).max(2).optional(),
  tilt: z
    .object({
      x: z.number().min(-15).max(15).optional(),
      y: z.number().min(-15).max(15).optional(),
    })
    .optional(),
  dolly: z.union([z.enum(['in', 'out']), z.number().min(-3).max(3)]).optional(),
  duration: z.number().min(0).max(10_000).optional(),
  ease: EaseNameSchema.optional(),
  /** Camera moves can be cue-synced like any other enter (§6.12). */
  trigger: TriggerSchema.optional(),
});
export type CameraMove = z.infer<typeof CameraMoveSchema>;

/**
 * Op: camera. Either a single move or a guided `path`. The two protocol forms
 * are represented as one object with an optional `path` so the op union keeps
 * a single `camera` discriminant; a path supersedes the top-level move.
 */
export const CameraOpSchema = CameraMoveSchema.extend({
  op: z.literal('camera'),
  path: z.array(CameraMoveSchema).min(1).max(24).optional(),
});
export type CameraOp = z.infer<typeof CameraOpSchema>;
export type CameraTarget = NonNullable<CameraMove['to']>;

// Op: layout — compose the board, animate the re-flow (§6.4).
export const LayoutOpSchema = z.object({
  op: z.literal('layout'),
  layout: LayoutSpecSchema,
  transition: LayoutTransitionSchema.optional(),
});
export type LayoutOp = z.infer<typeof LayoutOpSchema>;

// All ops discriminated union
export const OpSchema = z.discriminatedUnion('op', [
  AppendOpSchema,
  AttachOpSchema,
  ReplaceOpSchema,
  UpdateOpSchema,
  RemoveOpSchema,
  ThemeOpSchema,
  CameraOpSchema,
  LayoutOpSchema,
]);
export type Op = z.infer<typeof OpSchema>;
