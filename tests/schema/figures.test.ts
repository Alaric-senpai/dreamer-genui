import { describe, expect, test } from 'vitest';
import { FigureSchema } from '../../packages/dreamer-genui/src/schema/figures';

describe('Figures', () => {
  test('parses image figure', () => {
    const fig = { kind: 'image', src: 'https://example.com/cell.jpg', alt: 'A cell diagram' };
    expect(FigureSchema.parse(fig)).toMatchObject({ kind: 'image', alt: 'A cell diagram' });
  });

  test('parses image figure with asset src', () => {
    const fig = { kind: 'image', src: { asset: 'cell-diagram-v1' }, alt: 'A cell' };
    expect(FigureSchema.parse(fig)).toMatchObject({ kind: 'image' });
  });

  test('parses icon figure', () => {
    expect(FigureSchema.parse({ kind: 'icon', name: 'flask', alt: 'Science icon' })).toMatchObject({ kind: 'icon', name: 'flask' });
  });

  test('parses diagram figure with all layouts', () => {
    for (const layout of ['tree', 'radial', 'flow', 'cycle'] as const) {
      const parsed = FigureSchema.parse({
        kind: 'diagram',
        layout,
        nodes: [{ id: 'n1', label: 'Root' }],
        edges: [],
        alt: 'A diagram',
      });
      expect((parsed as { layout: string }).layout).toBe(layout);
    }
  });

  test('parses labeled figure', () => {
    const fig = {
      kind: 'labeled',
      pack: 'cell',
      art: 'animal-cell',
      highlight: ['nucleus', 'membrane'],
      labels: [{ part: 'nucleus', text: 'Nucleus' }],
      alt: 'Animal cell',
    };
    expect(FigureSchema.parse(fig)).toMatchObject({ kind: 'labeled', pack: 'cell' });
  });

  test('parses chart figure bar type', () => {
    const parsed = FigureSchema.parse({
      kind: 'chart',
      type: 'bar',
      series: [{ name: 'Students', data: [40, 65, 80, 90] }],
      xLabel: 'Grade',
      yLabel: 'Score',
      alt: 'Bar chart',
    });
    expect((parsed as { type: string }).type).toBe('bar');
  });

  test('parses chart figure scatter with object x/y', () => {
    const parsed = FigureSchema.parse({
      kind: 'chart',
      type: 'scatter',
      series: [{ name: 'Points', data: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }],
      alt: 'Scatter plot',
    });
    expect((parsed as { type: string }).type).toBe('scatter');
  });

  test('parses lottie figure with asset', () => {
    expect(FigureSchema.parse({ kind: 'lottie', src: { asset: 'wave-animation' }, loop: true, alt: 'Wave' })).toMatchObject({ kind: 'lottie', loop: true });
  });

  test('rejects unknown figure kind', () => {
    expect(() => FigureSchema.parse({ kind: 'canvas', width: 100 })).toThrow();
  });

  test('rejects diagram without alt', () => {
    expect(() => FigureSchema.parse({ kind: 'diagram', layout: 'tree', nodes: [], edges: [] })).toThrow();
  });
});
