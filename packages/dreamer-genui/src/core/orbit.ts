/**
 * Orbit diagram placement (§6.7). Pure geometry for `diagram` layout `"orbit"`:
 * an optional root holds the centre and the remaining nodes sit evenly on a
 * ring. Coordinates are normalised to the unit square (-1..1) so the renderer
 * can scale them to any viewBox without knowing the screen size.
 */

export interface OrbitOptions {
  /** Node id that owns the centre; omitted, every node joins the ring. */
  root?: string;
  /** Ring radius in normalised units (0..1). Defaults to 0.78. */
  radius?: number;
  /** First satellite angle in degrees; defaults to -90 (top). */
  startAngle?: number;
  /** Rotate the ring per node index instead of even spacing. */
  even?: boolean;
}

export interface OrbitPlacement {
  id: string;
  /** Normalised centre coordinates, -1..1. */
  x: number;
  y: number;
  /** Angle in degrees, for label orientation. */
  angle: number;
  /** 0 for the root, 1 for rim nodes. */
  ring: 0 | 1;
}

const DEFAULT_RADIUS = 0.78;
const DEFAULT_START = -90;

function clampRadius(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_RADIUS;
  return Math.max(0, Math.min(1, value));
}

function normaliseAngle(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_START;
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Place nodes on an orbit. The root (when present in `ids`) sits at the centre;
 * all other nodes are spaced evenly around the ring in document order.
 */
export function layoutOrbit(ids: readonly string[], options: OrbitOptions = {}): OrbitPlacement[] {
  const radius = clampRadius(options.radius);
  const start = normaliseAngle(options.startAngle);
  const rootIndex = options.root !== undefined ? ids.indexOf(options.root) : -1;
  const rim = ids.filter((_, index) => index !== rootIndex);
  const step = rim.length > 0 ? 360 / rim.length : 0;

  const placements: OrbitPlacement[] = [];
  if (rootIndex >= 0) {
    placements.push({ id: ids[rootIndex] as string, x: 0, y: 0, angle: 0, ring: 0 });
  }

  rim.forEach((id, index) => {
    const angle = start + index * step;
    const radians = (angle * Math.PI) / 180;
    placements.push({
      id,
      x: Number((Math.cos(radians) * radius).toFixed(6)),
      y: Number((Math.sin(radians) * radius).toFixed(6)),
      angle,
      ring: 1,
    });
  });

  // Preserve the caller's id order so layout is deterministic for tests and SSR.
  const byId = new Map(placements.map(p => [p.id, p] as const));
  return ids.map(id => byId.get(id)).filter((p): p is OrbitPlacement => p !== undefined);
}

/** SVG path for the ring, in a viewBox of `-1 -1 2 2`. */
export function orbitRingPath(radius = DEFAULT_RADIUS): string {
  const r = clampRadius(radius);
  return `M ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0`;
}

/** Total revolution duration for one orbit animation (ms). */
export const ORBIT_DURATION_MS = 21_000;
