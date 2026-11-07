import { z } from 'zod';
import { ColorTokenSchema, MotionFieldsSchema } from './motion';

// Forward declare InlineSchema for recursive Mark definitions
const InlineSchemaRef = z.lazy(() => InlineSchema);

// Mark discriminated union
export const MarkSchema = z.discriminatedUnion('mark', [
  z.object({
    mark: z.literal('highlight'),
    text: z.union([z.string(), z.array(z.string())]),
    color: ColorTokenSchema.optional(),
    ...MotionFieldsSchema.shape,
  }),
  z.object({
    mark: z.literal('emphasis'),
    text: z.union([z.string(), z.array(z.string())]),
    ...MotionFieldsSchema.shape,
  }),
  z.object({
    mark: z.literal('term'),
    text: z.string(),
    definition: z.string(),
  }),
  z.object({
    mark: z.literal('focusable'),
    text: z.union([z.string(), z.array(z.string())]),
    ref: z.string(),
    ...MotionFieldsSchema.shape,
  }),
  z.object({
    mark: z.literal('annotate'),
    text: z.union([z.string(), z.array(z.string())]),
    kind: z.enum(['circle', 'underline', 'box', 'bracket', 'strike']),
    color: ColorTokenSchema.optional(),
    ...MotionFieldsSchema.shape,
  }),
  z.object({
    mark: z.literal('math'),
    tex: z.string(),
  }),
]);

export type Mark = z.infer<typeof MarkSchema>;

// Inline = string | Mark
export const InlineSchema: z.ZodType<Inline> = z.union([z.string(), MarkSchema]);
export type Inline = string | Mark;
