import { z } from 'zod';
import { EaseNameSchema } from './motion';

/**
 * Board-level layout vocabulary (§6.4). The tutor names a composition; the
 * library owns geometry. No coordinates and no CSS ever come from the model.
 */

export const GapSchema = z.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl']);
export type Gap = z.infer<typeof GapSchema>;

export const RatioSchema = z.enum(['1:1', '2:1', '1:2', '3:2', '2:3']);
export type Ratio = z.infer<typeof RatioSchema>;

/** Regions a node may claim via `slot`. `left`/`right` mirror under RTL. */
export const SlotSchema = z.enum(['left', 'right', 'top', 'bottom', 'center']);
export type Slot = z.infer<typeof SlotSchema>;

export const FlowLayoutSchema = z.object({
  kind: z.literal('flow'),
  gap: GapSchema.optional(),
  align: z.enum(['start', 'center']).optional(),
});

export const SplitLayoutSchema = z.object({
  kind: z.literal('split'),
  sides: z.enum(['left-right', 'right-left']).optional(),
  ratio: RatioSchema.optional(),
  gap: GapSchema.optional(),
  narrow: z.enum(['stack', 'tabs']).optional(),
  narrowOrder: z.enum(['left-first', 'right-first']).optional(),
  pin: z.enum(['left', 'right', 'none']).optional(),
});

export const GridLayoutSchema = z.object({
  kind: z.literal('grid'),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  gap: GapSchema.optional(),
  narrowColumns: z.union([z.literal(1), z.literal(2)]).optional(),
});

export const StageLayoutSchema = z.object({
  kind: z.literal('stage'),
  regions: z
    .array(z.enum(['top', 'left', 'center', 'right', 'bottom']))
    .optional(),
  narrow: z.enum(['stack']).optional(),
});

export const LayoutSpecSchema = z.discriminatedUnion('kind', [
  FlowLayoutSchema,
  SplitLayoutSchema,
  GridLayoutSchema,
  StageLayoutSchema,
]);
export type LayoutSpec = z.infer<typeof LayoutSpecSchema>;
export type LayoutKind = LayoutSpec['kind'];

/** Animated re-flow settings for the `layout` op (§6.4). */
export const LayoutTransitionSchema = z.object({
  duration: z.number().min(0).max(10_000).optional(),
  ease: EaseNameSchema.optional(),
});
export type LayoutTransition = z.infer<typeof LayoutTransitionSchema>;
