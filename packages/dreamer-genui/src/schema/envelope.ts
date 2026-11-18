import { z } from 'zod';
import { OpSchema } from './ops';
import { BeatSchema } from './narration';
import { UIEventSchema } from './events';

export const VersionSchema = z.literal(1);
export type Version = z.infer<typeof VersionSchema>;

/**
 * A lesson turn (§6.17): the tutor's structured answer carrying narration
 * beats and ops together. `ReplySchema` remains the alias hosts already use;
 * `LessonTurn` is the v3 name.
 */
export const ReplySchema = z.object({
  v: VersionSchema,
  ops: z.array(OpSchema),
  /** Spoken beats. Beat ids are cue ids; inline `[[cue:id]]` markers also fire. */
  narration: z.array(BeatSchema).optional(),
  meta: z.record(z.unknown()).optional(),
});
export type Reply = z.infer<typeof ReplySchema>;
export type LessonTurn = Reply;

/** What the host sends to the tutor for each student action (§6.17). */
export const StudentTurnSchema = z.object({
  v: VersionSchema,
  input: z.object({
    kind: z.enum(['text', 'voice', 'event']),
    text: z.string().optional(),
    event: UIEventSchema.optional(),
    lang: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  /** `serializeBoard(state)` output — shape owned by the core generator. */
  board: z.unknown(),
  /** `getCapabilities(registry)` output — shape owned by the core generator. */
  capabilities: z.unknown(),
  /** What the student actually heard, for interruption/mid-beat turns. */
  narration: z
    .object({
      spokenUpTo: z.string().optional(),
      interrupted: z.boolean().optional(),
    })
    .optional(),
  /** Optional host-injected model summaries (§6.16). */
  models: z.array(z.unknown()).optional(),
  assessment: z
    .object({
      id: z.string().min(1),
      mode: z.string().min(1),
      answered: z.number().int().min(0),
      flagged: z.number().int().min(0),
    })
    .optional(),
  locale: z.string().optional(),
});
export type StudentTurn = z.infer<typeof StudentTurnSchema>;

/**
 * A turn may arrive partially while streaming (§6.17). Validation helpers use
 * this tolerant shape and only enforce complete beats/ops at the end.
 */
export const PartialLessonTurnSchema = z.object({
  v: VersionSchema.optional(),
  ops: z.array(z.unknown()).optional(),
  narration: z.array(z.unknown()).optional(),
  meta: z.record(z.unknown()).optional(),
});
export type PartialLessonTurn = z.infer<typeof PartialLessonTurnSchema>;
