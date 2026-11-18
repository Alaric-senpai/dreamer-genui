import { describe, expect, test } from 'vitest';
import {
  NODE_W,
  layerGraph,
  layoutFlowchart,
  layoutRadial,
  layoutTimeline,
} from '../../packages/dreamer-genui/src/figures/layout';

const nodes = [
  { id: 'intake', lane: 'prep' },
  { id: 'mix', lane: 'prep' },
  { id: 'heat', lane: 'process' },
  { id: 'ready', lane: 'process' },
  { id: 'cool', lane: 'process' },
  { id: 'product', lane: 'process' },
];
const edges = [
  { from: 'intake', to: 'mix' },
  { from: 'mix', to: 'heat' },
  { from: 'heat', to: 'ready' },
  { from: 'ready', to: 'cool', kind: 'branch' },
  { from: 'ready', to: 'mix', kind: 'recycle' },
  { from: 'cool', to: 'product' },
];

describe('figure layout (§6.7)', () => {
  test('layers a chain and ignores dangling edges', () => {
    const { layers, edges: kept } = layerGraph(nodes, [...edges, { from: 'ghost', to: 'mix' }]);
    expect(layers.map((layer) => layer.map((n) => n.id))).toEqual([
      ['intake'],
      ['mix'],
      ['heat'],
      ['ready'],
      ['cool'],
      ['product'],
    ]);
    expect(kept).toHaveLength(edges.length);
  });

  test('detects the recycle edge as a back edge', () => {
    const { edges: kept } = layerGraph(nodes, edges);
    expect(kept.find((e) => e.kind === 'recycle')?.back).toBe(true);
    expect(kept.filter((e) => e.back)).toHaveLength(1);
  });

  test('routes back edges around the graph with an SVG path', () => {
    const result = layoutFlowchart(nodes, edges, { down: true });
    const back = result.edges.filter((e) => e.back);
    expect(back).toHaveLength(1);
    expect(back[0]!.path).toMatch(/^M /);
    // recycle edges are routed orthogonally around the graph, never overlapping nodes
    expect(back[0]!.path).toContain(' L ');
    expect(result.nodes).toHaveLength(nodes.length);
    expect(result.width).toBeGreaterThan(NODE_W);
  });

  test('lanes produce named bands', () => {
    const result = layoutFlowchart(nodes, edges, { lanes: ['prep', 'process'] });
    expect(Object.keys(result.lanes)).toEqual(['prep', 'process']);
    expect(result.lanes.prep!.width).toBeGreaterThan(0);
  });

  test('narrow mode stacks nodes in one column in document order', () => {
    const result = layoutFlowchart(nodes, edges, { narrow: true });
    expect(result.nodes.map((n) => n.id)).toEqual(nodes.map((n) => n.id));
    expect(new Set(result.nodes.map((n) => n.x)).size).toBe(1);
    expect(result.nodes[1]!.y).toBeGreaterThan(result.nodes[0]!.y);
    expect(result.edges).toHaveLength(0);
  });

  test('radial layout is deterministic and centred', () => {
    const a = layoutRadial(nodes.slice(0, 5), [], (n) => n.id, 'radial');
    const b = layoutRadial(nodes.slice(0, 5), [], (n) => n.id, 'radial');
    expect(a).toEqual(b);
    const xs = a.nodes.map((n) => n.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(200);
    // every node sits inside the computed square
    expect(a.nodes.every((n) => n.x >= 0 && n.x + n.width <= a.width)).toBe(true);
  });

  test('cycle layout closes the ring with curved edges', () => {
    const ring = nodes.slice(0, 4);
    const cycleEdges = ring.map((node, i) => ({ from: node.id, to: ring[(i + 1) % ring.length]!.id }));
    const result = layoutRadial(ring, cycleEdges, (n) => n.id, 'cycle');
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(4);
    expect(result.edges.every((e) => e.path.includes('Q'))).toBe(true);
  });

  test('timeline lays events out in order', () => {
    const result = layoutTimeline([{ id: 'a' }, { id: 'b' }, { id: 'c' }], true);
    expect(result.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(result.nodes[0]!.x).toBeLessThan(result.nodes[1]!.x);
    expect(result.nodes[1]!.x).toBeLessThan(result.nodes[2]!.x);
  });
});
