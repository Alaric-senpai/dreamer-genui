import { z } from 'zod';
import { NodeRefSchema } from './common';
import { EaseNameSchema } from './motion';
import { ThemeSpecSchema } from './theme';

/**
 * Scene transition between boards (§6.18). `kind` is open so plugins can
 * register more through `defineTransition`; the built-in set is validated by
 * the transitions registry, and unknown names raise `transition-unknown`.
 * `theme` is applied at the midpoint, so a dark scene can flip to a light one.
 */
export const SceneTransitionSchema = z.object({
  kind: z.string().min(1).max(64),
  duration: z.number().min(0).max(10_000).optional(),
  ease: EaseNameSchema.optional(),
  direction: z.enum(['left', 'right', 'up', 'down']).optional(),
  /** For iris: where the circle opens from. */
  origin: z.union([NodeRefSchema, z.literal('center')]).optional(),
  theme: ThemeSpecSchema.optional(),
});
export type SceneTransition = z.infer<typeof SceneTransitionSchema>;

/** In-place text/node update transitions (§6.18). */
export const UpdateTransitionSchema = z.enum(['morph', 'fade', 'none']);
export type UpdateTransition = z.infer<typeof UpdateTransitionSchema>;
