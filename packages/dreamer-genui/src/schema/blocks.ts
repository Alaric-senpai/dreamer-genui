import { z } from 'zod';
import { InlineSchema } from './inline';
import { FigureSchema } from './figures';
import { EnterSchema, EmphasisSchema, ExitSchema } from './motion';

// NodeBase
export const NodeBaseSchema = z.object({
  id: z.string().min(1).max(64),
  enter: EnterSchema.optional(),
  emphasis: EmphasisSchema.optional(),
  exit: ExitSchema.optional(),
  alt: z.string().optional(),
});
export type NodeBase = z.infer<typeof NodeBaseSchema>;

// Block variants (all defined before the recursive union)
export const TextBlockSchema = NodeBaseSchema.extend({
  type: z.literal('text'),
  // `hero` is a large screen-owning statement, `kicker` a lead-in label,
  // `quote` a styled quotation — used sparingly (prompt guide guidance).
  variant: z.enum(['body', 'definition', 'heading', 'note', 'hero', 'kicker', 'quote']),
  content: z.array(InlineSchema),
});

export const FigureBlockSchema = NodeBaseSchema.extend({
  type: z.literal('figure'),
  figure: FigureSchema,
  caption: z.array(InlineSchema).optional(),
});

export const ChoicesItemSchema = z.object({
  id: z.string(), label: z.string(), caption: z.string().optional(),
  icon: z.string().optional(), ref: z.string().optional(),
});
export const ChoicesBlockSchema = NodeBaseSchema.extend({
  type: z.literal('choices'),
  prompt: z.array(InlineSchema).optional(),
  layout: z.enum(['chips', 'list', 'grid']),
  intent: z.enum(['navigate', 'answer']),
  multi: z.boolean().optional(),
  items: z.array(ChoicesItemSchema),
});

export const StepsItemSchema = z.object({
  id: z.string(), title: z.string(), content: z.array(InlineSchema),
  /** Each step may carry its own enter/trigger (§6.4). */
  enter: EnterSchema.optional(),
});
export const StepsBlockSchema = NodeBaseSchema.extend({
  type: z.literal('steps'),
  reveal: z.enum(['sequential', 'all']),
  items: z.array(StepsItemSchema),
});

export const CalloutBlockSchema = NodeBaseSchema.extend({
  type: z.literal('callout'),
  tone: z.enum(['info', 'success', 'warn', 'danger']),
  title: z.string().optional(),
  content: z.array(InlineSchema),
});

export const TableBlockSchema = NodeBaseSchema.extend({
  type: z.literal('table'),
  columns: z.array(z.object({ id: z.string(), label: z.string() })),
  rows: z.array(z.record(z.string(), z.array(InlineSchema))),
  highlight: z.object({
    rows: z.array(z.number()).optional(),
    cols: z.array(z.string()).optional(),
  }).optional(),
});

export const MathBlockSchema = NodeBaseSchema.extend({
  type: z.literal('math'),
  tex: z.string(),
  display: z.boolean().optional(),
});

export const CodeBlockSchema = NodeBaseSchema.extend({
  type: z.literal('code'),
  lang: z.string(),
  source: z.string(),
});

// Group block — defined without the blocks field first, then extended
export const GroupBlockSchemaBase = NodeBaseSchema.extend({
  type: z.literal('group'),
  layout: z.enum(['stack', 'row', 'grid']),
});

// BlockSchema must be declared before GroupBlockSchema for the forward-lazy reference
// Use a placeholder that is immediately replaced
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let BlockSchema: z.ZodType<any>;

// GroupBlockSchema uses z.lazy(() => BlockSchema) for its blocks field
// The explicit type annotation breaks TypeScript's circular inference
export const GroupBlockSchema = GroupBlockSchemaBase.extend({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: z.array(z.lazy(() => BlockSchema as z.ZodType<any>)),
});

// Now define the real BlockSchema as the discriminated union
// The `as z.ZodType<any>` cast is safe: runtime validation uses the real schema,
// only TS type-checking is affected by the cast
BlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  FigureBlockSchema,
  ChoicesBlockSchema,
  StepsBlockSchema,
  CalloutBlockSchema,
  GroupBlockSchema,
  TableBlockSchema,
  MathBlockSchema,
  CodeBlockSchema,
]) as z.ZodType<any>;

export { BlockSchema };
export type Block = z.infer<typeof BlockSchema>;
// Per-type inferred aliases (used by the React layer and consumers)
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type FigureBlock = z.infer<typeof FigureBlockSchema>;
export type ChoicesBlock = z.infer<typeof ChoicesBlockSchema>;
export type StepsBlock = z.infer<typeof StepsBlockSchema>;
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;
export type TableBlock = z.infer<typeof TableBlockSchema>;
export type MathBlock = z.infer<typeof MathBlockSchema>;
export type CodeBlock = z.infer<typeof CodeBlockSchema>;
export type GroupBlock = z.infer<typeof GroupBlockSchema>;
