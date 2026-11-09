import { z } from 'zod';
import { MotionFieldsSchema, EnterSchema } from './motion';

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

// diagram
const DiagramFigureSchema = z.object({
  kind: z.literal('diagram'),
  layout: z.enum(['tree', 'radial', 'flow', 'cycle']),
  direction: z.enum(['down', 'right']).optional(),
  root: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
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

// chart
const ChartFigureSchema = z.object({
  kind: z.literal('chart'),
  type: z.enum(['bar', 'line', 'pie', 'scatter']),
  series: z.array(z.object({
    name: z.string(),
    data: z.array(z.union([
      z.number(),
      z.object({ x: z.union([z.number(), z.string()]), y: z.number() }),
    ])),
  })),
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

// Figure discriminated union
export const FigureSchema = z.discriminatedUnion('kind', [
  ImageFigureSchema,
  IconFigureSchema,
  DiagramFigureSchema,
  LabeledFigureSchema,
  ChartFigureSchema,
  LottieFigureSchema,
]);

export type Figure = z.infer<typeof FigureSchema>;
