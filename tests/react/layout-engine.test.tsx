// @vitest-environment jsdom
import { describe, expect, test, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { Board } from '../../packages/dreamer-genui/src/react/board';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import { isNarrow, splitTemplate, stageTemplate, LayoutRegions } from '../../packages/dreamer-genui/src/react/layout/regions';
import { createLayoutModel, assignSlots } from '../../packages/dreamer-genui/src/core/layout';
import { validateOp } from '../../packages/dreamer-genui/src/core/validator';
import { createBoard } from '../../packages/dreamer-genui/src/core/reducer';
import type { Reply } from '../../packages/dreamer-genui/src/schema/envelope';
import type { Node } from '../../packages/dreamer-genui/src/core/types';
import type { Slot } from '../../packages/dreamer-genui/src/schema/layout';

import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

// --- pure helpers ---

describe('isNarrow', () => {
  test('width 0 (unmeasured) is never narrow', () => {
    expect(isNarrow(0)).toBe(false);
  });
  test('below the breakpoint is narrow, at/above is not', () => {
    expect(isNarrow(500)).toBe(true);
    expect(isNarrow(640)).toBe(false);
    expect(isNarrow(1000)).toBe(false);
  });
});

describe('splitTemplate', () => {
  test('maps ratio tokens to grid tracks', () => {
    expect(splitTemplate(undefined)).toBe('1fr 1fr');
    expect(splitTemplate('1:1')).toBe('1fr 1fr');
    expect(splitTemplate('2:1')).toBe('2fr 1fr');
    expect(splitTemplate('1:2')).toBe('1fr 2fr');
    expect(splitTemplate('3:2')).toBe('3fr 2fr');
    expect(splitTemplate('2:3')).toBe('2fr 3fr');
  });
});

describe('stageTemplate', () => {
  test('full stage: top row, middle row, bottom row', () => {
    const { areas, columns } = stageTemplate(['top', 'left', 'center', 'right', 'bottom']);
    expect(columns).toBe(3);
    expect(areas).toContain('"top top top"');
    expect(areas).toContain('"left center right"');
    expect(areas).toContain('"bottom bottom bottom"');
  });
  test('missing horizontal slots collapse the middle row', () => {
    const { areas, columns } = stageTemplate(['center', 'top']);
    expect(columns).toBe(1);
    expect(areas).toBe('"top" "center"');
  });
});

// --- validator slot warnings (§6.4: fallback with a warning, never fatal) ---

describe('validator slot-vs-layout warnings', () => {
  const board = createBoard();
  const text = (id: string, slot?: string) =>
    ({ id, type: 'text', variant: 'body', content: [id], ...(slot ? { slot } : {}) }) as never;

  test('slot the layout does not define yields a layout-invalid warning', () => {
    const result = validateOp(board, { op: 'append', blocks: [text('a', 'left')] });
    expect(result.valid).toBe(true);
    expect(result.warnings?.[0]?.code).toBe('layout-invalid');
    expect(result.warnings?.[0]?.nodeId).toBe('a');
  });

  test('no slot: no warning', () => {
    const result = validateOp(board, { op: 'append', blocks: [text('a')] });
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeUndefined();
  });

  test('slot defined by the active split layout: no warning', () => {
    const withSplit = { ...board, layout: { kind: 'split' } } as typeof board;
    const result = validateOp(withSplit, { op: 'append', blocks: [text('a', 'left')] });
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeUndefined();
  });

  test('replace ops are checked too', () => {
    const result = validateOp(board, { op: 'replace', blocks: [text('r1', 'bottom')] });
    expect(result.valid).toBe(true);
    expect(result.warnings?.[0]?.code).toBe('layout-invalid');
  });
});

// --- layoutBus (transition knobs travel to the renderer) ---

describe('resolver layoutBus', () => {
  test('layout ops emit their transition knobs', () => {
    const registry = createRegistry();
    const store = createBoardStore();
    const seen: Array<Record<string, unknown>> = [];
    const off = store.layoutBus.subscribe((t) => seen.push(t as Record<string, unknown>));
    store.applyOps({ v: 1, ops: [{ op: 'layout', layout: { kind: 'split' }, transition: { duration: 400, ease: 'snappy' } }] });
    off();
    expect(seen).toEqual([{ duration: 400, ease: 'snappy' }]);
  });
});

// --- rendered region structure ---

const SPLIT_REPLY: Reply = {
  v: 1,
  ops: [
    { op: 'layout', layout: { kind: 'split', ratio: '2:1' } },
    { op: 'append', blocks: [
      { id: 'explain', type: 'text', variant: 'body', content: ['Explanation side'], slot: 'left' },
      { id: 'ask', type: 'text', variant: 'heading', content: ['Question side'], slot: 'right' },
    ] },
  ],
} as unknown as Reply;

function setupBoard(reply: Reply) {
  const registry = createRegistry();
  const store = createBoardStore();
  store.applyFinal(reply);
  render(
    <DreamerProvider registry={registry}>
      <Board store={store} />
    </DreamerProvider>
  );
  return { store };
}

/** Board tests query by node id: kinetic text splitting breaks text matchers. */
function nodeEl(id: string): HTMLElement {
  const el = document.querySelector(`[data-node-id="${id}"]`);
  if (!el) throw new Error(`node not rendered: ${id}`);
  return el as HTMLElement;
}

describe('<Board> split layout', () => {
  test('renders regions with slot data attributes', () => {
    setupBoard(SPLIT_REPLY);
    const regions = document.querySelector('.dg-layout-regions');
    expect(regions).not.toBeNull();
    expect(regions).toHaveAttribute('data-dg-layout-regions');
    expect(nodeEl('explain').closest('.dg-region')).toHaveAttribute('data-slot', 'left');
    expect(nodeEl('ask').closest('.dg-region')).toHaveAttribute('data-slot', 'right');
  });

  test('split template and ratio travel as a custom property', () => {
    setupBoard(SPLIT_REPLY);
    const regions = document.querySelector('.dg-layout-regions') as HTMLElement;
    expect(regions.style.getPropertyValue('--dg-split-template')).toBe('2fr 1fr');
  });

  test('content element carries layout kind and is not narrow (unmeasured)', () => {
    setupBoard(SPLIT_REPLY);
    const content = document.querySelector('[data-dg-part="content"]') as HTMLElement;
    expect(content).toHaveAttribute('data-dg-layout', 'split');
    expect(content.getAttribute('data-dg-narrow')).toBeNull();
  });

  test('top-level nodes carry the board-node marker for re-flow/dimming', () => {
    setupBoard(SPLIT_REPLY);
    expect(nodeEl('explain')).toHaveAttribute('data-dg-board-node', 'true');
  });

  test('flow keeps the flat DOM contract: nodes sit directly in .dg-board-content', () => {
    setupBoard({ v: 1, ops: [{ op: 'append', blocks: [{ id: 'a', type: 'text', variant: 'body', content: ['plain'] }] }] } as Reply);
    const content = document.querySelector('[data-dg-part="content"]') as HTMLElement;
    expect(content).toHaveAttribute('data-dg-layout', 'flow');
    expect(content.querySelector(':scope > .dg-node')).not.toBeNull();
    expect(content.querySelector('.dg-layout-regions')).toBeNull();
  });
});

describe('<Board> grid layout with span', () => {
  test('spanning nodes render inside a track wrapper', () => {
    setupBoard({
      v: 1,
      ops: [
        { op: 'layout', layout: { kind: 'grid', columns: 2 } },
        { op: 'append', blocks: [
          { id: 'g1', type: 'text', variant: 'body', content: ['one'] },
          { id: 'g2', type: 'text', variant: 'body', content: ['two'] },
          { id: 'wide', type: 'text', variant: 'body', content: ['wide'], span: 'full' },
        ] },
      ],
    } as unknown as Reply);
    const entry = nodeEl('wide').closest('.dg-region-entry') as HTMLElement;
    expect(entry).not.toBeNull();
    expect(entry.style.getPropertyValue('grid-column')).toBe('1 / -1');
  });

  test('unspanned nodes are not wrapped', () => {
    setupBoard({
      v: 1,
      ops: [
        { op: 'layout', layout: { kind: 'grid' } },
        { op: 'append', blocks: [{ id: 'g1', type: 'text', variant: 'body', content: ['one'] }] },
      ],
    } as unknown as Reply);
    expect(nodeEl('g1').closest('.dg-region-entry')).toBeNull();
  });
});

describe('<Board> unknown slot falls back to the primary region', () => {
  test('node lands in the primary region (warning upstream, never fatal)', () => {
    setupBoard({
      v: 1,
      ops: [
        { op: 'layout', layout: { kind: 'split' } },
        { op: 'append', blocks: [{ id: 'top', type: 'text', variant: 'body', content: ['toppy'], slot: 'top' }] },
      ],
    } as unknown as Reply);
    // split defines left/right; 'top' falls back to the primary (left)
    expect(nodeEl('top').closest('.dg-region')).toHaveAttribute('data-slot', 'left');
  });
});

// --- LayoutRegions direct render: narrow collapse, tabs, pin ---

function node(id: string, slot?: Slot): Node {
  return { id, block: { id, type: 'text', variant: 'body', content: [id], ...(slot ? { slot } : {}) }, state: 'complete' } as Node;
}

function renderRegions(model: ReturnType<typeof createLayoutModel>, ids: string[], narrow: boolean) {
  // Conventional test slots: l* → left, r* → right, t* → top, c* → center, b* → bottom.
  const slotFor = (id: string): Slot | undefined =>
    id.startsWith('l') ? 'left' : id.startsWith('r') ? 'right' : id.startsWith('t') ? 'top' : id.startsWith('c') ? 'center' : id.startsWith('b') ? 'bottom' : undefined;
  const nodes = Object.fromEntries(ids.map((id) => [id, node(id, slotFor(id))]));
  const assignment = assignSlots(ids.map((id) => ({ id, slot: slotFor(id) })), model);
  return render(
    <LayoutRegions
      model={model}
      orderedIds={ids}
      nodes={nodes}
      assignment={assignment}
      narrow={narrow}
      renderNode={(id) => <div data-testid={`node-${id}`}>{id}</div>}
    />
  );
}

describe('LayoutRegions narrow collapse', () => {
  test('collapsed split stacks regions in narrowOrder', () => {
    const model = createLayoutModel({ kind: 'split', narrowOrder: 'right-first' });
    renderRegions(model, ['l1', 'r1'], true);
    const container = document.querySelector('.dg-layout-regions') as HTMLElement;
    expect(container).toHaveAttribute('data-dg-collapsed');
    const left = container.querySelector('[data-slot="left"]') as HTMLElement;
    const right = container.querySelector('[data-slot="right"]') as HTMLElement;
    expect(Number(left.style.getPropertyValue('--dg-region-order'))).toBeGreaterThan(
      Number(right.style.getPropertyValue('--dg-region-order'))
    );
  });

  test('tabs collapse renders a tablist and shows only the active region', async () => {
    const user = userEvent.setup();
    const model = createLayoutModel({ kind: 'split', narrow: 'tabs' });
    renderRegions(model, ['l1', 'r1'], true);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('data-dg-part', 'tabs');
    expect(screen.getByRole('tab', { name: 'left' })).toHaveAttribute('aria-selected', 'true');
    // inactive region is not rendered
    expect(screen.queryByTestId('node-r1')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'right' }));
    expect(screen.getByTestId('node-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('node-l1')).toBeNull();
  });

  test('pin marks the pinned region only when collapsed', () => {
    const model = createLayoutModel({ kind: 'split', pin: 'right' });
    renderRegions(model, ['l1', 'r1'], false);
    expect(document.querySelector('[data-dg-pin="true"]')).toBeNull();
    cleanup();
    renderRegions(model, ['l1', 'r1'], true);
    expect(document.querySelector('[data-slot="right"]')).toHaveAttribute('data-dg-pin', 'true');
  });

  test('wide split renders both regions, no tabs, no collapse', () => {
    const model = createLayoutModel({ kind: 'split', narrow: 'tabs' });
    renderRegions(model, ['l1', 'r1'], false);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(document.querySelector('.dg-layout-regions')).toHaveAttribute('data-dg-layout-regions');
    expect(screen.getByTestId('node-l1')).toBeInTheDocument();
    expect(screen.getByTestId('node-r1')).toBeInTheDocument();
  });
});
