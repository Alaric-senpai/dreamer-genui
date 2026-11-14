import { z } from 'zod';
import { NodeBaseSchema } from './node';
import { InlineSchema } from './inline';
import { FigureSchema } from './figures';

/**
 * The `question` block and its kinds (§6.8). Widgets arrive in M6b; M4b ships
 * the protocol and the validation rules.
 *
 * Answer keys are never part of exam/quiz payloads. A `key` field exists only
 * to support opt-in practice checking and is rejected by the core validator in
 * exam/quiz mode (`key-in-exam`).
 */

export const QuestionStatusSchema = z.enum([
  'pending',
  'answered',
  'correct',
  'incorrect',
  'partial',
  'revealed',
  'locked',
]);
export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

export const QuestionFeedbackSchema = z.object({
  message: z.array(InlineSchema).optional(),
  explanation: z.array(InlineSchema).optional(),
  awarded: z.number().optional(),
  correct: z.unknown().optional(),
});
export type QuestionFeedback = z.infer<typeof QuestionFeedbackSchema>;

const OptionSchema = z.object({ id: z.string().min(1), label: z.array(InlineSchema) });
const MatchItemSchema = z.object({ id: z.string().min(1), label: z.array(InlineSchema) });

const QuestionBaseSchema = NodeBaseSchema.extend({
  type: z.literal('question'),
  prompt: z.array(InlineSchema),
  marks: z.number().nonnegative().optional(),
  /** Hint ladder; revealed by the `hint` action, disabled in exam mode. */
  hints: z.array(z.array(InlineSchema)).optional(),
  status: QuestionStatusSchema.optional(),
  feedback: QuestionFeedbackSchema.optional(),
  /** Practice-only instant check. Rejected in exam/quiz payloads. */
  key: z.unknown().optional(),
});

function questionVariant<T extends z.ZodRawShape>(shape: T) {
  return QuestionBaseSchema.extend(shape);
}

export const QuestionBlockSchema = z.discriminatedUnion('kind', [
  questionVariant({
    kind: z.literal('mcq'),
    options: z.array(OptionSchema).min(1),
    multi: z.boolean().optional(),
    shuffle: z.boolean().optional(),
  }),
  questionVariant({ kind: z.literal('truefalse') }),
  questionVariant({
    kind: z.literal('short'),
    placeholder: z.string().optional(),
    maxLength: z.number().int().positive().max(10_000).optional(),
  }),
  questionVariant({
    kind: z.literal('numeric'),
    unit: z.string().optional(),
    step: z.number().positive().optional(),
  }),
  questionVariant({
    kind: z.literal('cloze'),
    /** Contains `{ mark: "blank" }` marks. */
    content: z.array(InlineSchema),
  }),
  questionVariant({
    kind: z.literal('matching'),
    left: z.array(MatchItemSchema).min(1),
    right: z.array(MatchItemSchema).min(1),
  }),
  questionVariant({
    kind: z.literal('ordering'),
    items: z.array(MatchItemSchema).min(2),
  }),
  questionVariant({
    kind: z.literal('hotspot'),
    figure: FigureSchema,
  }),
  questionVariant({
    kind: z.literal('labelDiagram'),
    figure: FigureSchema,
    labels: z.array(z.object({ id: z.string().min(1), text: z.array(InlineSchema) })).min(1),
  }),
  questionVariant({
    kind: z.literal('extended'),
    minWords: z.number().int().nonnegative().optional(),
    maxWords: z.number().int().positive().optional(),
  }),
]);
export type QuestionBlock = z.infer<typeof QuestionBlockSchema>;
export type QuestionKind = QuestionBlock['kind'];

/** Value emitted with an `answer` event, per kind (§6.8). */
export const AnswerValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.number(),
  z.array(z.string()),
  z.record(z.string(), z.string()),
]);
export type AnswerValue = z.infer<typeof AnswerValueSchema>;
