import { Fragment, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Slot } from '../../schema/layout';
import type { Node } from '../../core/types';
import {
  narrowRegions,
  gridColumns,
  type LayoutModel,
  type SlotAssignment,
} from '../../core/layout';
import { useParts } from '../anatomy';

/**
 * Layout engine render side (§6.4). Consumes the pure layout model
 * (`core/layout.ts`) and turns it into region containers. All geometry is
 * expressed as `--dg-*` custom properties + data attributes; the stylesheet
 * owns the flex/grid. No raw CSS from the model, ever.
 */

/**
 * Container width below which split/stage collapse (§6.4 narrow). Measured on
 * the board's own element (not the window), so the board re-composes inside
 * any host container.
 */
export const NARROW_BREAKPOINT = 640;

/** Narrow detection; pure and unit-testable. Width 0 (unmeasured) is never narrow. */
export function isNarrow(width: number, breakpoint = NARROW_BREAKPOINT): boolean {
  return width > 0 && width < breakpoint;
}

/** Split `ratio` token → `grid-template-columns` track sizes. */
export function splitTemplate(ratio: string | undefined): string {
  switch (ratio) {
    case '2:1': return '2fr 1fr';
    case '1:2': return '1fr 2fr';
    case '3:2': return '3fr 2fr';
    case '2:3': return '2fr 3fr';
    case '1:1':
    default: return '1fr 1fr';
  }
}

/**
 * Stage regions → grid template areas. The middle row holds the horizontal
 * slots present; top/bottom span the full width. Empty `left`/`right` tracks
 * collapse so e.g. only `['center', 'top']` still composes sensibly.
 */
export function stageTemplate(regions: Slot[]): { areas: string; columns: number } {
  const has = (slot: Slot): boolean => regions.includes(slot);
  const mid: Slot[] = [];
  if (has('left')) mid.push('left');
  mid.push('center');
  if (has('right')) mid.push('right');
  const columns = mid.length;

  const rows: string[] = [];
  if (has('top')) rows.push(new Array(columns).fill('top').join(' '));
  rows.push(mid.join(' '));
  if (has('bottom')) rows.push(new Array(columns).fill('bottom').join(' '));
  return { areas: rows.map(row => `"${row}"`).join(' '), columns };
}

/**
 * Node-base props are flattened onto the block (§6.2); placement reads them
 * there. Region membership comes from `assignSlots`, so a slot the layout
 * does not define has already fallen back to the primary region upstream.
 */
function nodeSlot(node: Node | undefined): Slot | undefined {
  return (node?.block as { slot?: Slot } | undefined)?.slot;
}

function nodeSpan(node: Node | undefined): number | 'full' | undefined {
  return (node?.block as { span?: number | 'full' } | undefined)?.span;
}

export interface LayoutRegionsProps {
  model: LayoutModel;
  /** Entered node ids in board order. */
  orderedIds: string[];
  /** All board nodes by id (for placement props). */
  nodes: Record<string, Node>;
  /** Precomputed slot assignment (the Board also uses it for region receding). */
  assignment: SlotAssignment;
  narrow: boolean;
  /** Render one top-level node (region-local index for motion sequencing). */
  renderNode: (id: string, index: number) => ReactNode;
  /** Optional inline (flow) detour; rendered after its anchor node, or at the
   * end of the flow when its target has not entered (`null`). */
  renderFlowDetour?: (afterNodeId: string | null) => ReactNode;
}

/**
 * Region containers for the active layout. A region preserves board order
 * within itself; `flow` renders its single region flat so the default
 * single-column board keeps its existing DOM contract
 * (`.dg-board-content > .dg-node`).
 */
export function LayoutRegions({
  model,
  orderedIds,
  nodes,
  assignment,
  narrow,
  renderNode,
  renderFlowDetour,
}: LayoutRegionsProps): ReactNode {
  const p = useParts('layout');
  const narrowOrder = useMemo(() => narrowRegions(model), [model]);
  const collapsed = narrow && model.kind !== 'flow';

  // Tabs collapse (§6.4 narrow: "tabs", split only): the active region is
  // local state; the tab bar is a named part hosts can restyle or replace.
  const [activeTab, setActiveTab] = useState<Slot | null>(null);
  const tabsActive = collapsed && model.narrow === 'tabs' && model.regions.length > 1;
  const visibleTab = activeTab ?? model.primary;

  // Grid spans become an inline style on a per-node wrapper (only where the
  // layout needs one); everything else stays attribute/CSS driven.
  const spanStyle = (id: string): CSSProperties | undefined => {
    if (model.kind !== 'grid') return undefined;
    const span = nodeSpan(nodes[id]);
    if (span === undefined) return undefined;
    return span === 'full' ? { gridColumn: '1 / -1' } : { gridColumn: `span ${span}` };
  };

  const renderRegion = (slot: Slot): ReactNode => {
    const ids = assignment.regions[slot] ?? [];
    const orderIndex = narrowOrder.indexOf(slot);
    const pinned =
      collapsed && model.pin !== undefined && model.pin !== 'none' && model.pin === slot;
    const regionPart = p.props('region', `dg-region dg-region-${slot}`);
    return (
      <div
        key={slot}
        {...regionPart}
        data-slot={slot}
        style={{ '--dg-region-order': orderIndex === -1 ? narrowOrder.length : orderIndex, ...regionPart.style } as CSSProperties}
        data-dg-pin={pinned ? 'true' : undefined}
        data-dg-region-active={tabsActive ? (visibleTab === slot || undefined) : undefined}
      >
        {ids.map((id, i) => {
          const node = (
            <Fragment key={id}>
              {renderNode(id, i)}
              {renderFlowDetour?.(id)}
            </Fragment>
          );
          const style = spanStyle(id);
          return style ? (
            <div key={id} className="dg-region-entry" style={style}>
              {renderNode(id, i)}
              {renderFlowDetour?.(id)}
            </div>
          ) : (
            node
          );
        })}
      </div>
    );
  };

  if (model.kind === 'flow') {
    return (
      <>
        {orderedIds.map((id, i) => (
          <Fragment key={id}>
            {renderNode(id, i)}
            {renderFlowDetour?.(id)}
          </Fragment>
        ))}
        {/* A flow detour whose target has not entered still renders, at the end. */}
        {renderFlowDetour?.(null)}
      </>
    );
  }

  const regionsStyle: CSSProperties | undefined = (() => {
    switch (model.kind) {
      case 'split':
        return collapsed ? undefined : ({ '--dg-split-template': splitTemplate(model.ratio) } as CSSProperties);
      case 'grid':
        return { '--dg-grid-columns': gridColumns(model, collapsed) } as CSSProperties;
      case 'stage':
        return collapsed
          ? undefined
          : (() => {
              const { areas, columns } = stageTemplate(model.regions);
              return { '--dg-stage-areas': areas, '--dg-stage-columns': String(columns) } as CSSProperties;
            })();
      default:
        return undefined;
    }
  })();

  const visibleSlots = tabsActive ? model.regions.filter(slot => visibleTab === slot) : narrowOrder;
  const regionsPart = p.props('regions', 'dg-layout-regions');

  return (
    <>
      {tabsActive && (
        // TODO(M4b-C2): tab labels belong to the strings registry so locales
        // can name regions; C1 keeps the structural part only.
        <div {...p.props('tabs', 'dg-layout-tabs')} role="tablist">
          {model.regions.map(slot => (
            <button
              key={slot}
              type="button"
              role="tab"
              aria-selected={visibleTab === slot}
              {...p.props('tab', `dg-layout-tab${visibleTab === slot ? ' dg-layout-tab-active' : ''}`)}
              onClick={() => setActiveTab(slot)}
            >
              {slot}
            </button>
          ))}
        </div>
      )}
      <div
        {...regionsPart}
        data-dg-layout-regions=""
        data-dg-collapsed={collapsed || undefined}
        style={regionsPart.style ? { ...regionsStyle, ...regionsPart.style } : regionsStyle}
      >
        {visibleSlots.map(renderRegion)}
      </div>
    </>
  );
}
