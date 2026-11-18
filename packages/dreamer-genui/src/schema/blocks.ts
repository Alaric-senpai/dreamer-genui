import { z } from 'zod';
import { InlineSchema } from './inline';
import { FigureSchema } from './figures';
import { EnterSchema } from './motion';
import { GapSchema, RatioSchema, SlotSchema } from './layout';
import { NodeBaseSchema } from './node';
import { QuestionBlockSchema } from './question';
import { AssessmentBlockSchema } from './assessment';

// Re-export the shared node base for consumers that imported it from here.
export { NodeBaseSchema };
export type { NodeBase } from './node';
export type { Slot } from './layout';
export { SlotSchema };

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

export const ListBlockSchema = NodeBaseSchema.extend({
  type: z.literal('list'),
  style: z.enum(['bullet', 'number', 'check', 'none']),
  items: z.array(
    z.object({
      id: z.string().optional(),
      content: z.array(InlineSchema),
      enter: EnterSchema.optional(),
    }),
  ),
});

export const CompareBlockSchema = NodeBaseSchema.extend({
  type: z.literal('compare'),
  columns: z.array(
    z.object({
      id: z.string().min(1),
      title: z.array(InlineSchema),
      items: z.array(z.array(InlineSchema)),
    }),
  ),
  highlight: z
    .object({ col: z.string().optional(), row: z.number().int().nonnegative().optional() })
    .optional(),
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

export const FlashcardsBlockSchema = NodeBaseSchema.extend({
  type: z.literal('flashcards'),
  cards: z.array(
    z.object({
      id: z.string().min(1),
      front: z.array(InlineSchema),
      back: z.array(InlineSchema),
    }),
  ),
  flip: z.enum(['tap', 'auto']).optional(),
  rating: z.boolean().optional(),
});

// Group block — a real flex/grid vocabulary, still token-based (§6.4).
export const GroupBlockSchemaBase = NodeBaseSchema.extend({
  type: z.literal('group'),
  layout: z.enum(['stack', 'row', 'grid']),
  direction: z.enum(['row', 'column', 'row-reverse', 'column-reverse']).optional(),
  wrap: z.boolean().optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justify: z.enum(['start', 'center', 'end', 'between', 'around']).optional(),
  gap: GapSchema.optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  /** Auto-fit minimum item width, as a spacing token. */
  minItemWidth: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
  ratio: RatioSchema.optional(),
  reverseOnNarrow: z.boolean().optional(),
});

// BlockSchema must be declared before GroupBlockSchema for the forward-lazy reference.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let BlockSchema: z.ZodType<any>;

// GroupBlockSchema uses z.lazy(() => BlockSchema) for its blocks field.
export const GroupBlockSchema = GroupBlockSchemaBase.extend({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: z.array(z.lazy(() => BlockSchema as z.ZodType<any>)),
});

// ---------------------------------------------------------------------------
// Tutor-addressable UI-kit blocks (§6.19)
//
// These are registered by the default `ui-kit` plugin rather than by the core
// block plugin, but they validate statically like every other block so that
// ops can be checked before a registry exists. They nest arbitrary blocks.
// ---------------------------------------------------------------------------

const NestedBlocksSchema = z.array(z.lazy(() => BlockSchema as z.ZodType<any>));
const InlineListSchema = z.array(InlineSchema);

export const CardBlockSchema = NodeBaseSchema.extend({
  type: z.literal('card'),
  title: InlineListSchema.optional(),
  description: InlineListSchema.optional(),
  media: FigureSchema.optional(),
  blocks: NestedBlocksSchema,
  footer: NestedBlocksSchema.optional(),
  variant: z.enum(['plain', 'outlined', 'elevated', 'accent']).optional(),
  /** Whole-card tap emits `select` (`ref` = the card id). */
  interactive: z.boolean().optional(),
});

export const AlertBlockSchema = NodeBaseSchema.extend({
  type: z.literal('alert'),
  tone: z.enum(['info', 'success', 'warn', 'danger']),
  title: InlineListSchema.optional(),
  content: InlineListSchema,
  icon: z.string().optional(),
  dismissible: z.boolean().optional(),
});

export const AccordionItemSchema = z.object({
  id: z.string().min(1),
  title: InlineListSchema,
  blocks: NestedBlocksSchema,
  open: z.boolean().optional(),
});
export const AccordionBlockSchema = NodeBaseSchema.extend({
  type: z.literal('accordion'),
  items: z.array(AccordionItemSchema).min(1),
  multiple: z.boolean().optional(),
});

export const CollapsibleBlockSchema = NodeBaseSchema.extend({
  type: z.literal('collapsible'),
  title: InlineListSchema,
  blocks: NestedBlocksSchema,
  open: z.boolean().optional(),
});

export const TabsBlockSchema = NodeBaseSchema.extend({
  type: z.literal('tabs'),
  tabs: z.array(
    z.object({
      id: z.string().min(1),
      label: InlineListSchema,
      blocks: NestedBlocksSchema,
    }),
  ).min(1),
  active: z.string().optional(),
});

export const BadgeBlockSchema = NodeBaseSchema.extend({
  type: z.literal('badge'),
  text: InlineListSchema,
  tone: z.enum(['accent', 'info', 'success', 'warn', 'danger', 'muted']).optional(),
});

export const ProgressBlockSchema = NodeBaseSchema.extend({
  type: z.literal('progress'),
  value: z.number().min(0).max(100).optional(),
  label: z.string().optional(),
  variant: z.enum(['bar', 'ring', 'pill']).optional(),
});

export const CounterBlockSchema = NodeBaseSchema.extend({
  type: z.literal('counter'),
  value: z.number(),
  from: z.number().optional(),
  format: z.enum(['number', 'percent', 'time', 'currency']).optional(),
  label: z.string().optional(),
});

export const AvatarBlockSchema = NodeBaseSchema.extend({
  type: z.literal('avatar'),
  name: z.string().optional(),
  src: z.union([z.string(), z.object({ asset: z.string() })]).optional(),
  icon: z.string().optional(),
  size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
});

export const SeparatorBlockSchema = NodeBaseSchema.extend({
  type: z.literal('separator'),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  label: z.string().optional(),
});

export const CarouselBlockSchema = NodeBaseSchema.extend({
  type: z.literal('carousel'),
  slides: z.array(
    z.object({
      id: z.string().min(1),
      blocks: NestedBlocksSchema,
    }),
  ).min(1),
  auto: z.boolean().optional(),
});

export const KbdBlockSchema = NodeBaseSchema.extend({
  type: z.literal('kbd'),
  keys: z.array(z.string().min(1)).min(1),
});

/** UI-kit blocks (§6.19), registered by the default `ui-kit` plugin. */
export const UiKitBlockSchema = z.discriminatedUnion('type', [
  CardBlockSchema,
  AlertBlockSchema,
  AccordionBlockSchema,
  CollapsibleBlockSchema,
  TabsBlockSchema,
  BadgeBlockSchema,
  ProgressBlockSchema,
  CounterBlockSchema,
  AvatarBlockSchema,
  SeparatorBlockSchema,
  CarouselBlockSchema,
  KbdBlockSchema,
]);

// Core blocks are a discriminated union on `type`. Question is itself a
// discriminated union on `kind`, and assessment is a single object, so the
// public BlockSchema is their union. A `switch (block.type)` still narrows.
export const CoreBlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  FigureBlockSchema,
  ChoicesBlockSchema,
  StepsBlockSchema,
  CalloutBlockSchema,
  GroupBlockSchema,
  TableBlockSchema,
  MathBlockSchema,
  CodeBlockSchema,
  ListBlockSchema,
  CompareBlockSchema,
  FlashcardsBlockSchema,
]);

BlockSchema = z.union([CoreBlockSchema, UiKitBlockSchema, QuestionBlockSchema, AssessmentBlockSchema]);

export { BlockSchema };
export type CoreBlock = z.infer<typeof CoreBlockSchema>;
export type UiKitBlock = z.infer<typeof UiKitBlockSchema>;
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
export type ListBlock = z.infer<typeof ListBlockSchema>;
export type CompareBlock = z.infer<typeof CompareBlockSchema>;
export type FlashcardsBlock = z.infer<typeof FlashcardsBlockSchema>;
export type GroupBlock = z.infer<typeof GroupBlockSchema>;
export type CardBlock = z.infer<typeof CardBlockSchema>;
export type AlertBlock = z.infer<typeof AlertBlockSchema>;
export type AccordionBlock = z.infer<typeof AccordionBlockSchema>;
export type CollapsibleBlock = z.infer<typeof CollapsibleBlockSchema>;
export type TabsBlock = z.infer<typeof TabsBlockSchema>;
export type BadgeBlock = z.infer<typeof BadgeBlockSchema>;
export type ProgressBlock = z.infer<typeof ProgressBlockSchema>;
export type CounterBlock = z.infer<typeof CounterBlockSchema>;
export type AvatarBlock = z.infer<typeof AvatarBlockSchema>;
export type SeparatorBlock = z.infer<typeof SeparatorBlockSchema>;
export type CarouselBlock = z.infer<typeof CarouselBlockSchema>;
export type KbdBlock = z.infer<typeof KbdBlockSchema>;

// Convenience guards for code that needs the core subset.
export function isQuestionBlock(block: Block): block is z.infer<typeof QuestionBlockSchema> {
  return block.type === 'question';
}
export function isAssessmentBlock(block: Block): block is z.infer<typeof AssessmentBlockSchema> {
  return block.type === 'assessment';
}
