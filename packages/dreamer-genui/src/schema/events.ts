import { z } from 'zod';
import { AnswerValueSchema } from './question';
import { AssessmentStateSchema } from './assessment';

/**
 * Events the board reports to the host (§6.13). The library never decides
 * correctness and never makes network calls on its own.
 */

export const CoreUIEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('focus'),
    nodeId: z.string(),
    ref: z.string().optional(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal('select'),
    nodeId: z.string(),
    ref: z.string().optional(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal('answer'),
    nodeId: z.string(),
    value: AnswerValueSchema,
    meta: z
      .object({
        timeMs: z.number().nonnegative().optional(),
        attempt: z.number().int().positive().optional(),
        assessmentId: z.string().optional(),
        questionId: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('action'),
    nodeId: z.string().optional(),
    action: z.union([z.enum(['return', 'continue', 'hint', 'view']), z.string()]),
    detail: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('assessment'),
    assessmentId: z.string(),
    action: z.enum([
      'start',
      'submit',
      'flag',
      'unflag',
      'navigate',
      'pause',
      'resume',
      'warn',
      'timeout',
    ]),
    questionId: z.string().optional(),
    state: AssessmentStateSchema.optional(),
  }),
]);

/** Plugins may emit namespaced events (`vendor:event`) (§6.13). */
export const NamespacedUIEventSchema = z
  .object({
    type: z.string().min(3).regex(/^[a-z0-9-]+:[a-z0-9-]+$/),
  })
  .passthrough();

export const UIEventSchema = z.union([CoreUIEventSchema, NamespacedUIEventSchema]);

export type CoreUIEvent = z.infer<typeof CoreUIEventSchema>;
export type NamespacedUIEvent = z.infer<typeof NamespacedUIEventSchema>;
export type UIEvent = z.infer<typeof UIEventSchema>;
