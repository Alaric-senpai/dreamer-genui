import { z } from 'zod';
import { EnterSchema } from './motion';
import { InlineSchema } from './inline';
import { Model3DFigureSchema, Scene3DFigureSchema } from './model';

// --- Figure kinds ---

// image
const ImageFigureSchema = z.object({
  kind: z.literal('image'),
  src: z.union([z.string(), z.object({ asset: z.string() })]),
  alt: z.string(),
});

// icon
const IconFigureSchema = z.object({
  kind: z.literal('icon'),
  name: z.string(),
  alt: z.string().optional(),
});

// diagram — "flow" was removed in v2.1; processes use the `flowchart` kind.
const DiagramLabelSchema = z.union([z.string(), z.array(InlineSchema)]);
const DiagramFigureSchema = z.object({
  kind: z.literal('diagram'),
  layout: z.enum(['tree', 'radial', 'cycle', 'orbit']),
  direction: z.enum(['down', 'right']).optional(),
  root: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    label: DiagramLabelSchema,
    icon: z.string().optional(),
    note: z.string().optional(),
    enter: EnterSchema.optional(),
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
  })),
  reveal: z.enum(['sequential', 'all']).optional(),
  focusable: z.boolean().optional(),
  alt: z.string(),
});

// flowchart (v2.1) — layered process with decisions, loops, inputs/outputs.
const FlowchartNodeSchema = z.object({
  id: z.string().min(1),
  label: z.array(InlineSchema),
  detail: z.array(InlineSchema).optional(),
  shape: z.enum(['step', 'start', 'end', 'decision', 'io', 'substance', 'note']).optional(),
  lane: z.string().optional(),
  icon: z.string().optional(),
  enter: EnterSchema.optional(),
});
const FlowchartEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.array(InlineSchema).optional(),
  kind: z.enum(['flow', 'branch', 'recycle', 'optional']).optional(),
});
export const FlowchartFigureSchema = z.object({
  kind: z.literal('flowchart'),
  direction: z.enum(['down', 'right']).optional(),
  nodes: z.array(FlowchartNodeSchema).min(1).max(64),
  edges: z.array(FlowchartEdgeSchema),
  inputs: z.array(z.object({ to: z.string().min(1), label: z.array(InlineSchema) })).optional(),
  outputs: z.array(z.object({ from: z.string().min(1), label: z.array(InlineSchema) })).optional(),
  lanes: z.array(z.object({ id: z.string().min(1), label: z.string() })).optional(),
  numbered: z.boolean().optional(),
  flow: z.enum(['pulse', 'none']).optional(),
  narrow: z.enum(['stepper', 'compact']).optional(),
  reveal: z.enum(['sequential', 'all']).optional(),
  focusable: z.boolean().optional(),
  alt: z.string(),
});
export type FlowchartFigure = z.infer<typeof FlowchartFigureSchema>;

// timeline (v2.1)
export const TimelineFigureSchema = z.object({
  kind: z.literal('timeline'),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  events: z
    .array(
      z.object({
        id: z.string().min(1),
        when: z.string().min(1),
        label: z.array(InlineSchema),
        detail: z.array(InlineSchema).optional(),
        enter: EnterSchema.optional(),
      }),
    )
    .min(1)
    .max(64),
  focusable: z.boolean().optional(),
  alt: z.string(),
});
export type TimelineFigure = z.infer<typeof TimelineFigureSchema>;

// labeled (illustration with named parts)
const LabeledFigureSchema = z.object({
  kind: z.literal('labeled'),
  pack: z.string(),
  art: z.string(),
  highlight: z.array(z.string()).optional(),
  labels: z.array(z.object({
    part: z.string(),
    text: z.string(),
  })).optional(),
  alt: z.string(),
});

// chart — all recharts chart kinds are supported (protocol v1 extension, additive).
// `series` is required for every type except `sankey` (which uses `links`), and is
// validated in core/validator.ts so this schema stays a plain discriminated union.
const ChartSeriesSchema = z.object({
  name: z.string(),
  data: z.array(z.union([
    z.number(),
    z.object({ x: z.union([z.number(), z.string()]), y: z.number() }),
  ])).max(400),
  seriesType: z.enum(['bar', 'line', 'area']).optional(),   // composed charts only
});
const ChartFigureSchema = z.object({
  kind: z.literal('chart'),
  type: z.enum(['bar', 'line', 'area', 'pie', 'radar', 'radialBar', 'scatter', 'funnel', 'treemap', 'sankey', 'composed']),
  series: z.array(ChartSeriesSchema).min(1).max(8).optional(),
  links: z.array(z.object({
    source: z.string().min(1),
    target: z.string().min(1),
    value: z.number().nonnegative(),
  })).max(64).optional(),                                  // sankey only
  stacked: z.boolean().optional(),                          // bar/area/composed stacking
  innerRadius: z.number().min(0).max(100).optional(),       // pie ring, percent of outer radius
  curve: z.enum(['linear', 'monotone', 'step']).optional(), // line/area/composed interpolation
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  alt: z.string(),
});

// lottie
const LottieFigureSchema = z.object({
  kind: z.literal('lottie'),
  src: z.union([z.string(), z.object({ asset: z.string() })]),
  loop: z.boolean().optional(),
  alt: z.string(),
});

// Figure discriminated union. All kinds share the `kind` discriminator; 3D
// kinds ship schema-only in M4b (runtime in M5b).
export const FigureSchema = z.discriminatedUnion('kind', [
  ImageFigureSchema,
  IconFigureSchema,
  DiagramFigureSchema,
  FlowchartFigureSchema,
  TimelineFigureSchema,
  LabeledFigureSchema,
  ChartFigureSchema,
  LottieFigureSchema,
  Model3DFigureSchema,
  Scene3DFigureSchema,
]);

export type Figure = z.infer<typeof FigureSchema>;
export type FigureKind = Figure['kind'];
