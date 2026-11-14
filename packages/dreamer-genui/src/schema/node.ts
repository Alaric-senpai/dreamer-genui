import { z } from 'zod';
import { EnterSchema, EmphasisSchema, ExitSchema } from './motion';
import { SlotSchema } from './layout';

/**
 * Fields shared by every node (§6.2). Lives in its own module so question and
 * assessment schemas can extend it without a circular import through the
 * block union.
 */
export const NodeBaseSchema = z.object({
  id: z.string().min(1).max(64),
  enter: EnterSchema.optional(),
  emphasis: EmphasisSchema.optional(),
  exit: ExitSchema.optional(),
  /** Plain-text fallback. Required for figure kinds and plugin nodes. */
  alt: z.string().optional(),

  // Placement (v2.1): all optional, token/enum based, never raw CSS.
  slot: SlotSchema.optional(),
  span: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal('full')]).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justify: z.enum(['start', 'center', 'end', 'between']).optional(),
  size: z.enum(['auto', 'sm', 'md', 'lg', 'fill']).optional(),
  /** Reserve layout space before the node's trigger fires (default false). */
  reserve: z.boolean().optional(),
});
export type NodeBase = z.infer<typeof NodeBaseSchema>;
