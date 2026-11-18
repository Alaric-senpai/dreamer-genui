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
  card: defineComponentMeta({
    name: 'card',
    parts: ['root', 'media', 'body', 'title', 'description', 'content', 'footer'],
    tokens: ['--dg-color-surface', '--dg-color-border', '--dg-color-ink', '--dg-color-muted', '--dg-radius-lg', '--dg-card-accent'],
    variants: ['plain', 'outlined', 'elevated', 'accent', 'interactive'],
    dataAttrs: ['data-node-id', 'data-interactive'],
    events: ['select'],
    effects: ['reveal', 'rise', 'pop', 'wipe', 'none'],
  }),
  alert: defineComponentMeta({
    name: 'alert',
    parts: ['root', 'icon', 'body', 'title', 'content', 'dismiss'],
    tokens: ['--dg-alert-color', '--dg-color-info', '--dg-color-success', '--dg-color-warn', '--dg-color-danger', '--dg-radius-md', '--dg-min-target'],
    variants: ['info', 'success', 'warn', 'danger', 'dismissible'],
    dataAttrs: ['data-node-id'],
    events: ['action'],
    effects: ['reveal', 'rise', 'pop', 'none'],
  }),
  accordion: defineComponentMeta({
    name: 'accordion',
    parts: ['root', 'item', 'header', 'trigger', 'title', 'indicator', 'content', 'body'],
    tokens: ['--dg-color-border', '--dg-color-surface', '--dg-color-ink', '--dg-color-accent', '--dg-radius-md', '--dg-min-target'],
    variants: ['single', 'multiple', 'open', 'closed'],
    dataAttrs: ['data-node-id', 'data-state'],
    events: ['action'],
    effects: ['reveal', 'rise', 'none'],
  }),
  collapsible: defineComponentMeta({
    name: 'collapsible',
    parts: ['root', 'trigger', 'title', 'indicator', 'content', 'body'],
    tokens: ['--dg-color-border', '--dg-color-surface', '--dg-color-ink', '--dg-color-accent', '--dg-radius-md', '--dg-min-target'],
    variants: ['open', 'closed'],
    dataAttrs: ['data-node-id', 'data-state'],
    events: ['action'],
    effects: ['reveal', 'rise', 'none'],
  }),
  tabs: defineComponentMeta({
    name: 'tabs',
    parts: ['root', 'list', 'trigger', 'panel', 'body'],
    tokens: ['--dg-color-border', '--dg-color-surface', '--dg-color-ink', '--dg-color-accent', '--dg-radius-md', '--dg-min-target'],
    variants: ['active', 'inactive'],
    dataAttrs: ['data-node-id', 'data-state'],
    events: ['select'],
    effects: ['reveal', 'rise', 'none'],
  }),
  badge: defineComponentMeta({
    name: 'badge',
    parts: ['root', 'text'],
    tokens: ['--dg-badge-color', '--dg-color-accent', '--dg-color-info', '--dg-color-success', '--dg-color-warn', '--dg-color-danger', '--dg-color-muted'],
    variants: ['accent', 'info', 'success', 'warn', 'danger', 'muted'],
    dataAttrs: ['data-node-id'],
    events: [],
    effects: ['pop', 'reveal', 'none'],
  }),
  progress: defineComponentMeta({
    name: 'progress',
    parts: ['root', 'track', 'fill', 'ring', 'ringTrack', 'ringFill', 'value', 'label'],
    tokens: ['--dg-progress-color', '--dg-color-accent', '--dg-color-surface', '--dg-color-border', '--dg-progress-duration'],
    variants: ['bar', 'ring', 'pill', 'indeterminate'],
    dataAttrs: ['data-node-id', 'aria-valuenow'],
    events: [],
    effects: ['reveal', 'draw', 'none'],
  }),
  counter: defineComponentMeta({
    name: 'counter',
    parts: ['root', 'value', 'label'],
    tokens: ['--dg-counter-size', '--dg-color-accent', '--dg-color-ink', '--dg-counter-duration'],
    variants: ['number', 'percent', 'time', 'currency'],
    dataAttrs: ['data-node-id', 'data-format'],
    events: [],
    effects: ['count-up', 'pop', 'none'],
  }),
  avatar: defineComponentMeta({
    name: 'avatar',
    parts: ['root', 'image', 'fallback'],
    tokens: ['--dg-avatar-size', '--dg-color-surface', '--dg-color-ink', '--dg-radius-full'],
    variants: ['xs', 'sm', 'md', 'lg', 'xl'],
    dataAttrs: ['data-node-id'],
    events: [],
    effects: ['pop', 'reveal', 'none'],
  }),
  separator: defineComponentMeta({
    name: 'separator',
    parts: ['root', 'line', 'label'],
    tokens: ['--dg-color-border', '--dg-color-muted', '--dg-text-small'],
    variants: ['horizontal', 'vertical', 'labelled'],
    dataAttrs: ['data-node-id', 'aria-orientation'],
    events: [],
    effects: ['wipe', 'reveal', 'none'],
  }),
  carousel: defineComponentMeta({
    name: 'carousel',
    parts: ['root', 'viewport', 'slide', 'controls', 'previous', 'dots', 'dot', 'next'],
    tokens: ['--dg-color-surface', '--dg-color-border', '--dg-color-accent', '--dg-min-target', '--dg-carousel-duration'],
    variants: ['manual', 'auto'],
    dataAttrs: ['data-node-id', 'data-active'],
    events: ['select'],
    effects: ['reveal', 'rise', 'none'],
  }),
  kbd: defineComponentMeta({
    name: 'kbd',
    parts: ['root', 'key'],
    tokens: ['--dg-kbd-bg', '--dg-color-surface', '--dg-color-border', '--dg-color-ink', '--dg-radius-sm'],
    variants: ['single', 'combo'],
    dataAttrs: ['data-node-id'],
    events: [],
    effects: ['pop', 'reveal', 'none'],
  }),
  board: defineComponentMeta({
    name: 'board',
    parts: ['root', 'camera', 'content', 'title', 'skip', 'live-region', 'status', 'empty', 'camera-reset'],
    tokens: ['--dg-color-bg', '--dg-color-surface', '--dg-color-ink', '--dg-theme-duration', '--dg-theme-ease', '--dg-density-scale', '--dg-min-target'],
    variants: ['camera-auto', 'camera-off', 'recede', 'detour-open', 'compact', 'comfortable', 'large', 'thinking', 'listening', 'speaking', 'exam'],
    dataAttrs: ['data-dg-mood', 'data-dg-surface', 'data-dg-layout', 'data-dg-narrow', 'data-dg-detour-open', 'data-dg-density', 'data-dg-status', 'data-dg-camera', 'data-dg-camera-controls', 'data-dg-camera-user', 'data-dg-ambience', 'data-dg-exam'],
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
  annotation: defineComponentMeta({
    name: 'annotation',
    parts: ['root', 'stroke', 'annotated'],
    tokens: ['--dg-color-accent', '--dg-annotation-color'],
    variants: ['circle', 'underline', 'box', 'bracket', 'strike'],
    dataAttrs: ['data-dg-part', 'data-dg-kind'],
    events: [],
    effects: ['draw'],
  }),
  figure: defineComponentMeta({
    name: 'figure',
    parts: ['root', 'surface', 'nodes', 'node', 'node-label', 'edges', 'edge', 'edge-label', 'lane', 'caption', 'poster', 'fallback'],
    tokens: ['--dg-figure-line', '--dg-figure-node-bg', '--dg-color-accent', '--dg-color-ink', '--dg-color-muted', '--dg-radius-md'],
    variants: ['image', 'icon', 'diagram', 'flowchart', 'timeline', 'labeled', 'chart', 'lottie'],
    dataAttrs: ['data-node-id', 'data-dg-figure', 'data-dg-part', 'data-dg-shape', 'data-dg-ref', 'data-dg-active'],
    events: ['focus', 'select', 'action'],
    effects: ['draw', 'reveal', 'rise', 'stagger'],
  }),
  compare: defineComponentMeta({
    name: 'compare',
    parts: ['root', 'column', 'column-title', 'item', 'row'],
    tokens: ['--dg-color-border', '--dg-color-accent', '--dg-color-surface', '--dg-radius-md'],
    variants: ['highlight-col', 'highlight-row'],
    dataAttrs: ['data-node-id', 'data-dg-col', 'data-dg-row', 'data-dg-highlight'],
    events: [],
    effects: [],
  }),
} as const satisfies Record<string, ComponentMeta>;

/** Lookup form of {@link COMPONENT_META} used by docs and the conformance test. */
export const COMPONENT_REGISTRY: Record<string, ComponentMeta> = { ...COMPONENT_META };
