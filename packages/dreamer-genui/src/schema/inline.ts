import { z } from 'zod';
import { ColorTokenSchema, MotionFieldsSchema, EnterSchema } from './motion';
import type { ColorToken, Enter, MotionFields } from './motion';

/** Motion fields shared by every mark, plus keyed-morph identity (§6.18). */
export interface MarkMotion extends MotionFields {
  enter?: Enter;
  /** Stable identity across a keyed text morph (§6.18). */
  key?: string;
}

export type Inline = string | Mark;

export interface HighlightMark extends MarkMotion {
  mark: 'highlight';
  text: string | string[];
  color?: ColorToken;
}
export interface EmphasisMark extends MarkMotion {
  mark: 'emphasis';
  text: string | string[];
}
export interface TermMark extends MarkMotion {
  mark: 'term';
  text: string;
  definition: string;
  /** Optional richer explanation rendered by the UI kit term primitive (§6.19). */
  detail?: Inline[];
}
export interface FocusableMark extends MarkMotion {
  mark: 'focusable';
  text: string | string[];
  ref: string;
}
export interface AnnotateMark extends MarkMotion {
  mark: 'annotate';
  text: string | string[];
  kind: 'circle' | 'underline' | 'box' | 'bracket' | 'strike';
  color?: ColorToken;
}
export interface MathMark extends MarkMotion {
  mark: 'math';
  tex: string;
}
export interface BlankMark extends MarkMotion {
  mark: 'blank';
  id: string;
  options?: string[];
  width?: 'sm' | 'md' | 'lg';
}

export type Mark =
  | HighlightMark
  | EmphasisMark
  | TermMark
  | FocusableMark
  | AnnotateMark
  | MathMark
  | BlankMark;

// Forward declaration for the recursive `term.detail` field. The explicit
// `ZodType<Inline>` annotation breaks the inference cycle.
const InlineSchemaRef: z.ZodType<Inline> = z.lazy(() => InlineSchema);

// Per-mark optional full enter spec (§6.2: marks may carry `enter` with
// triggers, e.g. "circle this phrase when the narrator says it"). The flat
// MotionFields stay for order/delay/duration tuning without an effect.
const MarkEnterSchema = z.object({ enter: EnterSchema.optional() });

// Stable identity for keyed text morphs (§6.18). Marks with the same key across
// an `update` animate from their old position/style to the new one.
const MarkKeySchema = z.object({ key: z.string().min(1).max(64).optional() });

// Mark discriminated union
const MarkUnionSchema = z.discriminatedUnion('mark', [
  z.object({
    mark: z.literal('highlight'),
    text: z.union([z.string(), z.array(z.string())]),
    color: ColorTokenSchema.optional(),
    ...MotionFieldsSchema.shape,
    ...MarkKeySchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('emphasis'),
    text: z.union([z.string(), z.array(z.string())]),
    ...MotionFieldsSchema.shape,
    ...MarkKeySchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('term'),
    text: z.string(),
    definition: z.string(),
    detail: z.array(InlineSchemaRef).optional(),
    ...MarkKeySchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('focusable'),
    text: z.union([z.string(), z.array(z.string())]),
    ref: z.string(),
    ...MotionFieldsSchema.shape,
    ...MarkKeySchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('annotate'),
    text: z.union([z.string(), z.array(z.string())]),
    kind: z.enum(['circle', 'underline', 'box', 'bracket', 'strike']),
    color: ColorTokenSchema.optional(),
    ...MotionFieldsSchema.shape,
    ...MarkKeySchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    mark: z.literal('math'),
    tex: z.string(),
    ...MarkKeySchema.shape,
    ...MarkEnterSchema.shape,
  }),
  z.object({
    /** Cloze blank. Valid only inside a `cloze` question (core validates). */
    mark: z.literal('blank'),
    id: z.string().min(1),
    options: z.array(z.string()).optional(),
    width: z.enum(['sm', 'md', 'lg']).optional(),
    ...MarkKeySchema.shape,
    ...MarkEnterSchema.shape,
  }),
]);

// The public schema is annotated with the hand-written recursive type so
// `term.detail` can itself contain marks without an `any` in the API.
export const MarkSchema: z.ZodType<Mark> = MarkUnionSchema;

// Inline = string | Mark
export const InlineSchema: z.ZodType<Inline> = z.union([z.string(), MarkSchema]);
