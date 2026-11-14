import { ModelManifestSchema } from '../schema/model';
import type { Model3DFigure, ModelManifest, ModelSummary } from '../schema/model';
import { createError } from './errors';
import type { LibraryError } from './types';

/**
 * Pure model-contract validation (§6.16). M4b ships the contract; the 3D
 * runtime and the reference connectors arrive in M5b. These helpers are
 * deliberately framework- and connector-free so both the runtime and the
 * tutor-facing tools share one mapping and one set of error codes.
 */

/** Default budgets from §6.16 ("about 2 MB, about 50k triangles"). */
export interface ModelBudget {
  maxSizeBytes: number;
  maxTriangles: number;
}

export const DEFAULT_MODEL_BUDGET: ModelBudget = {
  maxSizeBytes: 2_000_000,
  maxTriangles: 50_000,
};

export type ManifestResult =
  | { manifest: ModelManifest; error?: undefined }
  | { manifest?: undefined; error: LibraryError };

/** Validate an untrusted connector response against the standard manifest. */
export function parseModelManifest(raw: unknown): ManifestResult {
  const parsed = ModelManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: createError('connector-error', `Invalid model manifest: ${parsed.error.message}`),
    };
  }
  return { manifest: parsed.data };
}

/** Enforce the manifest's advertised budgets before any asset is loaded. */
export function checkModelBudget(
  manifest: ModelManifest,
  budget: ModelBudget = DEFAULT_MODEL_BUDGET,
): LibraryError | undefined {
  const { sizeBytes, triangles } = manifest.assets;
  if (sizeBytes !== undefined && sizeBytes > budget.maxSizeBytes) {
    return createError(
      'model-budget-exceeded',
      `Model "${manifest.id}" is ${sizeBytes} bytes (budget ${budget.maxSizeBytes})`,
    );
  }
  if (triangles !== undefined && triangles > budget.maxTriangles) {
    return createError(
      'model-budget-exceeded',
      `Model "${manifest.id}" has ${triangles} triangles (budget ${budget.maxTriangles})`,
    );
  }
  return undefined;
}

/**
 * Split a figure's `model` reference: an explicit `connectorId:modelId` or a
 * bare model id resolved by connector priority.
 */
export function parseModelRef(ref: string): { connectorId?: string; modelId: string } {
  const separator = ref.indexOf(':');
  if (separator > 0 && separator < ref.length - 1) {
    return { connectorId: ref.slice(0, separator), modelId: ref.slice(separator + 1) };
  }
  return { modelId: ref };
}

/** Find a manifest among a connector's models. */
export function findModelInManifests(
  manifests: readonly ModelManifest[],
  ref: string,
): { manifest: ModelManifest; error?: undefined } | { manifest?: undefined; error: LibraryError } {
  const { modelId } = parseModelRef(ref);
  const manifest = manifests.find(candidate => candidate.id === modelId);
  if (!manifest) {
    return { error: createError('model-not-found', `Model not found: ${ref}`) };
  }
  return { manifest };
}

/** Compact, tutor-safe projection of a manifest (§6.16). */
export function toModelSummary(manifest: ModelManifest): ModelSummary {
  return {
    id: manifest.id,
    title: manifest.title,
    ...(manifest.tags !== undefined && { tags: manifest.tags }),
    ...(manifest.description !== undefined && { description: manifest.description }),
    parts: Object.entries(manifest.parts).map(([id, part]) => ({
      id,
      label: part.label,
      ...(part.group !== undefined && { group: part.group }),
    })),
    ...(manifest.views !== undefined && { views: Object.keys(manifest.views) }),
    ...(manifest.animations !== undefined && { animations: Object.keys(manifest.animations) }),
    ...(manifest.paths !== undefined && { paths: Object.keys(manifest.paths) }),
    ...(manifest.cutaways !== undefined && { cutaways: Object.keys(manifest.cutaways) }),
  };
}

/**
 * Check a `model3d` figure's directives against a manifest. Unknown directives
 * are ignored individually with `unknown-part` / `unknown-view`; the figure
 * still renders (§6.16).
 */
export function validateModelDirectives(
  figureId: string,
  figure: Model3DFigure,
  manifest: ModelManifest,
): LibraryError[] {
  const errors: LibraryError[] = [];
  const partIds = new Set(Object.keys(manifest.parts));
  const groupIds = new Set(Object.keys(manifest.groups ?? {}));
  const viewIds = new Set(Object.keys(manifest.views ?? {}));
  const animationIds = new Set(Object.keys(manifest.animations ?? {}));
  const pathIds = new Set(Object.keys(manifest.paths ?? {}));
  const cutawayIds = new Set(Object.keys(manifest.cutaways ?? {}));

  const reportPart = (part: string, where: string) => {
    if (!partIds.has(part)) {
      errors.push(createError('unknown-part', `Unknown part "${part}" in ${where}`, figureId, 'model3d'));
    }
  };
  const reportGroup = (group: string, where: string) => {
    if (!groupIds.has(group)) {
      errors.push(createError('unknown-part', `Unknown group "${group}" in ${where}`, figureId, 'model3d'));
    }
  };
  const reportView = (view: NonNullable<Model3DFigure["view"]>, where: string) => {
    if (typeof view === 'string') {
      // Preset viewpoints always exist.
      if (!['front', 'back', 'left', 'right', 'top', 'bottom', 'iso'].includes(view)) {
        errors.push(createError('unknown-view', `Unknown view "${view}" in ${where}`, figureId, 'model3d'));
      }
      return;
    }
    if ('view' in view && !viewIds.has(view.view)) {
      errors.push(createError('unknown-view', `Unknown view "${view.view}" in ${where}`, figureId, 'model3d'));
    }
    if ('focus' in view) reportPart(view.focus, where);
  };

  const checkDirectives = (directives: Partial<Model3DFigure>, where: string) => {
    if (directives.view !== undefined) reportView(directives.view, `${where}.view`);
    for (const part of directives.show?.parts ?? []) reportPart(part, `${where}.show`);
    for (const group of directives.show?.groups ?? []) reportGroup(group, `${where}.show`);
    for (const part of directives.highlight ?? []) reportPart(part, `${where}.highlight`);
    if (Array.isArray(directives.dim)) {
      for (const part of directives.dim) reportPart(part, `${where}.dim`);
    }
    for (const part of directives.isolate ?? []) reportPart(part, `${where}.isolate`);
    for (const label of directives.labels ?? []) reportPart(label.part, `${where}.labels`);
    if (directives.cutaway !== undefined && !cutawayIds.has(directives.cutaway)) {
      errors.push(
        createError('unknown-part', `Unknown cutaway "${directives.cutaway}" in ${where}`, figureId, 'model3d'),
      );
    }
    if (directives.animation !== undefined && !animationIds.has(directives.animation.id)) {
      errors.push(
        createError('unknown-part', `Unknown animation "${directives.animation.id}" in ${where}`, figureId, 'model3d'),
      );
    }
    if (directives.flow !== undefined && !pathIds.has(directives.flow.path)) {
      errors.push(
        createError('unknown-part', `Unknown path "${directives.flow.path}" in ${where}`, figureId, 'model3d'),
      );
    }
  };

  checkDirectives(figure, 'figure');
  for (const [index, step] of (figure.tour ?? []).entries()) {
    checkDirectives(step, `tour[${index}]`);
  }

  return errors;
}
