import { z } from 'zod';
import { NodeBaseSchema } from './node';
import { InlineSchema } from './inline';
import { QuestionBlockSchema } from './question';

/**
 * The `assessment` shell (§6.8): modes, timer, navigator, local-first state.
 * M4b ships the schema and the headless state machine; the shell UI arrives in
 * M6b.
 */

export const AssessmentModeSchema = z.enum(['practice', 'quiz', 'exam', 'review']);
export type AssessmentMode = z.infer<typeof AssessmentModeSchema>;

export const AssessmentTimerSchema = z.union([
  z.object({
    kind: z.literal('countdown'),
    seconds: z.number().int().positive().max(24 * 60 * 60),
    warnAtSeconds: z.array(z.number().int().nonnegative()).optional(),
  }),
  z.object({ kind: z.literal('elapsed') }),
]);
export type AssessmentTimer = z.infer<typeof AssessmentTimerSchema>;

export const AssessmentSectionSchema = z.object({
  id: z.string().min(1),
  title: z.array(InlineSchema).optional(),
  instructions: z.array(InlineSchema).optional(),
  questions: z.array(QuestionBlockSchema).min(1),
});
export type AssessmentSection = z.infer<typeof AssessmentSectionSchema>;

export const AssessmentBlockSchema = NodeBaseSchema.extend({
  type: z.literal('assessment'),
  mode: AssessmentModeSchema,
  title: z.array(InlineSchema).optional(),
  instructions: z.array(InlineSchema).optional(),
  timer: AssessmentTimerSchema.optional(),
  sections: z.array(AssessmentSectionSchema).min(1),
  navigation: z.enum(['free', 'linear', 'locked-after-answer']).optional(),
  /** Deterministic shuffle (seeded) — never random at render time. */
  shuffle: z
    .object({
      questions: z.boolean().optional(),
      options: z.boolean().optional(),
      seed: z.string().optional(),
    })
    .optional(),
  totalMarks: z.number().nonnegative().optional(),
  allowFlag: z.boolean().optional(),
  submit: z.object({ confirm: z.boolean().optional() }).optional(),
  /** Supplied by the host via `update` in review mode. */
  result: z
    .object({
      awarded: z.number().optional(),
      total: z.number().optional(),
      summary: z.array(InlineSchema).optional(),
    })
    .optional(),
});
export type AssessmentBlock = z.infer<typeof AssessmentBlockSchema>;

/** Serializable local-first state (§6.8). */
export const AssessmentStateSchema = z.object({
  id: z.string().min(1),
  mode: AssessmentModeSchema,
  answers: z.record(z.string(), z.unknown()),
  flags: z.array(z.string()),
  visited: z.array(z.string()),
  currentQuestionId: z.string().optional(),
  timerRemainingMs: z.number().nonnegative().optional(),
  startedAt: z.number().optional(),
  submittedAt: z.number().optional(),
});
export type AssessmentState = z.infer<typeof AssessmentStateSchema>;
