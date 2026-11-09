import { z } from 'zod';
import { ColorTokenSchema, MotionFieldsSchema, EnterSchema } from './motion';

// Forward declare InlineSchema for recursive Mark definitions
const InlineSchemaRef = z.lazy(() => InlineSchema);

// Per-mark optional full enter spec (§6.2: marks may carry `enter` with
// triggers, e.g. "circle this phrase when the narrator says it"). The flat
// MotionFields stay for order/delay/duration tuning without an effect.
const MarkEnterSchema = z.object({ enter: EnterSchema.optional() });

// Mark discriminated union
export const MarkSchema = z.discriminatedUnion('mark', [
  z.object({
    mark: z.literal('highlight'),
    text: z.union([z.string(), z.array(z.string())]),
    color: ColorTokenSchema.optional(),
    ...MotionFieldsSchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('emphasis'),
    text: z.union([z.string(), z.array(z.string())]),
    ...MotionFieldsSchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('term'),
    text: z.string(),
    definition: z.string(),
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('focusable'),
    text: z.union([z.string(), z.array(z.string())]),
    ref: z.string(),
    ...MotionFieldsSchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('annotate'),
    text: z.union([z.string(), z.array(z.string())]),
    kind: z.enum(['circle', 'underline', 'box', 'bracket', 'strike']),
    color: ColorTokenSchema.optional(),
    ...MotionFieldsSchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('math'),
    tex: z.string(),
    ...MarkEnterSchema.shape,
  }),
]);

export type Mark = z.infer<typeof MarkSchema>;

// Inline = string | Mark
export const InlineSchema: z.ZodType<Inline> = z.union([z.string(), MarkSchema]);
export type Inline = string | Mark;
