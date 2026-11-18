/**
 * Pure, dependency-free geometry for figures (§6.7). The tutor never supplies
 * coordinates: every position is computed here from the graph and the board's
 * own container size. This module is loaded only inside the lazy figure chunk.
 */

export interface Pt { x: number; y: number }
export interface LaidNode<T> extends Pt {
  id: string;
  item: T;
  layer: number;
  width: number;
  height: number;
}
export interface LaidEdge {
  from: string;
  to: string;
  path: string;
  back: boolean;
  kind?: string;
  labelPt?: Pt;
}
export interface LayoutResult<T> {
  nodes: LaidNode<T>[];
  edges: LaidEdge[];
  width: number;
  height: number;
  /** Lane bands, keyed by declared lane id. */
  lanes: Record<string, { x: number; y: number; width: number; height: number }>;
}

export const NODE_W = 184;
export const NODE_H = 68;
const GAP_X = 76;
const GAP_Y = 40;
const PAD = 56;

const n = (v: number) => Math.round(v * 100) / 100;

/** Cubic curve between two node anchors. `down` flows top→bottom. */
function curve(a: Pt, b: Pt, down: boolean): string {
  if (down) {
    const mid = (a.y + b.y) / 2;
    return `M ${n(a.x)} ${n(a.y)} C ${n(a.x)} ${n(mid)}, ${n(b.x)} ${n(mid)}, ${n(b.x)} ${n(b.y)}`;
  }
  const mid = (a.x + b.x) / 2;
  return `M ${n(a.x)} ${n(a.y)} C ${n(mid)} ${n(a.y)}, ${n(mid)} ${n(b.y)}, ${n(b.x)} ${n(b.y)}`;
}

/** Orthogonal back-edge routed around the outside of the graph. */
function backEdge(a: Pt, b: Pt, down: boolean, extent: number): { path: string; labelPt: Pt } {
  if (down) {
    const x = Math.max(a.x, b.x) + 62;
    const y = a.y + NODE_H / 2;
    const ty = b.y - NODE_H / 2;
    return {
      path: `M ${n(x - 30)} ${n(y)} L ${n(x)} ${n(y)} L ${n(x)} ${n(ty - 14)} L ${n(b.x)} ${n(ty - 14)} L ${n(b.x)} ${n(ty)}`,
      labelPt: { x: x + 4, y: (y + ty) / 2 },
    };
  }
  const y = Math.max(a.y, b.y) + 52 + extent * 0;
  const ax = a.x + NODE_W;
  const bx = b.x;
  return {
    path: `M ${n(ax)} ${n(a.y + NODE_H / 2)} L ${n(ax + 24)} ${n(a.y + NODE_H / 2)} L ${n(ax + 24)} ${n(y)} L ${n(bx - 24)} ${n(y)} L ${n(bx - 24)} ${n(b.y + NODE_H / 2)} L ${n(bx)} ${n(b.y + NODE_H / 2)}`,
    labelPt: { x: (ax + bx) / 2, y },
  };
}

interface GraphNode { id: string; lane?: string }
interface GraphEdge { from: string; to: string; kind?: string; label?: string; back?: boolean }

/**
 * Longest-path layering with DFS back-edge detection. Back edges (recycle
 * loops) are excluded from layering and routed around the graph, so they can
 * never produce an infinite layer or an overlapping line (§6.7).
 */
export function layerGraph<T extends GraphNode>(
  nodes: T[],
  edges: GraphEdge[],
): { layers: T[][]; edges: GraphEdge[] } {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const out = new Map(nodes.map((node) => [node.id, [] as GraphEdge[]]));
  const state = new Map<string, 0 | 1 | 2>();
  const back = new Set<number>();

  edges.forEach((edge, i) => {
    if (byId.has(edge.from) && byId.has(edge.to)) out.get(edge.from)!.push({ ...edge, back: false });
    else back.add(i); // dangling edges are reported by the validator; never drawn
  });

  const visit = (id: string) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) return;
    state.set(id, 1);
    for (const edge of out.get(id) ?? []) {
      if (state.get(edge.to) === 1) {
        // Mark the exact edge object as a back edge by identity.
        (edge as GraphEdge & { back?: boolean }).back = true;
        continue;
      }
      visit(edge.to);
    }
    state.set(id, 2);
  };
  nodes.forEach((node) => visit(node.id));

  const kept = edges
    .map((edge, i) => ({ edge, i }))
    .filter(({ edge, i }) => !back.has(i) && byId.has(edge.from) && byId.has(edge.to))
    .map(({ edge }) => edge);
  const cleaned = kept.map((edge) => {
    const match = out.get(edge.from)?.find((candidate) => candidate.to === edge.to && candidate.kind === edge.kind);
    return { ...edge, back: match?.back === true };
  });

  const depth = new Map(nodes.map((node) => [node.id, 0]));
  // Relax repeatedly; graphs are small (<= 64 nodes) and acyclic after back-edge removal.
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const edge of cleaned) {
      if (edge.back) continue;
      const next = depth.get(edge.from)! + 1;
      if (next > depth.get(edge.to)!) {
        depth.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const layers: T[][] = [];
  for (const node of nodes) {
    const d = depth.get(node.id)!;
    (layers[d] ??= []).push(node);
  }
  return { layers, edges: cleaned };
}

export function layoutFlowchart<T extends GraphNode>(
  nodes: T[],
  edges: GraphEdge[],
  opts: { down?: boolean; narrow?: boolean; lanes?: string[] } = {},
): LayoutResult<T> {
  const down = opts.down !== false;
  const narrow = opts.narrow === true;
  const { layers, edges: cleanedEdges } = layerGraph(nodes, edges);
  const laid: LaidNode<T>[] = [];
  const laneBoxes: Record<string, { x: number; y: number; width: number; height: number }> = {};

  if (narrow) {
    // Phone stepper: one node at a time, camera-follow friendly, no sideways scroll.
    nodes.forEach((item, i) => {
      laid.push({ id: item.id, item, layer: i, x: PAD / 2, y: PAD / 2 + i * (NODE_H + GAP_Y + 16), width: NODE_W, height: NODE_H });
    });
  } else {
    let cursor = PAD / 2;
    layers.forEach((layer, layerIndex) => {
      const height = layer.length * NODE_H + (layer.length - 1) * GAP_Y;
      const startY = PAD + Math.max(0, ((Math.max(...layers.map((l) => l.length)) * (NODE_H + GAP_Y) - GAP_Y) - height) / 2);
      layer.forEach((item, i) => {
        const x = down ? startY : PAD / 2 + layerIndex * (NODE_W + GAP_X);
        const y = down ? PAD / 2 + layerIndex * (NODE_H + GAP_X) : startY + i * (NODE_H + GAP_Y);
        laid.push({ id: item.id, item, layer: layerIndex, x, y, width: NODE_W, height: NODE_H });
        if (item.lane) {
          const box = (laneBoxes[item.lane] ??= { x: x - 18, y: y - 26, width: NODE_W + 36, height: NODE_H + 52 });
          box.x = Math.min(box.x, x - 18);
          box.y = Math.min(box.y, y - 26);
          box.width = Math.max(box.width, x + NODE_W + 18 - box.x);
          box.height = Math.max(box.height, y + NODE_H + 26 - box.y);
        }
      });
      if (layer.length) cursor += NODE_W + GAP_X;
    });
    void cursor;
  }

  const pos = new Map(laid.map((node) => [node.id, node]));
  const drawn: LaidEdge[] = [];
  // In the phone stepper only one node is visible at a time, so no edges are drawn.
  if (narrow) {
    const w = Math.max(PAD, ...laid.map((l) => l.x + l.width + PAD / 2));
    const h = Math.max(PAD, ...laid.map((l) => l.y + l.height + PAD / 2));
    return { nodes: laid, edges: drawn, width: w, height: h, lanes: laneBoxes };
  }
  for (const edge of cleanedEdges) {
    const a = pos.get(edge.from);
    const b = pos.get(edge.to);
    if (!a || !b) continue;
    let path: string;
    let labelPt: Pt | undefined;
    if (edge.back || narrow) {
      const routed = backEdge({ x: a.x, y: a.y }, { x: b.x, y: b.y }, down && !narrow, laid.length);
      path = routed.path;
      labelPt = routed.labelPt;
    } else {
      const from = down
        ? { x: a.x + a.width / 2, y: a.y + a.height }
        : { x: a.x + a.width, y: a.y + a.height / 2 };
      const to = down
        ? { x: b.x + b.width / 2, y: b.y }
        : { x: b.x, y: b.y + b.height / 2 };
      path = curve(from, to, down);
      labelPt = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    }
    drawn.push({ from: edge.from, to: edge.to, path, back: edge.back === true, kind: edge.kind, labelPt });
  }

  const width = Math.max(PAD, ...laid.map((l) => l.x + l.width + PAD / 2), ...Object.values(laneBoxes).map((b) => b.x + b.width));
  const height = Math.max(PAD, ...laid.map((l) => l.y + l.height + PAD / 2), ...Object.values(laneBoxes).map((b) => b.y + b.height));
  return { nodes: laid, edges: drawn, width, height, lanes: laneBoxes };
}

/** Evenly spaced leaves under a root (tree), or around a ring (radial/cycle/orbit). */
export function layoutRadial<T>(
  nodes: T[],
  edges: { from: string; to: string }[],
  idOf: (item: T) => string,
  kind: 'tree' | 'radial' | 'cycle' | 'orbit',
): LayoutResult<T> {
  const box = Math.max(360, nodes.length * 116);
  const cx = box / 2;
  const cy = box / 2;
  const laid: LaidNode<T>[] = nodes.map((item, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
    const radius = kind === 'tree' ? 0 : Math.min(160, box * 0.32);
    return {
      id: idOf(item), item, layer: i,
      x: kind === 'tree' ? cx - NODE_W / 2 : cx + Math.cos(angle) * radius - NODE_W / 2,
      y: kind === 'tree'
        ? cy - NODE_H / 2 + i * (NODE_H + 28) - ((nodes.length - 1) * (NODE_H + 28)) / 2
        : cy + Math.sin(angle) * radius - NODE_H / 2,
      width: NODE_W, height: NODE_H,
    };
  });
  const pos = new Map(laid.map((node) => [node.id, node]));
  const drawn: LaidEdge[] = edges.map((edge) => {
    const a = pos.get(edge.from);
    const b = pos.get(edge.to);
    if (!a || !b) return null;
    const path = kind === 'cycle'
      ? `M ${n(a.x + NODE_W / 2)} ${n(a.y + NODE_H / 2)} Q ${n(cx)} ${n(cy)} ${n(b.x + NODE_W / 2)} ${n(b.y + NODE_H / 2)}`
      : `M ${n(a.x + NODE_W / 2)} ${n(a.y + NODE_H / 2)} L ${n(b.x + NODE_W / 2)} ${n(b.y + NODE_H / 2)}`;
    return { from: edge.from, to: edge.to, path, back: false };
  }).filter((e): e is LaidEdge => e !== null);
  return { nodes: laid, edges: drawn, width: box, height: box, lanes: {} };
}

export function layoutTimeline<T extends { id: string }>(
  items: T[],
  horizontal: boolean,
): LayoutResult<T> {
  const laid = items.map((item, i) => ({
    id: item.id,
    item,
    layer: i,
    x: horizontal ? 90 + i * 216 : 110,
    y: horizontal ? 92 : 70 + i * 126,
    width: NODE_W,
    height: NODE_H,
  }));
  const line = horizontal
    ? `M 84 128 L ${n(90 + (items.length - 1) * 216 + NODE_W - 22)} 128`
    : `M 86 104 L 86 ${n(70 + (items.length - 1) * 126 + NODE_H - 16)}`;
  return {
    nodes: laid,
    edges: [{ from: '', to: '', path: line, back: false }],
    width: horizontal ? 150 + items.length * 216 : 420,
    height: horizontal ? 250 : 110 + items.length * 126,
    lanes: {},
  };
}
