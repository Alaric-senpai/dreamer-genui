import type { ZodType } from 'zod';
import type { EaseName } from '../schema/motion';
import type { LayoutSpec, Slot } from '../schema/layout';
import type { MoodPreset, AmbiencePreset, SurfacePreset } from '../theme/presets';
import type { ThemeTokens } from '../schema/theme';
import type { ModelConnector } from '../schema/connector';
import type { UIEvent } from '../schema/events';
import type { Op } from '../schema/ops';
import type { Block } from '../schema/blocks';

/**
 * The Plugin SDK (§8). Everything a host or third party can extend is defined
 * here with a small `define*` helper; `Registry` stores the results and the
 * engine reads them. Built-in plugins use exactly the same helpers.
 *
 * Core never imports React. Component implementations are lazy loaders that
 * return a module; only the React layer interprets them.
 */

/** Engine version that plugin `engine` ranges are checked against. */
export const ENGINE_VERSION = '1.0.0';

/** Names reserved for built-ins (§8.4). Third-party names must be `vendor:name`. */
export const CORE_PLUGIN_NAMES = [
  'core',
  'math',
  'code',
  'table',
  'chart',
  'lottie',
  'diagrams',
  'labeled',
  'model3d',
  'scene3d',
  'questions',
  'assessment',
  'themes-default',
  'ambience-default',
  'motion-default',
  'transitions-default',
  'layouts-default',
  'icons-default',
  'strings-default',
  'ui-kit',
] as const;

export type CorePluginName = (typeof CORE_PLUGIN_NAMES)[number];

/** Registry branches (§8.2). Each name is the key `provides` uses. */
export type RegistryKind =
  | 'blocks'
  | 'marks'
  | 'figures'
  | 'questions'
  | 'effects'
  | 'transitions'
  | 'layouts'
  | 'moods'
  | 'ambience'
  | 'surfaces'
  | 'themes'
  | 'motionPresets'
  | 'iconSets'
  | 'assetPacks'
  | 'modelConnectors'
  | 'primitives'
  | 'strings'
  | 'renderers'
  | 'middleware'
  | 'profiles'
  | 'devtoolsPanels';

export const REGISTRY_KINDS: readonly RegistryKind[] = [
  'blocks',
  'marks',
  'figures',
  'questions',
  'effects',
  'transitions',
  'layouts',
  'moods',
  'ambience',
  'surfaces',
  'themes',
  'motionPresets',
  'iconSets',
  'assetPacks',
  'modelConnectors',
  'primitives',
  'strings',
  'renderers',
  'middleware',
  'profiles',
  'devtoolsPanels',
];

/** Component anatomy metadata (§8.5). */
export interface ComponentParts {
  /** Named parts rendered with `data-dg-part`. */
  parts: string[];
  /** `--dg-<component>-<token>` names this component understands. */
  tokens?: string[];
  variants?: string[];
  dataAttrs?: string[];
  events?: string[];
  effects?: string[];
}

export interface FallbackDefinition {
  /** Plain-text replacement rendered when the implementation cannot load. */
  text?: string;
  /** Load a fallback component instead. */
  load?: () => Promise<unknown>;
}

/** A block type (§6.5, §8.2). */
export interface BlockDefinition {
  schema: ZodType;
  promptGuide?: string;
  fallback?: string | FallbackDefinition;
  load?: () => Promise<unknown>;
  parts?: ComponentParts;
}

/** An inline mark (§6.6, §8.2). */
export interface MarkDefinition {
  schema: ZodType;
  promptGuide?: string;
  load?: () => Promise<unknown>;
  parts?: ComponentParts;
}

/** A figure kind (§6.7, §8.2). */
export interface FigureDefinition {
  schema: ZodType;
  promptGuide?: string;
  fallback?: string | FallbackDefinition;
  load?: () => Promise<unknown>;
  parts?: ComponentParts;
}

/** A question kind (§6.8, §8.2). */
export interface QuestionDefinition {
  schema: ZodType;
  /** Answer schema for this kind. */
  answer: ZodType;
  promptGuide?: string;
  load?: () => Promise<unknown>;
  parts?: ComponentParts;
  /** Accessible name / interaction notes for the conformance suite. */
  a11y?: string;
}

/** A motion effect preset (§6.9, §8.2). */
export interface EffectDefinition {
  /** Which driver plays it. */
  driver: 'motion' | 'css' | 'gsap';
  /** Base duration at tempo 1, ms. */
  duration: number;
  ease?: EaseName;
  /** What happens under `prefers-reduced-motion`. */
  reducedMotion: 'instant' | 'fade' | 'none';
  /** Applies to enter, emphasis or exit. Defaults to enter. */
  phase?: 'enter' | 'emphasis' | 'exit';
  /** Driver-specific parameters (never protocol data). */
  params?: Record<string, string | number | boolean>;
}

/** A scene transition (§6.18, §8.2). Built-ins register through `defineTransition`. */
export interface TransitionDefinition {
  /** Preset name used by `replace.transition.kind`. */
  kind: string;
  /** Base duration at tempo 1, ms. */
  duration: number;
  ease?: EaseName;
  /** What happens under `prefers-reduced-motion`. */
  reducedMotion: 'instant' | 'fade';
  description?: string;
  load?: () => Promise<unknown>;
}

/** A board layout (§6.4, §8.2). */
export interface LayoutDefinition {
  /** Regions this layout defines, in reading order. */
  regions: Slot[];
  /** Region unslotted nodes flow into. */
  primary: Slot;
  /** How regions collapse on a narrow container. */
  narrow?: 'stack' | 'tabs';
  load?: () => Promise<unknown>;
  parts?: ComponentParts;
}

/** A complete theme preset (tokens + component tokens). */
export interface ThemeDefinition {
  tokens: ThemeTokens;
  description?: string;
}

/** Tempo + easing set a mood or host can select (§6.10). */
export interface MotionPresetDefinition {
  /** Playback speed multiplier (1 = authored tempo). */
  speed: number;
  description?: string;
}

/** A pluggable icon source (§4). */
export interface IconDefinition {
  /** Inline, sanitised SVG body (no scripts). */
  body: string;
  license?: string;
}

export interface IconSetDefinition {
  description?: string;
  icons: Record<string, IconDefinition>;
}

/** An asset pack with named parts (§6.7). Data only; the renderer validates. */
export interface AssetPackDefinition {
  description?: string;
  arts: Record<string, unknown>;
}

/** Extra `scene3d` primitive (§6.16). */
export interface PrimitiveDefinition {
  /** Primitive name used in `scene3d.objects[].shape`. */
  shape: string;
  description?: string;
}

/** An i18n bundle (§7.11). */
export interface StringsDefinition {
  locale: string;
  strings: Record<string, string>;
}

/** A text/inline renderer override (§8.2). */
export interface RendererDefinition {
  description?: string;
  load?: () => Promise<unknown>;
}

/** Prompt-guide capability profile (§9.4). */
export interface ProfileDefinition {
  description?: string;
  include?: string[];
  exclude?: string[];
  compact?: boolean;
}

/** Devtools panel extension (§7.13). */
export interface DevtoolsPanelDefinition {
  title: string;
  load?: () => Promise<unknown>;
  /** Lower runs earlier. */
  order?: number;
}

/** Middleware contract (§8.6). Implemented in `core/middleware.ts`. */
export interface MiddlewareDefinition {
  name: string;
  /** Ascending order; lower priority runs first. Defaults to 100. */
  priority?: number;
  onOp?: (op: Op, ctx: MiddlewareContext) => Op | Op[] | null | Promise<Op | Op[] | null>;
  onEvent?: (event: UIEvent, ctx: MiddlewareContext) => UIEvent | null | Promise<UIEvent | null>;
  onThemeResolve?: (spec: unknown, ctx: MiddlewareContext) => unknown;
  onNodeResolve?: (node: Block, ctx: MiddlewareContext) => Block | null;
}

export interface MiddlewareContext {
  readonly registry: unknown;
  readonly direction: 'ltr' | 'rtl';
  readonly locale: string;
}

export interface PluginInstallContext {
  registry: unknown;
  onError?: (error: unknown) => void;
}

/** What a plugin contributes. Keys mirror `RegistryKind`. */
export interface PluginProvides {
  blocks?: Record<string, BlockDefinition>;
  marks?: Record<string, MarkDefinition>;
  figures?: Record<string, FigureDefinition>;
  questions?: Record<string, QuestionDefinition>;
  effects?: Record<string, EffectDefinition>;
  transitions?: Record<string, TransitionDefinition>;
  layouts?: Record<string, LayoutDefinition>;
  moods?: Record<string, MoodPreset>;
  ambience?: Record<string, AmbiencePreset>;
  surfaces?: Record<string, SurfacePreset>;
  themes?: Record<string, ThemeDefinition>;
  motionPresets?: Record<string, MotionPresetDefinition>;
  iconSets?: Record<string, IconSetDefinition>;
  assetPacks?: Record<string, AssetPackDefinition>;
  modelConnectors?: Record<string, ModelConnector>;
  primitives?: Record<string, PrimitiveDefinition>;
  strings?: Record<string, StringsDefinition>;
  renderers?: Record<string, RendererDefinition>;
  middleware?: Record<string, MiddlewareDefinition>;
  profiles?: Record<string, ProfileDefinition>;
  devtoolsPanels?: Record<string, DevtoolsPanelDefinition>;
}

/** A plugin manifest + optional implementation hooks (§8.3). */
export interface PluginDefinition {
  /** Third-party names must be `vendor:name`; core names are reserved. */
  name: string;
  version: string;
  /** Compatible engine range, e.g. `^1.0.0`. Defaults to `^1.0.0`. */
  engine?: string;
  /** Plugin names this one needs; missing requirements yield `plugin-incompatible`. */
  requires?: string[];
  /** Take priority over an existing registration of the same kind/name. */
  override?: boolean;
  provides?: PluginProvides;
  install?: (ctx: PluginInstallContext) => void;
}

/** Identity helper that normalises defaults. */
export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return {
    ...definition,
    engine: definition.engine ?? '^1.0.0',
    provides: definition.provides ?? {},
  };
}

export function defineBlock(definition: BlockDefinition): BlockDefinition {
  return definition;
}

export function defineMark(definition: MarkDefinition): MarkDefinition {
  return definition;
}

export function defineFigure(definition: FigureDefinition): FigureDefinition {
  return definition;
}

export function defineQuestion(definition: QuestionDefinition): QuestionDefinition {
  return definition;
}

export function defineEffect(definition: EffectDefinition): EffectDefinition {
  return definition;
}

export function defineTransition(definition: TransitionDefinition): TransitionDefinition {
  return definition;
}

export function defineLayout(definition: LayoutDefinition): LayoutDefinition {
  return definition;
}

export function defineMood(definition: MoodPreset): MoodPreset {
  return definition;
}

export function defineAmbience(definition: AmbiencePreset): AmbiencePreset {
  return definition;
}

export function defineSurface(definition: SurfacePreset): SurfacePreset {
  return definition;
}

export function defineTheme(definition: ThemeDefinition): ThemeDefinition {
  return definition;
}

export function defineMotionPreset(definition: MotionPresetDefinition): MotionPresetDefinition {
  return definition;
}

export function defineIconSet(definition: IconSetDefinition): IconSetDefinition {
  return definition;
}

export function defineAssetPack(definition: AssetPackDefinition): AssetPackDefinition {
  return definition;
}

/** Validate a connector's shape at registration; retrieval stays host-owned. */
export function defineModelConnector(connector: ModelConnector): ModelConnector {
  if (typeof connector.id !== 'string' || connector.id.length === 0) {
    throw new Error('defineModelConnector: connector.id must be a non-empty string');
  }
  if (typeof connector.getManifest !== 'function' || typeof connector.getAsset !== 'function') {
    throw new Error('defineModelConnector: getManifest and getAsset are required');
  }
  return connector;
}

/**
 * Sugar for a static connector over bundled models. The reference connector
 * runtime lands in M5b; this keeps the manifest + asset resolver contract in
 * one place for hosts that bundle a pack.
 */
export function defineModelPack(options: {
  id: string;
  manifests: Record<string, unknown>;
  assets?: Record<string, string | ArrayBuffer | Blob>;
}): ModelConnector {
  return defineModelConnector({
    id: options.id,
    async getManifest(modelId) {
      const manifest = options.manifests[modelId];
      if (manifest === undefined) throw new Error(`Unknown model: ${modelId}`);
      return manifest;
    },
    async getAsset(modelId, ref) {
      const key = typeof ref === 'string' ? ref : ref.connectorAsset;
      const asset = options.assets?.[`${modelId}:${key}`] ?? options.assets?.[key];
      if (asset === undefined) throw new Error(`Unknown asset: ${key}`);
      return asset;
    },
    async search(query) {
      const all = Object.keys(options.manifests);
      const hits = query.text
        ? all.filter(id => id.toLowerCase().includes(query.text!.toLowerCase()))
        : all;
      return hits.slice(0, query.limit ?? hits.length).map(id => ({
        id,
        title: id,
        parts: [] as { id: string; label: string }[],
      }));
    },
  });
}

export function definePrimitive(definition: PrimitiveDefinition): PrimitiveDefinition {
  return definition;
}

export function defineStrings(definition: StringsDefinition): StringsDefinition {
  return definition;
}

export function defineRenderer(definition: RendererDefinition): RendererDefinition {
  return definition;
}

export function defineMiddleware(definition: MiddlewareDefinition): MiddlewareDefinition {
  return { priority: 100, ...definition };
}

export function defineProfile(definition: ProfileDefinition): ProfileDefinition {
  return definition;
}

export function defineDevtoolsPanel(definition: DevtoolsPanelDefinition): DevtoolsPanelDefinition {
  return definition;
}

/** True when `name` follows the `vendor:name` rule. */
export function isNamespacedName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/.test(name);
}

export function isCorePluginName(name: string): boolean {
  return (CORE_PLUGIN_NAMES as readonly string[]).includes(name);
}

/**
 * Minimal engine range check. Supports exact versions, `*`, `^x.y.z`,
 * `~x.y.z` and `>=x.y.z`. Ranges are intentionally small: the engine only
 * needs to reject clearly incompatible plugins, not implement npm semver.
 */
export function satisfiesEngine(range: string, version: string = ENGINE_VERSION): boolean {
  const trimmed = range.trim();
  if (trimmed === '*' || trimmed === '') return true;
  const parse = (value: string) => value.split('.').map(part => Number.parseInt(part, 10) || 0);
  const [vMajor = 0, vMinor = 0, vPatch = 0] = parse(version);
  const match = /^(\^|~|>=)?\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(trimmed);
  if (!match) return true; // unknown range syntax: do not block the host
  const operator = match[1] ?? '';
  const rMajor = Number(match[2]);
  const rMinor = Number(match[3] ?? 0);
  const rPatch = Number(match[4] ?? 0);
  switch (operator) {
    case '^':
      if (rMajor > 0) return vMajor === rMajor && (vMinor > rMinor || (vMinor === rMinor && vPatch >= rPatch));
      return vMajor === 0 && vMinor === rMinor && vPatch >= rPatch;
    case '~':
      return vMajor === rMajor && vMinor === rMinor && vPatch >= rPatch;
    case '>=':
      if (vMajor !== rMajor) return vMajor > rMajor;
      if (vMinor !== rMinor) return vMinor > rMinor;
      return vPatch >= rPatch;
    default:
      return vMajor === rMajor && vMinor === rMinor && vPatch === rPatch;
  }
}

/** Convenience for authoring tools: list provided names per kind. */
export function providedNames(plugin: PluginDefinition): Array<{ kind: RegistryKind; name: string }> {
  const out: Array<{ kind: RegistryKind; name: string }> = [];
  for (const kind of REGISTRY_KINDS) {
    const branch = plugin.provides?.[kind] as Record<string, unknown> | undefined;
    if (!branch) continue;
    for (const name of Object.keys(branch)) out.push({ kind, name });
  }
  return out;
}

/** Select the layout definition for a spec, falling back to the default model. */
export function layoutDefinitionFor(spec: LayoutSpec): LayoutDefinition {
  switch (spec.kind) {
    case 'split':
      return { regions: ['left', 'right'], primary: spec.sides === 'right-left' ? 'right' : 'left', narrow: spec.narrow ?? 'stack' };
    case 'stage':
      return {
        regions: spec.regions ?? ['top', 'left', 'center', 'right', 'bottom'],
        primary: 'center',
        narrow: spec.narrow ?? 'stack',
      };
    case 'grid':
    case 'flow':
    default:
      return { regions: ['center'], primary: 'center', narrow: 'stack' };
  }
}
