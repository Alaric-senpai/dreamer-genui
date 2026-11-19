/**
 * Dependency-free placement maths for `scene3d` (§6.16). Coordinates are
 * abstract units clamped to a small box; the tutor never supplies raw CSS or
 * shader code. This module intentionally has no `three` import so it can be
 * unit-tested without WebGL.
 */
import type { Gap } from '../schema/layout';

export type V3 = [number, number, number];

const GAP: Record<Gap, number> = {
  none: 0, xs: 0.4, sm: 0.7, md: 1.1, lg: 1.8, xl: 2.8,
};
const SIZE: Record<string, number> = { xs: 0.25, sm: 0.45, md: 0.75, lg: 1.15, xl: 1.7 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function gapUnits(gap: Gap | undefined): number {
  return gap ? (GAP[gap] ?? 1.1) : 1.1;
}

export function sizeUnits(size: string | undefined): number {
  return SIZE[size ?? 'md'] ?? 0.75;
}

/** Resolve `place` relative to another object's centre. */
export function placeRelative(
  base: V3,
  dir: 'left' | 'right' | 'above' | 'below' | 'front' | 'behind',
  gap: Gap | undefined,
): V3 {
  const g = gapUnits(gap) + 0.5;
  switch (dir) {
    case 'left': return [clamp(base[0] - g, -8, 8), base[1], base[2]];
    case 'right': return [clamp(base[0] + g, -8, 8), base[1], base[2]];
    case 'above': return [base[0], clamp(base[1] + g, -8, 8), base[2]];
    case 'below': return [base[0], clamp(base[1] - g, -8, 8), base[2]];
    case 'front': return [base[0], base[1], clamp(base[2] + g, -8, 8)];
    case 'behind': return [base[0], base[1], clamp(base[2] - g, -8, 8)];
  }
}

/** Positions for an `arrange` directive; already-placed ids are preserved. */
export function arrangePositions(
  ids: string[],
  kind: 'row' | 'ring' | 'grid' | 'stack' | 'orbit',
  spacing: Gap | undefined,
  existing: Map<string, V3>,
): Map<string, V3> {
  const out = new Map(existing);
  const open = ids.filter((id) => !out.has(id));
  const g = gapUnits(spacing);
  const n = Math.max(1, open.length);
  open.forEach((id, i) => {
    let p: V3 = [0, 0, 0];
    switch (kind) {
      case 'row': p = [(i - (n - 1) / 2) * (g + 0.8), 0, 0]; break;
      case 'stack': p = [0, (i - (n - 1) / 2) * (g + 0.6), 0]; break;
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(n));
        p = [(i % cols - (cols - 1) / 2) * (g + 0.9), (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * (g + 0.9), 0];
        break;
      }
      case 'ring': case 'orbit': {
        const a = (i / n) * Math.PI * 2;
        const r = Math.max(1.2, (g + 1) * n / (2 * Math.PI));
        p = [Math.cos(a) * r, kind === 'orbit' ? Math.sin(a) * r * 0.35 : 0, Math.sin(a) * r];
        break;
      }
    }
    out.set(id, [clamp(p[0], -8, 8), clamp(p[1], -8, 8), clamp(p[2], -8, 8)]);
  });
  return out;
}

export type ResolvedView = { position: V3; target: V3; fov?: number };

export const CAMERA_PRESETS: Record<string, ResolvedView> = {
  front: { position: [0, 0, 5], target: [0, 0, 0] },
  back: { position: [0, 0, -5], target: [0, 0, 0] },
  left: { position: [-5, 0, 0], target: [0, 0, 0] },
  right: { position: [5, 0, 0], target: [0, 0, 0] },
  top: { position: [0, 5, 0], target: [0, 0, 0] },
  bottom: { position: [0, -5, 0], target: [0, 0, 0] },
  iso: { position: [3.4, 2.8, 3.4], target: [0, 0, 0] },
};

/** Resolve a ViewRef against manifest views/parts. Unknown values return undefined. */
export function resolveView(
  view: string | { view: string } | { focus: string; distance?: string; from?: string } | undefined,
  manifestViews: Record<string, { position: V3; target: V3; fov?: number }> | undefined,
  anchors: Map<string, V3>,
): { position: V3; target: V3; fov?: number } | undefined {
  if (!view) return CAMERA_PRESETS.iso;
  if (typeof view === 'string') {
    if (CAMERA_PRESETS[view]) return CAMERA_PRESETS[view];
    return manifestViews?.[view];
  }
  if ('view' in view) return manifestViews?.[view.view];
  const target = anchors.get(view.focus);
  if (!target) return undefined;
  const d = view.distance === 'near' ? 1.8 : view.distance === 'far' ? 5.5 : 3.2;
  const dir = view.from ?? 'front';
  const offset = CAMERA_PRESETS[dir]?.position ?? CAMERA_PRESETS.front!.position;
  const len = Math.hypot(...offset) || 1;
  return {
    position: [target[0] + offset[0] / len * d, target[1] + offset[1] / len * d, target[2] + offset[2] / len * d],
    target,
  };
}
