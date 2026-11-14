import { z } from 'zod';
import { InlineSchema } from './inline';
import { ColorTokenSchema, EaseNameSchema, EnterSchema, TriggerSchema } from './motion';
import { GapSchema } from './layout';

/**
 * 3D figure schemas and the standard model manifest (§6.16).
 *
 * M4b ships schemas and types only. The runtime (three.js, loaders, picking,
 * connectors) is M5b. Nothing here imports React, DOM or `three`.
 */

export const PartIdSchema = z.string().min(1).max(96);
export type PartId = z.infer<typeof PartIdSchema>;

const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3Schema>;

const SIDE_SCHEMA = z.enum(['front', 'back', 'left', 'right', 'top', 'bottom']);

/** A camera viewpoint on a model: a preset, a named manifest view, or a part focus. */
export const ViewRefSchema = z.union([
  z.enum(['front', 'back', 'left', 'right', 'top', 'bottom', 'iso']),
  z.object({ view: z.string().min(1) }),
  z.object({
    focus: PartIdSchema,
    distance: z.enum(['near', 'mid', 'far']).optional(),
    from: SIDE_SCHEMA.optional(),
  }),
]);
export type ViewRef = z.infer<typeof ViewRefSchema>;

export const ShowDirectiveSchema = z.object({
  parts: z.array(PartIdSchema).optional(),
  groups: z.array(z.string().min(1)).optional(),
});
export type ShowDirective = z.infer<typeof ShowDirectiveSchema>;

export const ModelAnimationDirectiveSchema = z.object({
  id: z.string().min(1),
  loop: z.boolean().optional(),
  speed: z.number().min(0.1).max(4).optional(),
});
export type ModelAnimationDirective = z.infer<typeof ModelAnimationDirectiveSchema>;

export const ModelFlowDirectiveSchema = z.object({
  path: z.string().min(1),
  pulse: z.boolean().optional(),
});
export type ModelFlowDirective = z.infer<typeof ModelFlowDirectiveSchema>;

export const ModelLabelSchema = z.object({
  part: PartIdSchema,
  text: z.array(InlineSchema),
  enter: EnterSchema.optional(),
});
export type ModelLabel = z.infer<typeof ModelLabelSchema>;

export const ModelControlsSchema = z.enum(['orbit', 'views', 'both', 'none']);
export type ModelControls = z.infer<typeof ModelControlsSchema>;

/** Directives a `tour` step may change. Mirrors the Model3D directive fields. */
const ModelDirectiveFields = {
  view: ViewRefSchema.optional(),
  show: ShowDirectiveSchema.optional(),
  highlight: z.array(PartIdSchema).optional(),
  dim: z.union([z.array(PartIdSchema), z.literal('others')]).optional(),
  isolate: z.array(PartIdSchema).optional(),
  explode: z.number().min(0).max(1).optional(),
  cutaway: z.string().min(1).optional(),
  animation: ModelAnimationDirectiveSchema.optional(),
  flow: ModelFlowDirectiveSchema.optional(),
  labels: z.array(ModelLabelSchema).optional(),
  controls: ModelControlsSchema.optional(),
  interactive: z.boolean().optional(),
  autoRotate: z.boolean().optional(),
};

/** One cue-driven step of a 3D tour (§6.16). */
export const TourStepSchema = z.object({
  ...ModelDirectiveFields,
  trigger: TriggerSchema.optional(),
  duration: z.number().min(0).max(10_000).optional(),
  ease: EaseNameSchema.optional(),
});
export type TourStep = z.infer<typeof TourStepSchema>;

export const Model3DFigureSchema = z.object({
  kind: z.literal('model3d'),
  /** Model id, or `"connectorId:modelId"` for an explicit connector. */
  model: z.string().min(1).max(256),
  ...ModelDirectiveFields,
  tour: z.array(TourStepSchema).max(32).optional(),
  alt: z.string(),
});
export type Model3DFigure = z.infer<typeof Model3DFigureSchema>;

export const SceneShapeSchema = z.enum([
  'sphere',
  'cylinder',
  'cone',
  'torus',
  'box',
  'plane',
  'arrow',
  'ring',
  'tube',
]);
export type SceneShape = z.infer<typeof SceneShapeSchema>;

export const SceneObjectSchema = z.object({
  id: z.string().min(1).max(64),
  shape: SceneShapeSchema,
  size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
  color: ColorTokenSchema.optional(),
  label: z.array(InlineSchema).optional(),
  place: z
    .object({
      relativeTo: z.string().min(1).optional(),
      dir: z.enum(['left', 'right', 'above', 'below', 'front', 'behind']).optional(),
      gap: GapSchema.optional(),
    })
    .optional(),
  /** Abstract units, clamped by the runtime; prefer `place`/`arrange`. */
  at: Vec3Schema.optional(),
  /** For `tube`, max 16 points. */
  points: z.array(Vec3Schema).max(16).optional(),
  animate: z
    .object({
      effect: z.enum(['spin', 'orbit', 'bob', 'pulse']),
      speed: z.number().min(0.1).max(4).optional(),
      around: z.string().min(1).optional(),
    })
    .optional(),
});
export type SceneObject = z.infer<typeof SceneObjectSchema>;

export const Scene3DFigureSchema = z.object({
  kind: z.literal('scene3d'),
  objects: z.array(SceneObjectSchema).max(64),
  arrange: z
    .array(
      z.object({
        kind: z.enum(['row', 'ring', 'grid', 'stack', 'orbit']),
        of: z.array(z.string().min(1)).min(1),
        spacing: GapSchema.optional(),
      }),
    )
    .optional(),
  view: ViewRefSchema.optional(),
  tour: z.array(TourStepSchema).max(32).optional(),
  controls: ModelControlsSchema.optional(),
  interactive: z.boolean().optional(),
  alt: z.string(),
});
export type Scene3DFigure = z.infer<typeof Scene3DFigureSchema>;

// ---------------------------------------------------------------------------
// The standard mapping: ModelManifest (§6.16). Every connector yields this.
// ---------------------------------------------------------------------------

/** Opaque to the library; resolved by the connector that produced the manifest. */
export const AssetRefSchema = z.union([
  z.string().min(1),
  z.object({ connectorAsset: z.string().min(1) }),
]);
export type AssetRef = z.infer<typeof AssetRefSchema>;

export const ModelPartSchema = z.object({
  label: z.string().min(1),
  /** glTF node/mesh names that make up this part. */
  nodes: z.array(z.string().min(1)).min(1),
  group: z.string().min(1).optional(),
  description: z.string().optional(),
  anchor: Vec3Schema.optional(),
});
export type ModelPart = z.infer<typeof ModelPartSchema>;

export const ModelManifestSchema = z.object({
  id: z.string().min(1).max(256),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  locale: z.string().optional(),
  license: z
    .object({
      name: z.string().min(1),
      attribution: z.string().optional(),
      url: z.string().min(1).optional(),
    })
    .optional(),
  conventions: z.object({
    upAxis: z.literal('y'),
    frontAxis: z.literal('+z'),
    unit: z.enum(['m', 'normalized']),
  }),
  assets: z.object({
    model: AssetRefSchema,
    poster: AssetRefSchema.optional(),
    lods: z
      .array(z.object({ maxTriangles: z.number().int().positive(), asset: AssetRefSchema }))
      .optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    triangles: z.number().int().nonnegative().optional(),
  }),
  parts: z.record(PartIdSchema, ModelPartSchema),
  groups: z
    .record(
      z.string().min(1),
      z.object({ label: z.string().min(1), parts: z.array(PartIdSchema) }),
    )
    .optional(),
  views: z
    .record(
      z.string().min(1),
      z.object({
        label: z.string().min(1),
        position: Vec3Schema,
        target: Vec3Schema,
        fov: z.number().min(1).max(120).optional(),
      }),
    )
    .optional(),
  animations: z
    .record(
      z.string().min(1),
      z.object({ label: z.string().min(1), clip: z.string().min(1), loop: z.boolean().optional() }),
    )
    .optional(),
  paths: z
    .record(
      z.string().min(1),
      z.object({
        label: z.string().min(1),
        points: z.array(Vec3Schema).min(2),
        parts: z.array(PartIdSchema).optional(),
      }),
    )
    .optional(),
  cutaways: z
    .record(
      z.string().min(1),
      z.object({
        label: z.string().min(1),
        plane: z.object({ normal: Vec3Schema, offset: z.number() }),
      }),
    )
    .optional(),
  /** Optional authored explode vectors; otherwise computed from centroids. */
  explode: z.record(PartIdSchema, Vec3Schema).optional(),
});
export type ModelManifest = z.infer<typeof ModelManifestSchema>;

/** Compact, tutor-safe summary. Heavy assets never appear here (§6.16). */
export const ModelSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  parts: z.array(
    z.object({
      id: PartIdSchema,
      label: z.string().min(1),
      group: z.string().optional(),
    }),
  ),
  views: z.array(z.string()).optional(),
  animations: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
  cutaways: z.array(z.string()).optional(),
});
export type ModelSummary = z.infer<typeof ModelSummarySchema>;

export const ModelQuerySchema = z.object({
  text: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).optional(),
});
export type ModelQuery = z.infer<typeof ModelQuerySchema>;
