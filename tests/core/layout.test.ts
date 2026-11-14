import { describe, expect, test } from 'vitest';
import {
  assignSlots,
  createLayoutModel,
  gridColumns,
  layoutDefinesSlot,
  leadingRegion,
  narrowRegions,
} from '../../packages/dreamer-genui/src/core/layout';
import { createRegistry, defineLayout } from '../../packages/dreamer-genui/src/core';
import type { Slot } from '../../packages/dreamer-genui/src/schema/layout';

const node = (id: string, slot?: Slot) => ({ id, slot });

describe('layout model (§6.4)', () => {
  test('flow is the default: a single primary center region', () => {
    const model = createLayoutModel({ kind: 'flow' });
    expect(model.regions).toEqual(['center']);
    expect(model.primary).toBe('center');
    expect(narrowRegions(model)).toEqual(['center']);
  });

  test('split defines left/right with order, ratio and narrow collapse', () => {
    const model = createLayoutModel({ kind: 'split', ratio: '2:1', gap: 'lg' });
    expect(model.regions).toEqual(['left', 'right']);
    expect(model.visualOrder).toEqual(['left', 'right']);
    expect(model.narrowOrder).toEqual(['left', 'right']);
    expect(model.ratio).toBe('2:1');

    const reversed = createLayoutModel({ kind: 'split', sides: 'right-left', narrowOrder: 'right-first' });
    expect(reversed.visualOrder).toEqual(['right', 'left']);
    expect(reversed.narrowOrder).toEqual(['right', 'left']);
    expect(leadingRegion(reversed)).toBe('right');

    const tabs = createLayoutModel({ kind: 'split', narrow: 'tabs' });
    expect(tabs.narrow).toBe('tabs');
    expect(narrowRegions(tabs)).toEqual(['left', 'right']);
  });

  test('split pin records the sticky side on narrow containers', () => {
    expect(createLayoutModel({ kind: 'split', pin: 'right' }).pin).toBe('right');
  });

  test('stage honours explicit regions with a defined stack order', () => {
    const model = createLayoutModel({ kind: 'stage', regions: ['top', 'center'] });
    expect(model.regions).toEqual(['top', 'center']);
    expect(model.primary).toBe('center');
    expect(narrowRegions(model)).toEqual(['top', 'center']);
  });

  test('grid exposes columns and narrow columns', () => {
    const model = createLayoutModel({ kind: 'grid', columns: 3, narrowColumns: 2 });
    expect(gridColumns(model)).toBe(3);
    expect(gridColumns(model, true)).toBe(2);
    expect(gridColumns(createLayoutModel({ kind: 'flow' }))).toBe(1);
  });

  test('registered (plugin/host) layouts override the built-in region model', () => {
    const registry = createRegistry({ strictPlugins: false });
    registry.register(
      'layouts',
      'acme:triptych',
      defineLayout({ regions: ['left', 'center', 'right'], primary: 'center', narrow: 'stack' }),
    );
    const model = createLayoutModel({ kind: 'acme:triptych' } as never, registry);
    expect(model.regions).toEqual(['left', 'center', 'right']);
    expect(model.primary).toBe('center');
    expect(model.definition).toBeDefined();
  });

  test('an empty definition falls back to the built-in model (never fatal)', () => {
    const registry = createRegistry({ strictPlugins: false });
    registry.register('layouts', 'broken', defineLayout({ regions: [], primary: 'center' }));
    const model = createLayoutModel({ kind: 'broken' } as never, registry);
    expect(model.primary).toBe('center');
    expect(model.regions).toEqual(['center']);
  });
});

describe('slot assignment (§6.4)', () => {
  test('unslotted nodes flow into the primary region', () => {
    const model = createLayoutModel({ kind: 'split' });
    const result = assignSlots([node('a', 'left'), node('b'), node('c', 'right')], model);
    expect(result.regions.left).toEqual(['a', 'b']);
    expect(result.regions.right).toEqual(['c']);
    expect(result.fallbacks).toEqual([]);
    expect(result.unslotted).toEqual(['b']);
  });

  test('a slot the layout does not define falls back to primary with a record', () => {
    const model = createLayoutModel({ kind: 'split' });
    const result = assignSlots([node('a', 'top')], model);
    expect(result.regions.left).toEqual(['a']);
    expect(result.fallbacks).toEqual([{ id: 'a', requested: 'top', used: 'left' }]);
  });

  test('stage accepts all five slots', () => {
    const model = createLayoutModel({ kind: 'stage' });
    const result = assignSlots([node('a', 'top'), node('b', 'bottom'), node('c', 'center')], model);
    expect(result.fallbacks).toEqual([]);
    expect(result.regions.top).toEqual(['a']);
    expect(result.regions.bottom).toEqual(['b']);
    expect(result.regions.center).toEqual(['c']);
  });

  test('layoutDefinesSlot mirrors region membership', () => {
    const split = createLayoutModel({ kind: 'split' });
    expect(layoutDefinesSlot(split, 'left')).toBe(true);
    expect(layoutDefinesSlot(split, 'top')).toBe(false);
  });
});
