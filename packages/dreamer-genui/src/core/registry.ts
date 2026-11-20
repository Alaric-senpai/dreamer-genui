import type { ZodType } from 'zod';
import { createError } from './errors';
import type { LibraryError, ResolvedNode } from './types';
import type { ThemeTokens } from '../schema/theme';
import {
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
} from '../schema/blocks';
import { QuestionBlockSchema } from '../schema/question';
import { AssessmentBlockSchema } from '../schema/assessment';
import { EXAMPLE_MOODS, EXAMPLE_AMBIENCE, EXAMPLE_SURFACES } from '../theme/presets';
import { ENTER_PRESETS, TRANSITION_PRESETS } from '../motion/presets';
import { BUILT_IN_PROFILES } from './profiles';
import { DEFAULT_STRINGS, SWAHILI_STRINGS } from './strings';
import type { MoodPreset, AmbiencePreset as AmbiencePresetEntry, SurfacePreset as SurfacePresetEntry } from '../theme/presets';
import {
  defineBlock,
  definePlugin,
  isNamespacedName,
  layoutDefinitionFor,
  satisfiesEngine,
  type BlockDefinition,
  type EffectDefinition,
  type LayoutDefinition,
  type PluginDefinition,
  type PluginProvides,
  type RegistryKind,
  type ThemeDefinition,
  type TransitionDefinition,
} from './plugin';

export type { MoodPreset, AmbiencePresetEntry, SurfacePresetEntry };
export type { PluginDefinition, RegistryKind } from './plugin';

/** Backwards-compatible manifest shape: a block definition plus legacy fields. */
export interface TypeManifest extends BlockDefinition {
  schema: ZodType;
  promptGuide?: string;
  fallback?: string;
}

/**
 * The old plugin shape kept for compatibility with hosts that built a
 * registry before the SDK existed. Prefer `definePlugin` + `registry.use`.
 */
export interface Plugin {
  name: string;
  version: string;
  types: Record<string, TypeManifest>;
}

export interface RegistryEntry<T = unknown> {
  kind: RegistryKind;
  name: string;
  plugin: string;
  priority: number;
  builtin: boolean;
  disabled: boolean;
  value: T;
}

/** Typed value per registry branch. */
export interface RegistryValueMap {
  blocks: BlockDefinition;
  marks: import('./plugin').MarkDefinition;
  figures: import('./plugin').FigureDefinition;
  questions: import('./plugin').QuestionDefinition;
  effects: EffectDefinition;
  transitions: TransitionDefinition;
  layouts: LayoutDefinition;
  moods: MoodPreset;
  ambience: AmbiencePresetEntry;
  surfaces: SurfacePresetEntry;
  themes: ThemeDefinition;
  motionPresets: import('./plugin').MotionPresetDefinition;
  iconSets: import('./plugin').IconSetDefinition;
  assetPacks: import('./plugin').AssetPackDefinition;
  modelConnectors: import('../schema/connector').ModelConnector;
  primitives: import('./plugin').PrimitiveDefinition;
  strings: import('./plugin').StringsDefinition;
  renderers: import('./plugin').RendererDefinition;
  middleware: import('./plugin').MiddlewareDefinition;
  profiles: import('./plugin').ProfileDefinition;
  devtoolsPanels: import('./plugin').DevtoolsPanelDefinition;
}

export interface RegistryOptions {
  onError?: (err: LibraryError) => void;
  /** Override/extend the example mood presets. */
  moodPresets?: MoodPreset[];
  ambiencePresets?: AmbiencePresetEntry[];
  surfacePresets?: SurfacePresetEntry[];
  /** Replace the example presets entirely (no built-ins shipped). */
  replace?: boolean;
  /**
   * Development mode: a duplicate registration throws (per §8.4). In
   * production it reports `plugin-conflict` and keeps the first registration.
   * Defaults to `process.env.NODE_ENV !== 'production'`.
   */
  strictPlugins?: boolean;
}

export interface UsePluginOptions {
  /** Treat the plugin as library code (unnamespaced names allowed). */
  builtin?: boolean;
  /** Override conflicting entries from this plugin. */
  override?: boolean;
}

export interface Registry {
  /** All registered plugins (including built-ins). */
  plugins: Map<string, PluginDefinition>;

  /** Get the TypeManifest for a block type, or undefined if unknown. */
  getManifest(type: string): TypeManifest | undefined;

  /** Register a lazy loader for a block type. */
  registerLoader(type: string, loader: () => unknown): void;

  /** Get the loader for a block type. */
  getLoader(type: string): (() => unknown) | undefined;

  /** Validate props against the type's schema; return resolved node. */
  resolve(type: string, props: unknown): ResolvedNode;

  /** List all enabled block types. */
  getCapabilities(): string[];

  /** Register a plugin (§8.3). Returns false when it was rejected. */
  use(plugin: PluginDefinition | Plugin, options?: UsePluginOptions): boolean;

  /** Force a specific implementation to the top of a registry branch. */
  override<K extends RegistryKind>(kind: K, name: string, value: RegistryValueMap[K]): void;

  /** Disable a plugin by name, or every entry with that name across registries. */
  disable(name: string): void;
  enable(name: string): void;

  /** Disable/enable one registry entry. */
  disableEntry(kind: RegistryKind, name: string): void;
  enableEntry(kind: RegistryKind, name: string): void;

  /** List every entry (all priorities), or the winning value for one kind. */
  list(kind?: RegistryKind): RegistryEntry[];
  listValues<K extends RegistryKind>(kind: K): RegistryValueMap[K][];

  /** Typed lookup: highest-priority enabled entry. */
  get<K extends RegistryKind>(kind: K, name: string): RegistryValueMap[K] | undefined;
  getEntry<K extends RegistryKind>(kind: K, name: string): RegistryEntry<RegistryValueMap[K]> | undefined;

  /** Register a value directly (used by plugin `install` and hosts). */
  register<K extends RegistryKind>(kind: K, name: string, value: RegistryValueMap[K], options?: { plugin?: string; override?: boolean }): void;

  /** Mood/ambience/surface registries (§6.8/§6.9) — plugins and hosts contribute here. */
  registerMood(mood: MoodPreset): void;
  getMood(name: string): MoodPreset | undefined;
  listMoods(): MoodPreset[];
  registerAmbience(preset: AmbiencePresetEntry | Omit<AmbiencePresetEntry, 'description'> & { description?: string }): void;
  getAmbience(name: string): AmbiencePresetEntry | undefined;
  listAmbience(): AmbiencePresetEntry[];
  registerSurface(preset: SurfacePresetEntry | Omit<SurfacePresetEntry, 'description'> & { description?: string }): void;
  getSurface(name: string): SurfacePresetEntry | undefined;
  listSurfaces(): SurfacePresetEntry[];

  /** Registered 3D connectors (§6.16), in priority order. */
  listModelConnectors(): import('../schema/connector').ModelConnector[];
  /** Enabled middleware sorted by ascending priority. */
  listMiddleware(): import('./plugin').MiddlewareDefinition[];
}

// ---------------------------------------------------------------------------
// Built-ins. These use exactly the public SDK (§8 dogfooding).
// ---------------------------------------------------------------------------

const CORE_BLOCKS: Record<string, BlockDefinition> = {
  text: defineBlock({ schema: TextBlockSchema, promptGuide: 'text block: variant (body|definition|heading|note|hero|kicker|quote), content is Inline[].' }),
  figure: defineBlock({ schema: FigureBlockSchema, promptGuide: 'figure block: figure.kind (image|icon|diagram|flowchart|timeline|labeled|chart|lottie|model3d|scene3d), alt required.' }),
  choices: defineBlock({ schema: ChoicesBlockSchema, promptGuide: 'choices block: items array with {id, label}. intent=navigate emits select; intent=answer emits answer.' }),
  steps: defineBlock({ schema: StepsBlockSchema, promptGuide: 'steps block: items array with {id, title, content: Inline[]}. reveal=sequential reveals one at a time.' }),
  callout: defineBlock({ schema: CalloutBlockSchema, promptGuide: 'callout block: tone (info|success|warn|danger), content: Inline[].' }),
  group: defineBlock({ schema: GroupBlockSchema, promptGuide: 'group block: layout (stack|row|grid) plus direction/wrap/align/justify/gap/columns, blocks: Block[].' }),
  list: defineBlock({ schema: ListBlockSchema, promptGuide: 'list block: style (bullet|number|check|none), items: {id?, content: Inline[]}[] .' }),
  compare: defineBlock({ schema: CompareBlockSchema, promptGuide: 'compare block: columns: {id, title: Inline[], items: Inline[][]}[]; optional highlight {col,row}.' }),
  flashcards: defineBlock({ schema: FlashcardsBlockSchema, promptGuide: 'flashcards block: cards: {id, front: Inline[], back: Inline[]}[], flip tap|auto, optional rating.' }),
  question: defineBlock({
    schema: QuestionBlockSchema,
    promptGuide: 'question block: kind (mcq|truefalse|short|numeric|cloze|matching|ordering|hotspot|labelDiagram|extended), prompt: Inline[]. Never add a key inside quiz/exam assessments.',
    parts: { parts: ['root', 'prompt', 'body', 'feedback'], tokens: ['accent', 'radius'], events: ['answer'] },
  }),
  assessment: defineBlock({
    schema: AssessmentBlockSchema,
    promptGuide: 'assessment block: mode (practice|quiz|exam|review), sections[].questions[]. No answer keys in quiz/exam payloads.',
    parts: { parts: ['root', 'header', 'navigator', 'timer', 'question', 'submit'], tokens: ['accent', 'radius'], events: ['assessment', 'answer'] },
  }),
};

const CORE_BLOCK_PLUGIN = definePlugin({
  name: 'core',
  version: '1.0.0',
  provides: { blocks: CORE_BLOCKS },
});

/**
 * Content built-ins are separate default plugins (§9.2) so a host can disable
 * one (`registry.disable('math')`) and have it disappear from the renderer,
 * the prompt guide, the JSON Schema and the capabilities together.
 */
const TABLE_PLUGIN = definePlugin({
  name: 'table',
  version: '1.0.0',
  provides: {
    blocks: {
      table: defineBlock({
        schema: TableBlockSchema,
        promptGuide: 'table block: columns: {id, label}[], rows: {colId: Inline[]}[]',
        parts: { parts: ['root', 'table', 'head', 'row', 'cell'], tokens: ['surface', 'border', 'accent', 'ink'], events: ['focus'] },
      }),
    },
  },
});

const MATH_PLUGIN = definePlugin({
  name: 'math',
  version: '1.0.0',
  provides: {
    blocks: {
      math: defineBlock({
        schema: MathBlockSchema,
        promptGuide: 'math block: tex is a KaTeX-compatible string. Use \\ce{} for chemical equations.',
        parts: { parts: ['root', 'fallback'], tokens: ['ink', 'accent'], events: [] },
      }),
    },
  },
});

const CODE_PLUGIN = definePlugin({
  name: 'code',
  version: '1.0.0',
  provides: {
    blocks: {
      code: defineBlock({
        schema: CodeBlockSchema,
        promptGuide: 'code block: lang (python|javascript|etc.), source is the code string.',
        parts: { parts: ['root', 'lang', 'pre', 'code', 'fallback'], tokens: ['surface', 'ink', 'muted', 'accent'], events: [] },
      }),
    },
  },
});

/**
 * Tutor-addressable UI-kit blocks (§6.19). Every one nests arbitrary blocks,
 * honours `enter`/triggers/slot through the normal node contract, and uses the
 * board's motion presets. Hover affordances are tap-first on touch.
 */
const UI_KIT_BLOCKS: Record<string, BlockDefinition> = {
  card: defineBlock({
    schema: CardBlockSchema,
    promptGuide:
      'card block: title?, description?, media?, blocks: Block[], footer?, variant (plain|outlined|elevated|accent); interactive:true emits select. Use a card for one composed idea, not a dashboard of cards.',
  }),
  alert: defineBlock({
    schema: AlertBlockSchema,
    promptGuide:
      'alert block: tone (info|success|warn|danger), title?, content: Inline[], icon?, dismissible?. Use for a short, consequential notice; use callout for quiet asides.',
  }),
  accordion: defineBlock({
    schema: AccordionBlockSchema,
    promptGuide:
      'accordion block: items {id,title:Inline[],blocks:Block[],open?}[], multiple?. Toggling emits action=toggle with detail.open. Keep item content short; one or two items on a phone.',
  }),
  collapsible: defineBlock({
    schema: CollapsibleBlockSchema,
    promptGuide:
      'collapsible block: title: Inline[], blocks: Block[], open?. Toggling emits action=toggle with detail.open. Use for optional depth that would otherwise crowd the beat.',
  }),
  tabs: defineBlock({
    schema: TabsBlockSchema,
    promptGuide:
      'tabs block: tabs {id,label:Inline[],blocks:Block[]}[], active?. Selecting a tab emits select with the tab id as ref. Prefer two or three tabs with short labels.',
  }),
  badge: defineBlock({
    schema: BadgeBlockSchema,
    promptGuide:
      'badge block: text: Inline[], tone (accent|info|success|warn|danger|muted). A compact status or label, not a sentence.',
  }),
  progress: defineBlock({
    schema: ProgressBlockSchema,
    promptGuide:
      'progress block: value 0-100 (omit for indeterminate), label?, variant (bar|ring|pill). The fill animates on enter; drive changes with update ops.',
  }),
  counter: defineBlock({
    schema: CounterBlockSchema,
    promptGuide:
      'counter block: value, from?, format (number|percent|time|currency), label?. Counts up on enter; use for a number that deserves emphasis.',
  }),
  avatar: defineBlock({
    schema: AvatarBlockSchema,
    promptGuide:
      'avatar block: name?, src (URL or {asset}), icon?, size (xs|sm|md|lg|xl). Decorative fallback is initials or icon; alt is inherited from name.',
  }),
  separator: defineBlock({
    schema: SeparatorBlockSchema,
    promptGuide:
      'separator block: orientation (horizontal|vertical), label?. Group a beat or label a break; do not use it as the only source of spacing.',
  }),
  carousel: defineBlock({
    schema: CarouselBlockSchema,
    promptGuide:
      'carousel block: slides {id,blocks:Block[]}[], auto?. Moving to a slide emits select with the slide id as ref. Keep each slide to one idea; tap-first controls.',
  }),
  kbd: defineBlock({
    schema: KbdBlockSchema,
    promptGuide:
      'kbd block: keys: string[]. Render a shortcut as keycaps, e.g. ["Ctrl", "K"]; use inline text for prose.',
  }),
};

const UI_KIT_PLUGIN = definePlugin({
  name: 'ui-kit',
  version: '1.0.0',
  provides: { blocks: UI_KIT_BLOCKS },
});

const THEME_PLUGIN = definePlugin({
  name: 'themes-default',
  version: '1.0.0',
  provides: {
    moods: Object.fromEntries(EXAMPLE_MOODS.map(mood => [mood.name, mood])),
    ambience: Object.fromEntries(EXAMPLE_AMBIENCE.map(preset => [preset.name, preset])),
    surfaces: Object.fromEntries(EXAMPLE_SURFACES.map(preset => [preset.name, preset])),
  },
});

const MOTION_PLUGIN = definePlugin({
  name: 'motion-default',
  version: '1.0.0',
  provides: {
    effects: Object.fromEntries(
      Object.entries(ENTER_PRESETS).map(([name, preset]) => [
        name,
        {
          driver: 'motion',
          duration: preset.duration,
          ease: preset.ease,
          reducedMotion: preset.reducedMotion,
          phase: 'enter',
        } satisfies EffectDefinition,
      ]),
    ),
  },
});

const TRANSITIONS_PLUGIN = definePlugin({
  name: 'transitions-default',
  version: '1.0.0',
  provides: {
    transitions: Object.fromEntries(
      Object.entries(TRANSITION_PRESETS).map(([kind, preset]) => [
        kind,
        {
          kind,
          duration: preset.duration,
          ease: preset.ease,
          reducedMotion: preset.reducedMotion,
          description:
            kind === 'cut'
              ? 'Instant scene swap; used in exam mode and reduced motion.'
              : kind === 'fade'
                ? 'Default calm cross-fade between scenes.'
                : kind === 'wipe'
                  ? 'Directional wipe revealing the incoming scene.'
                  : kind === 'push'
                    ? 'Incoming scene pushes the outgoing one aside.'
                    : kind === 'iris'
                      ? 'Circular iris opening from a point or node.'
                      : 'Shared-key morph between matching nodes.',
        } satisfies TransitionDefinition,
      ]),
    ),
  },
});

const LAYOUT_PLUGIN = definePlugin({
  name: 'layouts-default',
  version: '1.0.0',
  provides: {
    layouts: {
      flow: layoutDefinitionFor({ kind: 'flow' }),
      split: layoutDefinitionFor({ kind: 'split' }),
      grid: layoutDefinitionFor({ kind: 'grid' }),
      stage: layoutDefinitionFor({ kind: 'stage' }),
    },
  },
});

const PROFILES_PLUGIN = definePlugin({
  name: 'profiles-default',
  version: '1.0.0',
  provides: {
    profiles: Object.fromEntries(
      Object.entries(BUILT_IN_PROFILES).map(([name, profile]) => [name, profile]),
    ),
  },
});

const STRINGS_PLUGIN = definePlugin({
  name: 'strings-default',
  version: '1.0.0',
  provides: {
    strings: {
      en: { locale: 'en', strings: DEFAULT_STRINGS },
      sw: { locale: 'sw', strings: SWAHILI_STRINGS },
    },
  },
});

const DEFAULT_PLUGINS = [
  CORE_BLOCK_PLUGIN,
  TABLE_PLUGIN,
  MATH_PLUGIN,
  CODE_PLUGIN,
  UI_KIT_PLUGIN,
  THEME_PLUGIN,
  MOTION_PLUGIN,
  TRANSITIONS_PLUGIN,
  LAYOUT_PLUGIN,
  PROFILES_PLUGIN,
  STRINGS_PLUGIN,
];

const KIND_ORDER: Record<RegistryKind, number> = {
  blocks: 0,
  marks: 1,
  figures: 2,
  questions: 3,
  effects: 4,
  transitions: 5,
  layouts: 6,
  moods: 7,
  ambience: 8,
  surfaces: 9,
  themes: 10,
  motionPresets: 11,
  iconSets: 12,
  assetPacks: 13,
  modelConnectors: 14,
  primitives: 15,
  strings: 16,
  renderers: 17,
  middleware: 18,
  profiles: 19,
  devtoolsPanels: 20,
};

export function createRegistry(options: RegistryOptions = {}): Registry {
  const plugins = new Map<string, PluginDefinition>();
  const entries = new Map<RegistryKind, RegistryEntry[]>();
  const loaders = new Map<string, () => unknown>();
  const strict = options.strictPlugins ?? (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
  let priorityCounter = 0;

  for (const kind of Object.keys(KIND_ORDER) as RegistryKind[]) entries.set(kind, []);

  function report(err: LibraryError): false {
    options.onError?.(err);
    if (strict) throw new Error(`${err.code}: ${err.detail ?? ''}`);
    return false;
  }

  function branch(kind: RegistryKind): RegistryEntry[] {
    return entries.get(kind)!;
  }

  function insertEntry<K extends RegistryKind>(
    kind: K,
    name: string,
    value: RegistryValueMap[K],
    meta: { plugin: string; builtin: boolean; priority: number; override?: boolean },
  ): RegistryEntry<RegistryValueMap[K]> | undefined {
    const list = branch(kind);
    const existing = list.filter(entry => entry.name === name);
    if (existing.length > 0) {
      if (!meta.override) {
        report(createError('plugin-conflict', `"${name}" is already registered in ${kind}`, undefined, name));
        return undefined;
      }
      for (const old of existing) old.disabled = true;
    }
    const entry: RegistryEntry<RegistryValueMap[K]> = {
      kind,
      name,
      plugin: meta.plugin,
      priority: meta.priority,
      builtin: meta.builtin,
      disabled: false,
      value,
    };
    list.push(entry);
    return entry;
  }

  function winning<K extends RegistryKind>(kind: K, name: string): RegistryEntry<RegistryValueMap[K]> | undefined {
    const candidates = (branch(kind) as RegistryEntry<RegistryValueMap[K]>[]).filter(entry => entry.name === name);
    let best: RegistryEntry<RegistryValueMap[K]> | undefined;
    for (const entry of candidates) {
      if (entry.disabled) continue;
      if (!best || entry.priority >= best.priority) best = entry;
    }
    return best;
  }

  function use(raw: PluginDefinition | Plugin, useOptions: UsePluginOptions = {}): boolean {
    const plugin: PluginDefinition = normalizePlugin(raw);
    const builtin = useOptions.builtin ?? false;
    if (!plugin.name) return report(createError('invalid-node', 'Plugin name is required'));
    if (!builtin && !isNamespacedName(plugin.name)) {
      return report(
        createError('plugin-conflict', `Third-party plugin "${plugin.name}" must be namespaced vendor:name`),
      );
    }
    if (!satisfiesEngine(plugin.engine ?? '^1.0.0')) {
      return report(createError('plugin-incompatible', `Plugin "${plugin.name}" requires engine ${plugin.engine}`));
    }
    for (const requirement of plugin.requires ?? []) {
      if (!plugins.has(requirement)) {
        return report(createError('plugin-incompatible', `Plugin "${plugin.name}" requires missing plugin "${requirement}"`));
      }
    }
    if (plugins.has(plugin.name) && !plugin.override && !useOptions.override) {
      return report(createError('plugin-conflict', `Plugin "${plugin.name}" is already registered`));
    }

    plugins.set(plugin.name, plugin);
    const basePriority = builtin ? 0 : 10 + priorityCounter++;

    for (const kind of Object.keys(plugin.provides ?? {}) as RegistryKind[]) {
      const provided = plugin.provides?.[kind] as Record<string, RegistryValueMap[RegistryKind]> | undefined;
      if (!provided) continue;
      for (const [name, value] of Object.entries(provided)) {
        if (!builtin && !isNamespacedName(name) && kind !== 'moods' && kind !== 'ambience' && kind !== 'surfaces') {
          report(
            createError('plugin-conflict', `Type "${name}" from "${plugin.name}" must be namespaced vendor:name`, undefined, name),
          );
          continue;
        }
        insertEntry(kind, name, value as RegistryValueMap[typeof kind], {
          plugin: plugin.name,
          builtin,
          priority: basePriority,
          override: plugin.override || useOptions.override,
        });
      }
    }

    if (plugin.install) {
      try {
        plugin.install({ registry: publicApi, onError: options.onError as ((error: unknown) => void) | undefined });
      } catch (error) {
        options.onError?.(
          createError('plugin-incompatible', `Plugin "${plugin.name}" install failed: ${String(error)}`),
        );
      }
    }
    return true;
  }

  function register<K extends RegistryKind>(
    kind: K,
    name: string,
    value: RegistryValueMap[K],
    registerOptions: { plugin?: string; override?: boolean } = {},
  ): void {
    insertEntry(kind, name, value, {
      plugin: registerOptions.plugin ?? 'host',
      builtin: false,
      priority: registerOptions.override ? 1000 : 500,
      override: registerOptions.override ?? true,
    });
  }

  function getEntry<K extends RegistryKind>(kind: K, name: string): RegistryEntry<RegistryValueMap[K]> | undefined {
    return winning(kind, name) as RegistryEntry<RegistryValueMap[K]> | undefined;
  }

  function get<K extends RegistryKind>(kind: K, name: string): RegistryValueMap[K] | undefined {
    return winning(kind, name)?.value;
  }

  function getManifest(type: string): TypeManifest | undefined {
    const value = get('blocks', type);
    return value as TypeManifest | undefined;
  }

  function registerLoader(type: string, loader: () => unknown): void {
    loaders.set(type, loader);
  }

  function getLoader(type: string): (() => unknown) | undefined {
    const registered = loaders.get(type);
    if (registered) return registered;
    return get('blocks', type)?.load;
  }

  function resolve(type: string, props: unknown): ResolvedNode {
    const manifest = getManifest(type);
    if (!manifest) {
      const err = createError('unknown-type', `Unknown block type: ${type}`, (props as { id?: string })?.id, type);
      options.onError?.(err);
      return { valid: false, error: err };
    }

    const parseResult = manifest.schema.safeParse(props);
    if (!parseResult.success) {
      const err = createError('invalid-node', parseResult.error.message, (props as { id?: string })?.id, type);
      options.onError?.(err);
      return { valid: false, error: err };
    }

    return { valid: true, manifest, loader: getLoader(type) };
  }

  function getCapabilities(): string[] {
    return getEnabled('blocks');
  }

  function getEnabled(kind: RegistryKind): string[] {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const entry of branch(kind)) {
      if (entry.disabled || seen.has(entry.name)) continue;
      seen.add(entry.name);
      names.push(entry.name);
    }
    return names;
  }

  function override<K extends RegistryKind>(kind: K, name: string, value: RegistryValueMap[K]): void {
    insertEntry(kind, name, value, { plugin: 'host', builtin: false, priority: 1000, override: true });
  }

  function disable(name: string): void {
    const plugin = plugins.get(name);
    if (plugin) {
      for (const kind of Object.keys(plugin.provides ?? {}) as RegistryKind[]) {
        const provided = plugin.provides?.[kind] as Record<string, unknown> | undefined;
        if (!provided) continue;
        for (const entry of branch(kind)) {
          if (entry.name in provided) entry.disabled = true;
        }
      }
    }
    for (const kind of Object.keys(KIND_ORDER) as RegistryKind[]) {
      for (const entry of branch(kind)) if (entry.name === name) entry.disabled = true;
    }
  }

  function enable(name: string): void {
    const plugin = plugins.get(name);
    if (plugin) {
      for (const kind of Object.keys(plugin.provides ?? {}) as RegistryKind[]) {
        const provided = plugin.provides?.[kind] as Record<string, unknown> | undefined;
        if (!provided) continue;
        for (const entry of branch(kind)) {
          if (entry.name in provided) entry.disabled = false;
        }
      }
    }
    for (const kind of Object.keys(KIND_ORDER) as RegistryKind[]) {
      for (const entry of branch(kind)) if (entry.name === name) entry.disabled = false;
    }
  }

  function list(kind?: RegistryKind): RegistryEntry[] {
    const kinds = kind ? [kind] : (Object.keys(KIND_ORDER) as RegistryKind[]);
    const out: RegistryEntry[] = [];
    for (const k of kinds) out.push(...branch(k));
    return out.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  }

  function listValues<K extends RegistryKind>(kind: K): RegistryValueMap[K][] {
    const seen = new Set<string>();
    const out: RegistryValueMap[K][] = [];
    for (const entry of list(kind)) {
      if (entry.disabled || seen.has(entry.name)) continue;
      seen.add(entry.name);
      out.push(entry.value as RegistryValueMap[K]);
    }
    return out;
  }

  const publicApi: Registry = {
    plugins,
    getManifest,
    registerLoader,
    getLoader,
    resolve,
    getCapabilities,
    use,
    override,
    disable,
    enable,
    disableEntry: (kind, name) => {
      for (const entry of branch(kind)) if (entry.name === name) entry.disabled = true;
    },
    enableEntry: (kind, name) => {
      for (const entry of branch(kind)) if (entry.name === name) entry.disabled = false;
    },
    list,
    listValues,
    get,
    getEntry,
    register,
    registerMood: mood => register('moods', mood.name, mood, { override: true }),
    getMood: name => get('moods', name),
    listMoods: () => listValues('moods'),
    registerAmbience: preset => register('ambience', preset.name, { ...preset, description: preset.description ?? '' } as AmbiencePresetEntry, { override: true }),
    getAmbience: name => get('ambience', name),
    listAmbience: () => listValues('ambience'),
    registerSurface: preset => register('surfaces', preset.name, { ...preset, description: preset.description ?? '' } as SurfacePresetEntry, { override: true }),
    getSurface: name => get('surfaces', name),
    listSurfaces: () => listValues('surfaces'),
    listModelConnectors: () => listValues('modelConnectors'),
    listMiddleware: () =>
      listValues('middleware')
        .slice()
        .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100)),
  };

  // Register built-ins through the same public path (dogfooding §8).
  for (const plugin of DEFAULT_PLUGINS) {
    if (options.replace && plugin.name === THEME_PLUGIN.name) continue;
    use(plugin, { builtin: true });
  }

  if (options.replace) {
    for (const mood of options.moodPresets ?? []) register('moods', mood.name, mood, { plugin: 'host' });
    for (const preset of options.ambiencePresets ?? []) register('ambience', preset.name, { ...preset, description: preset.description ?? '' } as AmbiencePresetEntry, { plugin: 'host' });
    for (const preset of options.surfacePresets ?? []) register('surfaces', preset.name, { ...preset, description: preset.description ?? '' } as SurfacePresetEntry, { plugin: 'host' });
  } else {
    for (const mood of options.moodPresets ?? []) publicApi.registerMood(mood);
    for (const preset of options.ambiencePresets ?? []) publicApi.registerAmbience(preset);
    for (const preset of options.surfacePresets ?? []) publicApi.registerSurface(preset);
  }

  return publicApi;
}

function normalizePlugin(plugin: PluginDefinition | Plugin): PluginDefinition {
  if ('provides' in plugin) return plugin;
  const legacy = plugin as Plugin;
  return definePlugin({
    name: legacy.name,
    version: legacy.version,
    provides: { blocks: legacy.types as Record<string, BlockDefinition> },
  });
}
