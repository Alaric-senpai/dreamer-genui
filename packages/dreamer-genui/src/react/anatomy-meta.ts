/**
 * Static component metadata (§8.5, "Customization Surface").
 *
 * This module is intentionally free of React and of component imports: both
 * the components and the runtime anatomy helpers (`anatomy.tsx`) import it, so
 * it must stay a leaf. `anatomy.tsx` re-exports everything here as part of the
 * public anatomy contract.
 */

/** Static customization surface of one built-in component (§8.5.1). */
export interface ComponentMeta {
  /** Registry-style component name (override key in the `components` map). */
  name: string;
  /** Named parts, each rendered with `data-dg-part` + `dg-<name>-<part>`. */
  parts: string[];
  /** Component tokens the component reads (`--dg-<name>-<token>`). */
  tokens: string[];
  /** Variant hooks (data-dg-variant / data-color / etc.). */
  variants: string[];
  /** Extra data-* attributes hosts can key off. */
  dataAttrs: string[];
  /** UIEvent names the component can emit. */
  events: string[];
  /** Enter/emphasis effects the component plays by default. */
  effects: string[];
}

/** `defineComponentMeta` is identity today; it future-proofs the shape. */
export function defineComponentMeta(meta: ComponentMeta): ComponentMeta {
  return meta;
}

/**
 * Metadata for every built-in component, keyed by its registry name. These
 * names are stable: they are both the `components` override key and the
 * prefix of every part class (`dg-<name>-<part>`). Kept in one place so the
 * docs generator and the conformance test can never drift from the code.
 */
export const COMPONENT_META = {
  text: defineComponentMeta({
    name: 'text',
    parts: ['root'],
    tokens: ['--dg-text-hero', '--dg-text-heading', '--dg-text-body', '--dg-text-kicker', '--dg-text-small', '--dg-color-ink'],
    variants: ['hero', 'heading', 'kicker', 'quote', 'definition', 'body', 'note'],
    dataAttrs: ['data-node-id', 'data-dg-variant'],
    events: [],
    effects: ['words', 'chars', 'lines', 'slam', 'wipe', 'typewriter', 'reveal', 'rise', 'pop', 'sweep', 'draw', 'stagger', 'none'],
  }),
  choices: defineComponentMeta({
    name: 'choices',
    parts: ['root', 'prompt', 'item', 'item-icon', 'item-label', 'item-caption'],
    tokens: ['--dg-color-border', '--dg-color-accent', '--dg-color-surface', '--dg-color-ink', '--dg-radius-md', '--dg-min-target'],
    variants: ['chips', 'list', 'grid', 'selected'],
    dataAttrs: ['data-node-id', 'data-dg-target', 'data-ref', 'aria-pressed'],
    events: ['select', 'answer'],
    effects: [],
  }),
  callout: defineComponentMeta({
    name: 'callout',
    parts: ['root', 'title', 'content'],
    tokens: ['--dg-callout-color', '--dg-color-info', '--dg-color-success', '--dg-color-warn', '--dg-color-danger', '--dg-radius-md'],
    variants: ['info', 'success', 'warn', 'danger'],
    dataAttrs: ['data-node-id'],
    events: [],
    effects: [],
  }),
  steps: defineComponentMeta({
    name: 'steps',
    parts: ['root', 'item', 'number', 'title', 'content'],
    tokens: ['--dg-color-accent', '--dg-color-muted', '--dg-color-ink', '--dg-space-scale'],
    variants: ['sequential', 'all'],
    dataAttrs: ['data-node-id', 'data-dg-target'],
    events: [],
    effects: ['reveal', 'rise', 'stagger', 'none'],
  }),
  group: defineComponentMeta({
    name: 'group',
    parts: ['root'],
    tokens: ['--dg-group-gap', '--dg-group-direction', '--dg-group-align', '--dg-group-wrap', '--dg-group-justify', '--dg-group-columns', '--dg-group-min-width', '--dg-group-template'],
    variants: ['stack', 'row', 'grid'],
    dataAttrs: ['data-node-id', 'data-dg-reverse', 'data-dg-autofit'],
    events: [],
    effects: [],
  }),
  list: defineComponentMeta({
    name: 'list',
    parts: ['root', 'item', 'marker', 'content'],
    tokens: ['--dg-color-accent', '--dg-color-ink', '--dg-space-scale'],
    variants: ['bullet', 'number', 'check', 'none'],
    dataAttrs: ['data-node-id', 'data-dg-item-id'],
    events: [],
    effects: ['reveal', 'rise', 'stagger', 'none'],
  }),
  board: defineComponentMeta({
    name: 'board',
    parts: ['root', 'camera', 'content', 'title', 'skip', 'live-region', 'status', 'empty'],
    tokens: ['--dg-color-bg', '--dg-color-surface', '--dg-color-ink', '--dg-theme-duration', '--dg-theme-ease', '--dg-density-scale', '--dg-min-target'],
    variants: ['camera-auto', 'camera-off', 'recede', 'detour-open', 'compact', 'comfortable', 'large', 'thinking', 'listening', 'speaking'],
    dataAttrs: ['data-dg-mood', 'data-dg-surface', 'data-dg-layout', 'data-dg-narrow', 'data-dg-detour-open', 'data-dg-density', 'data-dg-status'],
    events: ['focus', 'select', 'answer', 'action', 'assessment'],
    effects: [],
  }),
  fallback: defineComponentMeta({
    name: 'fallback',
    parts: ['root', 'alt'],
    tokens: ['--dg-color-muted', '--dg-text-small'],
    variants: ['error', 'unknown-type'],
    dataAttrs: ['data-node-id', 'data-dg-part'],
    events: [],
    effects: [],
  }),
  layout: defineComponentMeta({
    name: 'layout',
    parts: ['tabs', 'tab', 'regions', 'region'],
    tokens: ['--dg-split-template', '--dg-grid-columns', '--dg-stage-areas', '--dg-stage-columns', '--dg-region-order', '--dg-gap-md'],
    variants: ['flow', 'split', 'grid', 'stage', 'collapsed'],
    dataAttrs: ['data-dg-layout-regions', 'data-dg-collapsed', 'data-slot', 'data-dg-pin', 'data-dg-region-active'],
    events: [],
    effects: [],
  }),
  detour: defineComponentMeta({
    name: 'detour',
    parts: ['root', 'blocks', 'return', 'return-icon', 'connector'],
    tokens: ['--dg-color-surface', '--dg-color-border', '--dg-color-ink', '--dg-radius-lg', '--dg-theme-duration'],
    variants: ['inline', 'drawer', 'spotlight'],
    dataAttrs: ['data-dg-detour', 'data-dg-placement'],
    events: ['action'],
    effects: ['reveal', 'rise', 'wipe', 'none'],
  }),
  ambience: defineComponentMeta({
    name: 'ambience',
    parts: ['root', 'texture', 'layer'],
    tokens: ['--dg-ambience-intensity', '--dg-color-accent'],
    variants: ['auto', 'lite', 'off'],
    dataAttrs: ['data-dg-ambience-mode', 'data-dg-ambience-preset', 'data-dg-ambience-kind', 'data-dg-ambience-state'],
    events: [],
    effects: [],
  }),
  node: defineComponentMeta({
    name: 'node',
    parts: ['root', 'inner'],
    tokens: [],
    variants: ['complete', 'error'],
    dataAttrs: ['data-node-id', 'data-dg-state', 'data-dg-span', 'data-dg-receded', 'data-dg-detour-target'],
    events: [],
    effects: [],
  }),
} as const satisfies Record<string, ComponentMeta>;

/** Lookup form of {@link COMPONENT_META} used by docs and the conformance test. */
export const COMPONENT_REGISTRY: Record<string, ComponentMeta> = { ...COMPONENT_META };
