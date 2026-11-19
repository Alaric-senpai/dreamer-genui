/**
 * M5b lazy 3D chunk. Loaded only when a `model3d`/`scene3d` figure mounts.
 *
 * Host callbacks (emit, assets, connector, manifest) arrive as props: with
 * `splitting: false` a second React copy of the provider context would be a
 * different module instance, so the chunk must never import React runtime
 * modules from `src/react/*`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { UIEvent } from '../schema/events';
import type { LibraryError } from '../core/types';
import type { AssetResolver } from '../core/assets';
import type { ModelConnector } from '../schema/connector';
import type { Model3DFigure, ModelManifest, Scene3DFigure, ViewRef, PartId } from '../schema/model';
import type { Inline } from '../schema/inline';
import { resolveView, placeRelative, arrangePositions, sizeUnits, CAMERA_PRESETS } from './scene';
import type { V3, ResolvedView } from './scene';

const ISO = CAMERA_PRESETS.iso!;
const FRONT = CAMERA_PRESETS.front!;

export type InlineRenderer = (content: Inline[]) => ReactNode;

export interface Figure3DRendererProps {
  figure: Model3DFigure | Scene3DFigure;
  nodeId: string;
  emit: (event: UIEvent) => void;
  onError?: (error: LibraryError) => void;
  assets: AssetResolver;
  connector?: ModelConnector;
  manifest?: ModelManifest;
  modelAsset?: string | ArrayBuffer | Blob;
  /** Poster URL resolved by the wrapper (connector-aware); overrides the
   *  renderer's own `assets` fallback. */
  poster?: string;
  loadError?: LibraryError;
  firedCues: readonly string[];
  reducedMotion: boolean;
  locale?: string;
  renderInline?: InlineRenderer;
}

/* ------------------------------------------------------------------ *
 * WebGL detection, render-on-demand and context budget
 * ------------------------------------------------------------------ */

function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch { return false; }
}

/** At most two live WebGL contexts; older figures freeze to a snapshot. */
const liveFigures = new Set<() => void>();

type Easing = (t: number) => number;
const EASES: Record<string, Easing> = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  snappy: (t) => 1 - (1 - t) ** 3,
  overshoot: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
  anticipate: (t) => 2.7 * t ** 3 - 1.7 * t ** 2,
};
const SMOOTH: Easing = EASES.smooth!;

interface CameraGoal { position: THREE.Vector3; target: THREE.Vector3; fov: number; duration: number; ease: Easing; started: number }

interface Spinner { object: THREE.Object3D; effect: string; speed: number; around?: string }

interface SceneHandle {
  spinners: Spinner[];
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  group: THREE.Group;
  parts: Map<PartId, THREE.Object3D>;
  anchors: Map<string, V3>;
  mixer?: THREE.AnimationMixer;
  invalidate: () => void;
  dispose: () => void;
  freeze: () => string | undefined;
  setGoal: (goal: CameraGoal) => void;
}

function useScene(
  nodeId: string,
  manifest: ModelManifest | undefined,
  figure: Model3DFigure | Scene3DFigure,
  modelAsset: string | ArrayBuffer | Blob | undefined,
  reducedMotion: boolean,
  emit: (event: UIEvent) => void,
  onError?: (error: LibraryError) => void,
): { handle: SceneHandle | null; ready: boolean; snapshot: string | undefined; active: boolean } {
  const host = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState<SceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<string | undefined>();
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!host.current || !webglAvailable()) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      onError?.({ code: 'webgl-unavailable', detail: 'WebGL renderer could not be created' });
      return;
    }
    renderer.setPixelRatio(Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
    renderer.domElement.className = 'dg-figure3d-canvas';
    renderer.domElement.setAttribute('data-dg-part', 'canvas');
    renderer.domElement.tabIndex = 0;
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(...ISO.position);
    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    scene.add(key);

    const parts = new Map<PartId, THREE.Object3D>();
    const anchors = new Map<string, V3>();
    let mixer: THREE.AnimationMixer | undefined;
    let disposed = false;
    let raf = 0;
    let onScreen = true;
    let visible = !document.hidden;
    let paused = false;
    const syncPaused = () => { paused = !onScreen || !visible; if (!paused) invalidate(); };
    let goal: CameraGoal | undefined;
    let goalTarget = new THREE.Vector3(0, 0, 0);
    let last = performance.now();
    const spinners: Spinner[] = [];

    const frame = (now: number) => {
      raf = 0;
      if (disposed || paused) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (goal) {
        const t = goal.duration <= 0 || reducedMotion ? 1 : Math.min(1, (now - goal.started) / goal.duration);
        const e = goal.ease(t);
        camera.position.lerp(goal.position, reducedMotion ? 1 : 0.18);
        const target = goalTarget.clone().lerp(goal.target, reducedMotion ? 1 : 0.18);
        goalTarget = target;
        camera.lookAt(target);
        if (t >= 1) goal = undefined;
      } else camera.lookAt(goalTarget);
      for (const s of spinners) {
        if (s.effect === 'spin') s.object.rotation.y += dt * s.speed;
        else if (s.effect === 'bob') s.object.position.y += Math.sin(now / 600) * dt * s.speed * 0.1;
        else if (s.effect === 'orbit') s.object.rotation.y += dt * s.speed * 0.5;
        else if (s.effect === 'pulse') s.object.scale.setScalar(1 + Math.sin(now / 400) * 0.05 * s.speed);
      }
      mixer?.update(dt);
      renderer.render(scene, camera);
      if (goal || mixer || spinners.length) invalidate();
    };
    const invalidate = () => {
      if (!raf && !paused && !disposed) raf = requestAnimationFrame(frame);
    };
    const resize = () => {
      const w = element.clientWidth || 320;
      const h = element.clientHeight || 320;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      invalidate();
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : undefined;
    observer?.observe(element);
    resize();

    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
      onScreen = Boolean(entries[0]?.isIntersecting);
      syncPaused();
    }) : undefined;
    io?.observe(element);
    const visibility = () => { visible = !document.hidden; syncPaused(); };
    document.addEventListener('visibilitychange', visibility);

    /* Pointer orbit / pick / pinch */
    const pointers = new Map<number, { x: number; y: number }>();
    let downAt: { x: number; y: number } | undefined;
    let radius = 5;
    let theta = Math.atan2(ISO.position[0], ISO.position[2]);
    let phi = Math.PI / 3;
    const applyOrbit = () => {
      phi = Math.min(2.7, Math.max(0.25, phi));
      radius = Math.min(9, Math.max(1.5, radius));
      camera.position.set(
        goalTarget.x + radius * Math.sin(phi) * Math.sin(theta),
        goalTarget.y + radius * Math.cos(phi),
        goalTarget.z + radius * Math.sin(phi) * Math.cos(theta),
      );
      invalidate();
    };
    const pointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      downAt = { x: e.clientX, y: e.clientY };
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    const pointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        const pts = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        radius = Math.max(1.5, Math.min(9, 9 - dist / 60));
        applyOrbit();
        return;
      }
      if (Math.hypot(dx, dy) > 40) downAt = undefined;
      theta -= dx * 0.008;
      phi -= dy * 0.008;
      applyOrbit();
    };
    const pointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((e.clientX - rect.left) / (rect.width || 1)) * 2 - 1,
            -((e.clientY - rect.top) / (rect.height || 1)) * 2 + 1,
          ),
          camera,
        );
        const hits = ray.intersectObjects(group.children, true);
        let object: THREE.Object3D | undefined = hits[0]?.object;
        while (object && ![...parts.values()].includes(object)) object = object.parent ?? undefined;
        const part = object && [...parts.entries()].find(([, o]) => o === object)?.[0];
        if (part) emit({ type: 'focus', nodeId: figure.kind === 'model3d' ? `${nodeId}/${part}` : nodeId, ref: `${nodeId}/${part}` });
      }
      downAt = undefined;
    };
    const keyDown = (e: KeyboardEvent) => {
      const step = 0.15;
      if (e.key === 'ArrowLeft') theta -= step;
      else if (e.key === 'ArrowRight') theta += step;
      else if (e.key === 'ArrowUp') phi -= step;
      else if (e.key === 'ArrowDown') phi += step;
      else if (e.key === '+' || e.key === '=') radius -= 0.4;
      else if (e.key === '-') radius += 0.4;
      else if (e.key.toLowerCase() === 'r' || e.key === 'Escape') {
        const view: ResolvedView = resolveView(figure.view, manifest?.views, anchors) ?? ISO;
        goal = { position: new THREE.Vector3(...view.position), target: new THREE.Vector3(...view.target), fov: view.fov ?? 45, duration: reducedMotion ? 0 : 350, ease: SMOOTH, started: performance.now() };
        goalTarget = goal.target;
        invalidate();
        return;
      } else return;
      e.preventDefault();
      applyOrbit();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(1.5, Math.min(9, radius + Math.sign(e.deltaY) * 0.35));
      applyOrbit();
    };
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('keydown', keyDown);
    canvas.addEventListener('wheel', wheel, { passive: false });

    const handle: SceneHandle = {
      spinners,
      scene, camera, renderer, group, parts, anchors, invalidate,
      mixer,
      setGoal(next) {
        goal = next;
        goalTarget = next.target;
        if (next.fov !== camera.fov) { camera.fov = next.fov; camera.updateProjectionMatrix(); }
        invalidate();
      },
      dispose() {
        disposed = true;
        if (raf) cancelAnimationFrame(raf);
        observer?.disconnect();
        io?.disconnect();
        document.removeEventListener('visibilitychange', visibility);
        canvas.removeEventListener('pointerdown', pointerDown);
        canvas.removeEventListener('pointermove', pointerMove);
        canvas.removeEventListener('pointerup', pointerUp);
        canvas.removeEventListener('keydown', keyDown);
        canvas.removeEventListener('wheel', wheel);
        group.traverse((o) => {
          const mesh = o as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
          for (const m of materials) m.dispose?.();
        });
        renderer.dispose();
        canvas.remove();
      },
      freeze() {
        try { return renderer.domElement.toDataURL('image/png'); } catch { return undefined; }
      },
    };
    setHandle(handle);

    /* Eager activation / budget claim */
    let release = () => {};
    const claim = () => {
      if (liveFigures.has(release)) return;
      if (liveFigures.size >= 2) {
        const oldest = [...liveFigures][0];
        oldest?.();
      }
      liveFigures.add(release);
      setActive(true);
    };
    release = () => {
      liveFigures.delete(release);
      const shot = handle.freeze();
      if (shot) setSnapshot(shot);
      setActive(false);
    };
    const activate = () => claim();
    canvas.addEventListener('focus', activate);
    canvas.addEventListener('pointerdown', activate);
    claim();

    return () => {
      release();
      canvas.removeEventListener('focus', activate);
      canvas.removeEventListener('pointerdown', activate);
      handle.dispose();
      setHandle(null);
      setReady(false);
    };
    // The scene is rebuilt only when the figure identity or asset changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figure, modelAsset, manifest, reducedMotion]);

  /* Build scene contents once the handle exists. */
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    const build = async () => {
      handle.group.clear();
      handle.parts.clear();
      handle.anchors.clear();
      if (figure.kind === 'model3d' && modelAsset !== undefined) {
        const loader = new GLTFLoader();
        const parse = (data: ArrayBuffer): Promise<THREE.Group> => new Promise((resolve, reject) => {
          loader.parse(data, '', (gltf) => resolve(gltf.scene), reject);
        });
        let root: THREE.Group;
        try {
          if (typeof modelAsset === 'string') {
            root = (await new Promise<THREE.Group>((resolve, reject) => loader.load(modelAsset, (g) => resolve(g.scene), undefined, reject)));
          } else {
            const bytes = modelAsset instanceof Blob ? await modelAsset.arrayBuffer() : modelAsset;
            root = await parse(bytes);
          }
        } catch (error) {
          onError?.({ code: 'model-load-failed', detail: error instanceof Error ? error.message : String(error) });
          return;
        }
        if (cancelled) return;
        handle.group.add(root);
        for (const [partId, def] of Object.entries(manifest?.parts ?? {})) {
          const nodes = root.getObjectsByProperty('name', def.nodes[0] ?? '');
          const object = nodes[0] ?? root.getObjectByName(def.nodes[0] ?? '');
          if (object) handle.parts.set(partId, object);
          if (def.anchor) handle.anchors.set(partId, def.anchor);
        }
      } else if (figure.kind === 'scene3d') {
        const positions = new Map<string, V3>();
        for (const object of figure.objects) {
          if (object.at) positions.set(object.id, object.at.map((n) => Math.max(-8, Math.min(8, n))) as V3);
          else if (object.place?.relativeTo) {
            const base = positions.get(object.place.relativeTo) ?? [0, 0, 0];
            positions.set(object.id, placeRelative(base, object.place.dir ?? 'right', object.place.gap));
          } else positions.set(object.id, [0, 0, 0]);
        }
        for (const arrange of figure.arrange ?? []) {
          const next = arrangePositions(arrange.of, arrange.kind, arrange.spacing, positions);
          for (const [id, p] of next) positions.set(id, p);
        }
        const shapes: Record<string, () => THREE.BufferGeometry> = {
          sphere: () => new THREE.SphereGeometry(sizeUnits('md'), 18, 12),
          cylinder: () => new THREE.CylinderGeometry(sizeUnits('sm'), sizeUnits('sm'), sizeUnits('lg'), 14),
          cone: () => new THREE.ConeGeometry(sizeUnits('md'), sizeUnits('lg'), 14),
          torus: () => new THREE.TorusGeometry(sizeUnits('md'), sizeUnits('xs'), 8, 22),
          box: () => new THREE.BoxGeometry(sizeUnits('md'), sizeUnits('md'), sizeUnits('md')),
          plane: () => new THREE.PlaneGeometry(sizeUnits('lg'), sizeUnits('lg')),
          arrow: () => new THREE.ConeGeometry(sizeUnits('sm'), sizeUnits('lg'), 6),
          ring: () => new THREE.TorusGeometry(sizeUnits('lg'), sizeUnits('xs'), 6, 24),
          tube: () => new THREE.CylinderGeometry(sizeUnits('xs'), sizeUnits('xs'), sizeUnits('lg'), 8),
        };
        for (const object of figure.objects.slice(0, 64)) {
          const geometry = shapes[object.shape]?.() ?? shapes.box!();
          const material = new THREE.MeshStandardMaterial({ color: tokenColor(object.color), roughness: 0.6 });
          const mesh = new THREE.Mesh(geometry, material);
          const size = sizeUnits(object.size);
          mesh.scale.setScalar(object.shape === 'sphere' || object.shape === 'box' || object.shape === 'cone' ? size / sizeUnits('md') : 1);
          mesh.position.set(...(positions.get(object.id) ?? [0, 0, 0]));
          mesh.name = object.id;
          handle.group.add(mesh);
          handle.parts.set(object.id, mesh);
          if (object.animate) handle.spinners.push({ object: mesh, effect: object.animate.effect, speed: object.animate.speed ?? 1, around: object.animate.around });
          if (object.label) handle.anchors.set(object.id, positions.get(object.id) ?? [0, 0, 0]);
        }
      }
      if (cancelled) return;
      const view: ResolvedView = resolveView(figure.view, manifest?.views, handle.anchors) ?? ISO;
      handle.setGoal({ position: new THREE.Vector3(...view.position), target: new THREE.Vector3(...view.target), fov: view.fov ?? 45, duration: reducedMotion ? 0 : 500, ease: SMOOTH, started: performance.now() });
      setReady(true);
      handle.invalidate();
    };
    void build();
    return () => { cancelled = true; };
  }, [handle, figure, modelAsset, manifest, reducedMotion, onError]);

  return { handle, ready, snapshot, active };
}

function tokenColor(token: string | undefined): number {
  const colors: Record<string, number> = {
    accent: 0x6d5efc, info: 0x2f80ed, success: 0x27ae60, warn: 0xe2a200,
    danger: 0xd64545, muted: 0x8a8a80, ink: 0x1f1f1d,
  };
  return colors[token ?? 'accent'] ?? colors.accent!;
}

/* ------------------------------------------------------------------ *
 * Directive application
 * ------------------------------------------------------------------ */

type Directives = Partial<{
  view: ViewRef;
  show: { parts?: PartId[]; groups?: string[] };
  highlight: PartId[];
  dim: PartId[] | 'others';
  isolate: PartId[];
  explode: number;
  cutaway: string;
  animation: { id: string; loop?: boolean; speed?: number };
  flow: { path: string; pulse?: boolean };
  labels: Array<{ part: PartId; text: Inline[] }>;
}>;

function applyDirectives(handle: SceneHandle, manifest: ModelManifest | undefined, d: Directives, figure: Model3DFigure | Scene3DFigure, reducedMotion: boolean, onError?: (error: LibraryError) => void): void {
  if (d.view) {
    const view: ResolvedView | undefined = resolveView(d.view, manifest?.views, handle.anchors);
    if (!view) onError?.({ code: 'unknown-view', detail: `Unknown view: ${JSON.stringify(d.view)}` });
    else handle.setGoal({ position: new THREE.Vector3(...view.position), target: new THREE.Vector3(...view.target), fov: view.fov ?? 45, duration: reducedMotion ? 0 : 450, ease: SMOOTH, started: performance.now() });
  }
  const known = (part: PartId) => {
    if (!handle.parts.has(part)) { onError?.({ code: 'unknown-part', detail: `Unknown part: ${part}` }); return false; }
    return true;
  };
  const focused = new Set<PartId>([
    ...(d.highlight ?? []), ...(Array.isArray(d.dim) ? d.dim : []), ...(d.isolate ?? []),
    ...(d.show?.parts ?? []), ...(d.labels ?? []).map((l) => l.part),
  ]);
  for (const part of focused) known(part);
  if (d.isolate) {
    const allowed = new Set(d.isolate);
    for (const [part, object] of handle.parts) object.visible = allowed.has(part);
  } else if (d.show?.parts) {
    const allowed = new Set(d.show.parts);
    for (const [part, object] of handle.parts) object.visible = allowed.has(part);
  } else {
    for (const object of handle.parts.values()) object.visible = true;
  }
  const dimmed = d.dim === 'others' ? new Set([...handle.parts.keys()].filter((p) => !(d.highlight ?? []).includes(p))) : new Set(d.dim ?? []);
  for (const [part, object] of handle.parts) {
    object.traverse((child) => {
      const mat = (child as THREE.Mesh).material;
      const materials = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const m of materials) {
        const std = m as THREE.MeshStandardMaterial;
        if (!std.isMaterial) continue;
        std.emissive?.setHex?.(0x000000);
        std.opacity = dimmed.has(part) ? 0.28 : 1;
        std.transparent = dimmed.has(part);
        if ((d.highlight ?? []).includes(part)) std.emissive?.setHex?.(0x2a2550);
      }
    });
  }
  if (d.explode !== undefined) {
    for (const [part, object] of handle.parts) {
      const vector = manifest?.explode?.[part] ?? [0, 0.35, 0];
      object.position.set(vector[0] * d.explode, vector[1] * d.explode, vector[2] * d.explode);
    }
  }
  if (d.cutaway) {
    const cut = manifest?.cutaways?.[d.cutaway];
    if (!cut) onError?.({ code: 'unknown-part', detail: `Unknown cutaway: ${d.cutaway}` });
    else handle.scene.userData.cutaway = cut.plane;
  }
  if (d.animation) {
    const clip = manifest?.animations?.[d.animation.id];
    if (!clip) onError?.({ code: 'unknown-part', detail: `Unknown animation: ${d.animation.id}` });
    else if (handle.mixer) {
      handle.mixer.stopAllAction();
      const action = handle.mixer.clipAction(THREE.AnimationClip.findByName(handle.mixer.getRoot() as THREE.Object3D, clip.clip) ?? new THREE.AnimationClip(clip.clip, 1, []));
      action.loop = clip.loop || d.animation.loop ? THREE.LoopRepeat : THREE.LoopOnce;
      action.timeScale = d.animation.speed ?? 1;
      action.play();
    }
  }
  if (d.flow) {
    const path = manifest?.paths?.[d.flow.path];
    if (!path) onError?.({ code: 'unknown-part', detail: `Unknown flow path: ${d.flow.path}` });
    else handle.scene.userData.flow = path;
  }
  handle.invalidate();
}

/* ------------------------------------------------------------------ *
 * Public renderer + fallback
 * ------------------------------------------------------------------ */

function inlineLabel(content: Inline[] | undefined): string | undefined {
  if (!content) return undefined;
  const text = content
    .map((part) => {
      if (typeof part === 'string') return part;
      const value = (part as { text?: unknown }).text;
      return typeof value === 'string' ? value : '';
    })
    .join('');
  return text || undefined;
}

function partsOf(figure: Model3DFigure | Scene3DFigure, manifest?: ModelManifest): Array<{ id: string; label: string }> {
  if (figure.kind === 'scene3d') {
    return figure.objects.map((object) => ({ id: object.id, label: inlineLabel(object.label) ?? object.id }));
  }
  return Object.entries(manifest?.parts ?? {}).map(([id, p]) => ({ id, label: p.label }));
}

function Fallback({ figure, nodeId, manifest, poster, emit, alt }: {
  figure: Model3DFigure | Scene3DFigure;
  nodeId: string;
  manifest?: ModelManifest;
  poster?: string;
  emit: (event: UIEvent) => void;
  alt: string;
}): ReactNode {
  const parts = partsOf(figure, manifest);
  return (
    <div className="dg-figure3d dg-figure3d-fallback" data-dg-part="root" data-dg-figure="figure3d" data-node-id={nodeId}>
      {poster && <img className="dg-figure3d-poster" data-dg-part="poster" src={poster} alt="" />}
      <p className="dg-figure3d-alt" data-dg-part="alt">{alt}</p>
      {parts.length > 0 && (
        <ul className="dg-figure3d-parts" data-dg-part="pick-list" aria-label="Model parts">
          {parts.map((part) => (
            <li key={part.id}>
              <button type="button" data-dg-part="part" onClick={() => emit({ type: 'focus', nodeId, ref: `${nodeId}/${part.id}`, label: part.label })}>
                {part.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Figure3DRenderer(props: Figure3DRendererProps): ReactNode {
  const { figure, nodeId, emit, onError, assets, connector, manifest, modelAsset, poster: posterProp, loadError, firedCues, reducedMotion, locale, renderInline } = props;
  const [autoPoster, setAutoPoster] = useState<string | undefined>(undefined);
  const poster = posterProp ?? autoPoster;
  const [flowPhase, setFlowPhase] = useState(0);
  const { handle, ready, snapshot, active } = useScene(nodeId, manifest, figure, modelAsset, reducedMotion, emit, onError);
  const hostRef = useRef<HTMLDivElement>(null);
  const lastCues = useRef(0);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  useEffect(() => {
    if (posterProp) return;
    let ref = manifest?.assets.poster ?? (figure.kind === 'model3d' ? 'models/assembly-poster.png' : undefined);
    if (typeof ref === 'object' && ref) ref = ref.connectorAsset;
    if (!ref) return;
    const cached = assets.peek(ref);
    if (cached) { setAutoPoster(cached); return; }
    let cancelled = false;
    void assets.resolve(ref).then((url) => { if (!cancelled && url) setAutoPoster(url); });
    if (connector && manifest) {
      void connector.getAsset(manifest.id, ref as string, { signal: new AbortController().signal, locale }).then((value) => {
        if (cancelled) return;
        if (typeof value === 'string') setAutoPoster(value);
        else if (value instanceof Blob) setAutoPoster(URL.createObjectURL(value));
        else if (value instanceof ArrayBuffer) setAutoPoster(URL.createObjectURL(new Blob([value], { type: 'image/png' })));
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [assets, connector, manifest, figure, locale, posterProp]);

  /* Tour: apply every step whose cue has fired, in document order. */
  const tour = figure.tour ?? [];
  useEffect(() => {
    if (!handle || !ready) return;
    const cueList = [...firedCues];
    const steps = tour.filter((step) => {
      const trigger = step.trigger;
      return trigger?.on === 'start' || (trigger?.on === 'cue' && cueList.includes(trigger.id));
    });
    if (steps.length <= lastCues.current) return;
    const batch = steps.slice(lastCues.current);
    lastCues.current = steps.length;
    for (const step of batch) {
      const { trigger: _trigger, duration: _duration, ease: _ease, ...directives } = step;
      applyDirectives(handle, manifest, directives as Directives, figure, reducedMotion, (e) => errorRef.current?.(e));
    }
  }, [handle, ready, firedCues, tour, manifest, figure, reducedMotion]);

  /* Static directives (non-tour figures). */
  const model = figure.kind === 'model3d' ? figure : undefined;
  const staticKey = JSON.stringify({
    view: figure.view, show: model?.show, highlight: model?.highlight, dim: model?.dim,
    isolate: model?.isolate, explode: model?.explode, cutaway: model?.cutaway,
    animation: model?.animation, flow: model?.flow, labels: model?.labels,
  });
  const appliedKey = useRef<string>('');
  useEffect(() => {
    if (!handle || !ready || tour.length || appliedKey.current === staticKey) return;
    appliedKey.current = staticKey;
    applyDirectives(handle, manifest, JSON.parse(staticKey) as Directives, figure, reducedMotion, (e) => errorRef.current?.(e));
  }, [handle, ready, staticKey, tour.length, manifest, figure, reducedMotion]);

  useEffect(() => {
    if (!handle?.scene.userData.flow) return;
    const id = setInterval(() => setFlowPhase((p) => (p + 1) % 100), 120);
    return () => clearInterval(id);
  }, [handle?.scene.userData.flow, ready]);

  const views = useMemo(() => {
    const built = Object.keys(CAMERA_PRESETS);
    return [...built, ...Object.keys(manifest?.views ?? {})];
  }, [manifest]);
  const labels = figure.kind === 'model3d' ? figure.labels ?? [] : [];
  const attribution = manifest?.license?.attribution;

  const selectView = (view: string) => {
    if (!handle) return;
    const resolved: ResolvedView | undefined = resolveView(builtView(view), manifest?.views, handle.anchors);
    if (!resolved) { onError?.({ code: 'unknown-view', detail: `Unknown view: ${view}` }); return; }
    emit({ type: 'action', nodeId, action: 'view', detail: { view } });
    handle.setGoal({ position: new THREE.Vector3(...resolved.position), target: new THREE.Vector3(...resolved.target), fov: resolved.fov ?? 45, duration: reducedMotion ? 0 : 450, ease: SMOOTH, started: performance.now() });
  };

  if (loadError || !webglAvailable()) {
    return <Fallback figure={figure} nodeId={nodeId} manifest={manifest} poster={poster} emit={emit} alt={figure.alt} />;
  }

  return (
    <div className="dg-figure3d" data-dg-part="root" data-dg-figure="figure3d" data-node-id={nodeId} data-dg-ready={ready ? 'true' : 'false'}>
      {poster && !ready && <img className="dg-figure3d-poster" data-dg-part="poster" src={poster} alt="" />}
      {snapshot && !active && <img className="dg-figure3d-snapshot" src={snapshot} alt="" />}
      <div className="dg-figure3d-stage" data-dg-part="stage" ref={hostRef} />
      <ul className="dg-figure3d-parts" data-dg-part="pick-list" aria-label="Model parts">
        {partsOf(figure, manifest).map((part) => (
          <li key={part.id}>
            <button type="button" data-dg-part="part" onClick={() => emit({ type: 'focus', nodeId, ref: `${nodeId}/${part.id}`, label: part.label })}>{part.label}</button>
          </li>
        ))}
      </ul>
      {labels.length > 0 && ready && (
        <div className="dg-figure3d-labels" data-dg-part="labels">
          {labels.map((label, i) => <span key={`${label.part}-${i}`} data-dg-part="label">{renderInline ? renderInline(label.text) : label.text.map((t) => String(t)).join('')}</span>)}
        </div>
      )}
      {figure.kind === 'model3d' && figure.flow && ready && <span className="dg-figure3d-flow" data-dg-part="flow" data-phase={flowPhase} aria-hidden="true" />}
      {figure.controls !== 'none' && (
        <div className="dg-figure3d-controls" data-dg-part="views-bar">
          {views.map((view) => (
            <button key={view} type="button" data-dg-part="view" onClick={() => selectView(view)}>{view}</button>
          ))}
          <button type="button" data-dg-part="reset" onClick={() => selectView('iso')}>Reset</button>
        </div>
      )}
      {attribution && <p className="dg-figure3d-caption" data-dg-part="caption">{attribution}</p>}
      <span className="dg-figure3d-alt-sr" data-dg-part="fallback">{figure.alt}</span>
    </div>
  );
}

function builtView(view: string): ViewRef {
  if (['front', 'back', 'left', 'right', 'top', 'bottom', 'iso'].includes(view)) return view as ViewRef;
  return { view };
}

export default Figure3DRenderer;
