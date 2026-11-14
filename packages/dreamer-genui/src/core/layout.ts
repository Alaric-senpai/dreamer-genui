import type { LayoutSpec, Slot } from '../schema/layout';
import type { LayoutDefinition, RegistryKind } from './plugin';
import type { Registry } from './registry';

/**
 * Layout model (§6.4). Turns a `LayoutSpec` into regions, a primary region and
 * a narrow-screen collapse order. Pure and renderer-independent: the React
 * layer uses this to place slots and to animate re-flow; tests use it directly.
 */

export interface LayoutModel {
  spec: LayoutSpec;
  kind: LayoutSpec['kind'];
  /** Slots this layout defines, in reading order. */
  regions: Slot[];
  /** Region unslotted nodes flow into. */
  primary: Slot;
  /** Narrow-container behavior. */
  narrow: 'stack' | 'tabs';
  /** Region order when a split/stage collapses on a narrow container. */
  narrowOrder: Slot[];
  /** Split column order before RTL mirroring. */
  visualOrder: Slot[];
  gap?: string;
  ratio?: string;
  sides?: 'left-right' | 'right-left';
  pin?: 'left' | 'right' | 'none';
  columns?: number;
  narrowColumns?: number;
  align?: 'start' | 'center';
  /** Registry definition that supplied the regions (host/plugin layouts). */
  definition?: LayoutDefinition;
}

export interface LayoutNodeLike {
  id: string;
  slot?: Slot;
  span?: 1 | 2 | 3 | 4 | 'full';
}

export interface SlotAssignment {
  /** Node ids per region, preserving board order. */
  regions: Record<Slot, string[]>;
  /** Nodes whose requested slot does not exist in this layout. */
  fallbacks: Array<{ id: string; requested: Slot; used: Slot }>;
  /** Nodes with no slot, in board order. */
  unslotted: string[];
}

const ALL_SLOTS: Slot[] = ['left', 'right', 'top', 'bottom', 'center'];

function uniqueSlots(slots: Slot[]): Slot[] {
  const seen = new Set<Slot>();
  const out: Slot[] = [];
  for (const slot of slots) {
    if (seen.has(slot)) continue;
    seen.add(slot);
    out.push(slot);
  }
  return out;
}

/** Built-in region model for a spec (before registry overrides). */
function builtInModel(spec: LayoutSpec): LayoutModel {
  switch (spec.kind) {
    case 'split': {
      const sides = spec.sides ?? 'left-right';
      const visualOrder: Slot[] = sides === 'right-left' ? ['right', 'left'] : ['left', 'right'];
      const narrowOrder: Slot[] =
        spec.narrowOrder === 'right-first' ? ['right', 'left'] : ['left', 'right'];
      return {
        spec,
        kind: spec.kind,
        regions: ['left', 'right'],
        primary: visualOrder[0] ?? 'left',
        narrow: spec.narrow ?? 'stack',
        narrowOrder,
        visualOrder,
        gap: spec.gap,
        ratio: spec.ratio,
        sides,
        pin: spec.pin,
      };
    }
    case 'stage': {
      const regions = uniqueSlots(spec.regions ?? ALL_SLOTS);
      const narrowOrder = (['top', 'left', 'center', 'right', 'bottom'] as Slot[]).filter(slot =>
        regions.includes(slot),
      );
      return {
        spec,
        kind: spec.kind,
        regions,
        primary: regions.includes('center') ? 'center' : (regions[0] ?? 'center'),
        narrow: 'stack',
        narrowOrder,
        visualOrder: regions,
      };
    }
    case 'grid':
      return {
        spec,
        kind: spec.kind,
        regions: ['center'],
        primary: 'center',
        narrow: 'stack',
        narrowOrder: ['center'],
        visualOrder: ['center'],
        columns: spec.columns ?? 2,
        narrowColumns: spec.narrowColumns ?? 1,
        gap: spec.gap,
      };
    case 'flow':
    default:
      return {
        spec,
        kind: 'flow',
        regions: ['center'],
        primary: 'center',
        narrow: 'stack',
        narrowOrder: ['center'],
        visualOrder: ['center'],
        gap: spec.kind === 'flow' ? spec.gap : undefined,
        align: spec.kind === 'flow' ? spec.align : undefined,
      };
  }
}

/**
 * Resolve a layout spec, letting a registered layout definition supply regions
 * (hosts and plugins can register custom layouts via `defineLayout`). Unknown
 * slots in a definition are dropped with a warning-free fallback (§6.4: never
 * fatal).
 */
export function createLayoutModel(spec: LayoutSpec, registry?: Registry): LayoutModel {
  const base = builtInModel(spec);
  const definition = registry?.get('layouts', spec.kind) as LayoutDefinition | undefined;
  if (!definition) return base;

  const regions = uniqueSlots(definition.regions.filter(slot => ALL_SLOTS.includes(slot)));
  if (regions.length === 0) return base;
  const primary = regions.includes(definition.primary) ? definition.primary : regions[0]!;
  const narrow = definition.narrow ?? base.narrow;
  const narrowOrder = narrow === 'stack' ? base.narrowOrder.filter(slot => regions.includes(slot)) : base.narrowOrder.filter(slot => regions.includes(slot));
  return {
    ...base,
    regions,
    primary,
    narrow,
    narrowOrder: narrowOrder.length > 0 ? narrowOrder : regions,
    visualOrder: base.visualOrder.filter(slot => regions.includes(slot)).length
      ? base.visualOrder.filter(slot => regions.includes(slot))
      : regions,
    definition,
  };
}

/**
 * Assign nodes to regions. A node whose `slot` the layout does not define
 * falls back to the primary region (never fatal, §6.4); unslotted nodes flow
 * into the primary region.
 */
export function assignSlots(nodes: LayoutNodeLike[], model: LayoutModel): SlotAssignment {
  const regions: Record<Slot, string[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
    center: [],
  };
  const fallbacks: SlotAssignment['fallbacks'] = [];
  const unslotted: string[] = [];

  for (const node of nodes) {
    if (node.slot === undefined) {
      unslotted.push(node.id);
      regions[model.primary].push(node.id);
      continue;
    }
    if (model.regions.includes(node.slot)) {
      regions[node.slot].push(node.id);
      continue;
    }
    fallbacks.push({ id: node.id, requested: node.slot, used: model.primary });
    regions[model.primary].push(node.id);
  }

  return { regions, fallbacks, unslotted };
}

/** Regions in the order they stack on a narrow container. */
export function narrowRegions(model: LayoutModel): Slot[] {
  return model.narrow === 'tabs' ? model.regions : model.narrowOrder;
}

/** The region that visually comes first in reading order (pre-RTL). */
export function leadingRegion(model: LayoutModel): Slot {
  return model.visualOrder[0] ?? model.primary;
}

/** Total grid columns for a grid layout; 1 otherwise. */
export function gridColumns(model: LayoutModel, narrow = false): number {
  if (model.kind !== 'grid') return 1;
  return narrow ? (model.narrowColumns ?? 1) : (model.columns ?? 2);
}

/** True when a layout defines the slot (used by the validator's slot check). */
export function layoutDefinesSlot(model: LayoutModel, slot: Slot): boolean {
  return model.regions.includes(slot);
}

/** Registry branch name for layout definitions; exported for helpers. */
export const LAYOUT_REGISTRY_KIND: RegistryKind = 'layouts';
