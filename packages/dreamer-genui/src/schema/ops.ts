import { z } from 'zod';
import { BlockSchema } from './blocks';
import type { Block } from './blocks';
import { NodeIdSchema } from './common';
import { MotionFieldsSchema } from './motion';

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
});
export type AttachOp = z.infer<typeof AttachOpSchema>;

// Op: replace
export const ReplaceOpSchema = z.object({
  op: z.literal('replace'),
  blocks: z.array(BlockSchema),
  title: z.string().optional(),
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

// All ops discriminated union
export const OpSchema = z.discriminatedUnion('op', [
  AppendOpSchema,
  AttachOpSchema,
  ReplaceOpSchema,
  UpdateOpSchema,
  RemoveOpSchema,
]);
export type Op = z.infer<typeof OpSchema>;
