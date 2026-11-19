/**
 * Lazy figure chunk (M5). Loaded via `dreamer-genui/figures` only when a figure
 * node enters; never part of the initial React bundle. All host callbacks are
 * passed in as props (no provider imports), so context identity stays intact
 * and the chunk can be shipped as a separate tsup entry.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Figure } from '../schema/figures';
import type { Inline } from '../schema/inline';
import type { UIEvent } from '../schema/events';
import type { AssetResolver } from '../core/assets';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Funnel, FunnelChart,
  Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, RadialBar, RadialBarChart, ResponsiveContainer, Sankey, Scatter, ScatterChart,
  Tooltip, Treemap, XAxis, YAxis,
} from 'recharts';
import { layoutFlowchart, layoutRadial } from './layout';
import type { LaidEdge, LayoutResult } from './layout';

export type InlineRenderer = (content: Inline[] | undefined) => ReactNode;

export interface FigureRendererProps {
  figure: Figure;
  nodeId: string;
  emit: (event: UIEvent) => void;
  renderInline: InlineRenderer;
  assets: AssetResolver;
  reducedMotion: boolean;
}

function labelOf(content: Inline[] | string | undefined, render: InlineRenderer): string {
  if (typeof content === 'string') return content;
  return (content ?? []).map((part) => (typeof part === 'string' ? part : '')).join(' ').trim();
}

/** Normalise a label that may be a plain string into Inline[] for the renderer. */
function toInline(content: Inline[] | string | undefined): Inline[] {
  if (typeof content === 'string') return [content];
  return content ?? [];
}

function FigureRoot({ figure, children, className = '', role = 'img' }: { figure: Figure; children: ReactNode; className?: string; role?: 'img' | 'group' }): ReactNode {
  return (
    <div
      className={`dg-figure dg-figure-${figure.kind} ${className}`.trim()}
      data-dg-part="root"
      data-dg-figure={figure.kind}
      role={role}
      aria-label={figure.alt}
    >
      {children}
      <span className="dg-figure-sr-alt" data-dg-part="fallback">{figure.alt}</span>
    </div>
  );
}

/** Resolve `{ asset: id }` references through the host callback; never fetch. */
function useSource(src: string | { asset: string } | undefined, assets: AssetResolver): string | undefined {
  const id = typeof src === 'object' && src !== null ? src.asset : undefined;
  const literal = typeof src === 'string' ? src : undefined;
  const [url, setUrl] = useState<string | undefined>(() => (id ? assets.peek(id) : literal));
  useEffect(() => {
    if (literal !== undefined) { setUrl(literal); return; }
    if (!id) { setUrl(undefined); return; }
    const cached = assets.peek(id);
    if (cached) { setUrl(cached); return; }
    let live = true;
    void assets.resolve(id).then((result) => { if (live) setUrl(result); });
    return () => { live = false; };
  }, [id, literal, assets]);
  return url;
}

function ImageView({ figure, nodeId, assets, emit }: FigureRendererProps & { figure: Extract<Figure, { kind: 'image' }> }): ReactNode {
  const url = useSource(figure.src, assets);
  const [failed, setFailed] = useState(false);
  return (
    <FigureRoot figure={figure}>
      <div className="dg-figure-surface" data-dg-part="surface">
        {url && !failed ? (
          <img
            src={url}
            alt={figure.alt}
            className="dg-figure-image"
            data-dg-part="poster"
            onError={() => setFailed(true)}
            onClick={() => emit({ type: 'focus', nodeId, label: figure.alt })}
          />
        ) : (
          <div className="dg-figure-poster" data-dg-part="poster">{figure.alt}</div>
        )}
      </div>
    </FigureRoot>
  );
}

function IconView({ figure, nodeId, emit }: FigureRendererProps & { figure: Extract<Figure, { kind: 'icon' }> }): ReactNode {
  const label = figure.alt ?? figure.name;
  return (
    <FigureRoot figure={figure}>
      <button
        type="button"
        className="dg-figure-icon"
        data-dg-part="node"
        aria-label={label}
        onClick={() => emit({ type: 'focus', nodeId, ref: figure.name, label })}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <circle cx="24" cy="24" r="21" className="dg-figure-icon-ring" />
          <text x="24" y="30" textAnchor="middle" className="dg-figure-icon-text">{figure.name.slice(0, 2)}</text>
        </svg>
      </button>
    </FigureRoot>
  );
}

interface FigNode { id: string; label: Inline[] | string; detail?: Inline[]; note?: string; when?: string; lane?: string }

/** Shared SVG graph renderer for diagrams, flowcharts and timelines. */
function GraphView({
  figure, nodeId, emit, renderInline, layout, caption, decls, stepper, reduce, laneLabels, nodeClass, nodeStyle,
}: FigureRendererProps & {
  figure: Figure;
  layout: LayoutResult<FigNode>;
  caption?: string;
  decls?: ReactNode;
  stepper?: boolean;
  reduce: boolean;
  laneLabels?: Record<string, string>;
  nodeClass?: (item: FigNode, index: number) => string | undefined;
  nodeStyle?: (item: FigNode, index: number) => CSSProperties | undefined;
}) {
  const focusable = 'focusable' in figure && figure.focusable === true;
  const items = layout.nodes;
  const [active, setActive] = useState(0);
  return (
    <FigureRoot figure={figure} role={focusable ? 'group' : 'img'}>
      <div className="dg-figure-surface" data-dg-part="surface"
        data-dg-stepper={stepper ? 'true' : undefined}
        style={{ '--dg-figure-w': `${layout.width}px`, '--dg-figure-h': `${layout.height}px` } as CSSProperties}>
        {Object.entries(layout.lanes).map(([id, box]) => (
          <div key={id} className="dg-figure-lane" data-dg-part="lane" data-dg-lane={id}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
            {laneLabels?.[id] ? <span className="dg-figure-lane-label" data-dg-part="lane-label">{laneLabels[id]}</span> : null}
          </div>
        ))}
        <svg className="dg-figure-edges" data-dg-part="edges" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
          {layout.edges.map((edge: LaidEdge, i) => (
            <g key={`${edge.from}-${edge.to}-${i}`} className={`dg-figure-edge dg-figure-edge-${edge.kind ?? 'flow'}${edge.back ? ' dg-figure-edge-back' : ''}${figure.kind === 'flowchart' && 'flow' in figure && figure.flow === 'pulse' ? ' dg-figure-edge-pulse' : ''}`} data-dg-part="edge">
              <path d={edge.path} pathLength={1} />
            </g>
          ))}
          {decls}
        </svg>
        <div className="dg-figure-nodes" data-dg-part="nodes">
          {items.map((node, i) => {
            const label = node.item.label;
            const body = (
              <>
                <span className="dg-figure-node-label" data-dg-part="node-label">{renderInline(toInline(label))}</span>
                {node.item.when ? <span className="dg-figure-node-when">{node.item.when}</span> : null}
                {node.item.detail ? <span className="dg-figure-node-detail">{renderInline(toInline(node.item.detail))}</span> : null}
                {node.item.note ? <span className="dg-figure-node-note">{node.item.note}</span> : null}
              </>
            );
            const style: CSSProperties = {
              left: node.x, top: node.y, width: node.width, minHeight: node.height,
              animationDelay: !reduce && 'reveal' in figure && figure.reveal === 'sequential' ? `${i * 90}ms` : undefined,
              ...nodeStyle?.(node.item, i),
            };
            const shape = 'shape' in node.item ? String((node.item as FigNode & { shape?: string }).shape ?? 'step') : undefined;
            // The stepper is responsive: all nodes render on wide boards; only a
            // narrow container hides non-active layers (see base.css @container).
            const activeAttr = stepper ? (node.layer === active ? 'true' : 'false') : undefined;
            return focusable ? (
              <button key={node.id} type="button" className={`dg-figure-node dg-figure-node-focusable${nodeClass?.(node.item, i) ? ' ' + nodeClass(node.item, i) : ''}`} data-dg-part="node"
                data-dg-ref={`${nodeId}/${node.id}`} data-dg-shape={shape} data-dg-active={activeAttr}
                style={style}
                aria-label={labelOf(label, renderInline)}
                onClick={() => {
                  setActive(node.layer);
                  emit({ type: 'focus', nodeId, ref: `${nodeId}/${node.id}`, label: labelOf(label, renderInline) });
                }}>
                {body}
              </button>
            ) : (
              <div key={node.id} className={`dg-figure-node${nodeClass?.(node.item, i) ? ' ' + nodeClass(node.item, i) : ''}`} data-dg-part="node" data-dg-shape={shape} data-dg-active={activeAttr} style={style}>
                {body}
              </div>
            );
          })}
        </div>
        {stepper ? (
          <div className="dg-figure-stepper" role="group" aria-label="Process steps">
            {items.map((node, i) => (
              <button key={node.id} type="button" aria-current={i === active ? 'step' : undefined}
                className="dg-figure-step-dot" data-dg-active={i === active ? 'true' : undefined}
                onClick={() => setActive(i)}>{i + 1}</button>
            ))}
          </div>
        ) : null}
      </div>
      {caption ? <p className="dg-figure-caption" data-dg-part="caption">{caption}</p> : null}
    </FigureRoot>
  );
}

const RADIAL_HUES = ['--dg-color-accent', '--dg-color-info', '--dg-color-success', '--dg-color-warn', '--dg-color-danger', '--dg-color-muted'] as const;
const HUE_FALLBACK: Record<string, string> = {
  '--dg-color-accent': '#2e5dc4',
  '--dg-color-info': '#2563eb',
  '--dg-color-success': '#15803d',
  '--dg-color-warn': '#b45309',
  '--dg-color-danger': '#b91c1c',
  '--dg-color-muted': '#565650',
};
function hueValue(name: string | undefined): string {
  if (!name) return 'var(--dg-color-accent, #2e5dc4)';
  return `var(${name}, ${HUE_FALLBACK[name] ?? '#2e5dc4'})`;
}

/**
 * Radial / orbit / cycle diagrams (reference: wheel-of-life and petal-radial
 * compositions). Fixed-size HTML cards on a computed polar ring with SVG rings
 * and spokes behind them; no 184px boxes fighting for space on a circle.
 */
function PolarDiagram(props: FigureRendererProps & { figure: Extract<Figure, { kind: 'diagram' }> }): ReactNode {
  const { figure, nodeId, emit, renderInline, reducedMotion } = props;
  const rawId = useId();
  const uid = `dg-polar-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const nodes = figure.nodes;
  const focusable = figure.focusable === true;
  const cycle = figure.layout === 'cycle';
  const rootId = !cycle && figure.root && nodes.some((node) => node.id === figure.root) ? figure.root : undefined;
  const satellites = nodes.filter((node) => node.id !== rootId);
  const count = Math.max(1, satellites.length);
  const cardW = count >= 6 ? 112 : 122;
  const radius = count <= 3 ? 96 : count <= 6 ? 128 : 152;
  const box = Math.max(330, Math.round(2 * (radius + cardW / 2 + 10)));
  const cx = box / 2;
  const cy = box / 2;
  const placed = new Map<string, { x: number; y: number }>();
  if (rootId) placed.set(rootId, { x: cx, y: cy });
  satellites.forEach((node, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    placed.set(node.id, { x: Math.round(cx + Math.cos(angle) * radius), y: Math.round(cy + Math.sin(angle) * radius) });
  });
  const hueOf = (id: string) => {
    const index = satellites.findIndex((node) => node.id === id);
    return index < 0 ? undefined : hueValue(RADIAL_HUES[index % RADIAL_HUES.length] ?? RADIAL_HUES[0]);
  };
  const trim = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const pad = 56;
    return { x1: a.x + ux * pad, y1: a.y + uy * pad, x2: b.x - ux * pad, y2: b.y - uy * pad };
  };
  return (
    <FigureRoot figure={figure} role={focusable ? 'group' : 'img'}>
      <div className="dg-figure-surface dg-polar-surface" data-dg-part="surface" data-dg-polar={figure.layout}
        style={{ width: box, height: box, minHeight: box, marginInline: 'auto' }}>
        <svg className="dg-polar-layer" viewBox={`0 0 ${box} ${box}`} aria-hidden="true" focusable="false">
          <defs>
            <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--dg-color-muted, #565650)" />
            </marker>
          </defs>
          {cycle ? (
            <circle className="dg-figure-ring dg-polar-cycle-ring" cx={cx} cy={cy} r={radius} />
          ) : (
            <>
              <circle className="dg-figure-ring" cx={cx} cy={cy} r={radius} />
              <circle className="dg-figure-ring dg-figure-ring-inner" cx={cx} cy={cy} r={radius * 0.64} />
              {rootId ? satellites.map((node) => {
                const point = placed.get(node.id)!;
                return <line key={node.id} className="dg-polar-spoke" x1={cx} y1={cy} x2={point.x} y2={point.y} style={{ stroke: hueOf(node.id) }} />;
              }) : null}
            </>
          )}
          {cycle ? figure.edges.map((edge, i) => {
            const a = placed.get(edge.from);
            const b = placed.get(edge.to);
            if (!a || !b) return null;
            const line = trim(a, b);
            return (
              <line key={`${edge.from}-${edge.to}-${i}`} className="dg-polar-edge" data-dg-part="edge"
                x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} markerEnd={`url(#${uid}-arrow)`} />
            );
          }) : null}
        </svg>
        {nodes.map((node, i) => {
          const point = placed.get(node.id);
          if (!point) return null;
          const isHub = node.id === rootId;
          const style = {
            left: point.x,
            top: point.y,
            '--dg-node-hue': hueOf(node.id) ?? 'var(--dg-color-accent, #2e5dc4)',
            animationDelay: !reducedMotion ? `${i * 70}ms` : undefined,
          } as CSSProperties;
          const body = isHub ? (
            <span className="dg-polar-hub-label">{renderInline(toInline(node.label))}</span>
          ) : (
            <>
              <span className="dg-polar-dot" aria-hidden="true" />
              <span className="dg-polar-label">{renderInline(toInline(node.label))}</span>
              {node.note ? <span className="dg-polar-note">{node.note}</span> : null}
            </>
          );
          const className = `dg-polar-item ${isHub ? 'dg-polar-hub' : 'dg-polar-card'}${!reducedMotion ? ' dg-figure-pop' : ''}`;
          return focusable ? (
            <button key={node.id} type="button" className={className} data-dg-part="node"
              data-dg-ref={`${nodeId}/${node.id}`} style={style}
              aria-label={labelOf(node.label, renderInline)}
              onClick={() => emit({ type: 'focus', nodeId, ref: `${nodeId}/${node.id}`, label: labelOf(node.label, renderInline) })}>
              {body}
            </button>
          ) : (
            <div key={node.id} className={className} data-dg-part="node" style={style}>{body}</div>
          );
        })}
      </div>
    </FigureRoot>
  );
}

function DiagramView(props: FigureRendererProps & { figure: Extract<Figure, { kind: 'diagram' }> }): ReactNode {
  const { figure } = props;
  const nodes: FigNode[] = figure.nodes.map((node) => ({ id: node.id, label: node.label, note: node.note }));
  if (figure.layout === 'tree') {
    const layout = layoutRadial(nodes, figure.edges, (node) => node.id, 'tree');
    return <GraphView {...props} layout={layout} reduce={props.reducedMotion} />;
  }
  return <PolarDiagram {...props} figure={figure} />;
}

/** Silhouette for each flowchart symbol (reference: symbols legend). */
function FlowShape({ shape }: { shape: string }): ReactNode {
  const common = { vectorEffect: 'non-scaling-stroke' as const };
  return (
    <svg className="dg-flow-shape" viewBox="0 0 184 68" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {shape === 'decision' ? (
        <polygon points="92,2 182,34 92,66 2,34" fill="var(--dg-color-warn, #b45309)" fillOpacity="0.2" stroke="var(--dg-color-warn, #b45309)" strokeWidth="2.2" strokeLinejoin="round" {...common} />
      ) : shape === 'start' || shape === 'end' ? (
        <rect x="1" y="1" width="182" height="66" rx="33" fill="var(--dg-color-success, #15803d)" fillOpacity="0.14" stroke="var(--dg-color-success, #15803d)" strokeWidth="2.2" {...common} />
      ) : shape === 'io' ? (
        <polygon points="20,2 182,2 164,66 2,66" fill="var(--dg-color-info, #2563eb)" fillOpacity="0.14" stroke="var(--dg-color-info, #2563eb)" strokeWidth="2.2" {...common} />
      ) : shape === 'substance' ? (
        <rect x="1" y="1" width="182" height="66" rx="16" fill="var(--dg-color-info, #2563eb)" fillOpacity="0.14" stroke="var(--dg-color-info, #2563eb)" strokeWidth="2" {...common} />
      ) : shape === 'note' ? (
        <rect x="1" y="1" width="182" height="66" rx="8" fill="none" stroke="var(--dg-color-muted, #565650)" strokeWidth="1.6" strokeDasharray="7 5" {...common} />
      ) : (
        <rect x="1" y="1" width="182" height="66" rx="10" fill="var(--dg-color-surface, #ffffff)" stroke="var(--dg-color-ink, #1f1f1d)" strokeOpacity="0.55" strokeWidth="1.8" {...common} />
      )}
    </svg>
  );
}

/** Flowchart renderer: SVG silhouettes under HTML labels, visible arrows and edge chips. */
function FlowView({
  figure, nodeId, emit, renderInline, layout, stepper, reduce, laneLabels, numbered, edgeLabels,
}: FigureRendererProps & {
  figure: Extract<Figure, { kind: 'flowchart' }>;
  layout: LayoutResult<FigNode>;
  stepper: boolean;
  reduce: boolean;
  laneLabels: Record<string, string>;
  numbered: boolean;
  edgeLabels: { from: string; to: string; kind?: string; label: Inline[] }[];
}) {
  const focusable = figure.focusable === true;
  const items = layout.nodes;
  const [active, setActive] = useState(0);
  const rawId = useId();
  const uid = `dg-flow-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pos = new Map(items.map((node) => [node.id, node]));
  const kinds = ['flow', 'branch', 'recycle', 'optional'] as const;
  return (
    <FigureRoot figure={figure} role={focusable ? 'group' : 'img'}>
      <div className="dg-figure-surface dg-figure-flow" data-dg-part="surface"
        data-dg-stepper={stepper ? 'true' : undefined}
        style={{ '--dg-figure-w': `${layout.width}px`, '--dg-figure-h': `${layout.height}px` } as CSSProperties}>
        {Object.entries(layout.lanes).map(([id, box]) => (
          <div key={id} className="dg-figure-lane" data-dg-part="lane" data-dg-lane={id}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
            {laneLabels[id] ? <span className="dg-figure-lane-label" data-dg-part="lane-label">{laneLabels[id]}</span> : null}
          </div>
        ))}
        <svg className="dg-figure-edges" data-dg-part="edges" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
          <defs>
            {kinds.map((kind) => (
              <marker key={kind} id={`${uid}-${kind}`} viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z"
                  fill={kind === 'recycle' ? 'var(--dg-color-info, #2563eb)' : 'var(--dg-color-ink, #1f1f1d)'} />
              </marker>
            ))}
          </defs>
          {layout.edges.map((edge: LaidEdge, i) => (
            <g key={`${edge.from}-${edge.to}-${i}`}
              className={`dg-figure-edge dg-figure-edge-${edge.kind ?? 'flow'}${edge.back ? ' dg-figure-edge-back' : ''}${figure.flow === 'pulse' ? ' dg-figure-edge-pulse' : ''}`}
              data-dg-part="edge">
              <path d={edge.path} pathLength={1} markerEnd={`url(#${uid}-${edge.kind ?? 'flow'})`} />
            </g>
          ))}
        </svg>
        <div className="dg-flow-labels" aria-hidden="true">
          {edgeLabels.map((edge, i) => {
            const laid = layout.edges.find((item) => item.from === edge.from && item.to === edge.to);
            if (!laid?.labelPt) return null;
            return (
              <span key={`chip-${i}`} className={`dg-flow-chip dg-flow-chip-${edge.kind ?? 'flow'}`}
                data-dg-part="edge-label" style={{ left: laid.labelPt.x, top: laid.labelPt.y }}>
                {renderInline(edge.label)}
              </span>
            );
          })}
          {figure.inputs?.map((input, i) => {
            const target = pos.get(input.to);
            if (!target) return null;
            return (
              <span key={`in-${i}`} className="dg-flow-io dg-flow-io-in" data-dg-part="edge-label"
                style={{ left: target.x - 12, top: target.y + target.height / 2 }}>
                {renderInline(toInline(input.label))} <span aria-hidden="true">→</span>
              </span>
            );
          })}
          {figure.outputs?.map((output, i) => {
            const source = pos.get(output.from);
            if (!source) return null;
            return (
              <span key={`out-${i}`} className="dg-flow-io dg-flow-io-out" data-dg-part="edge-label"
                style={{ left: source.x + source.width + 12, top: source.y + source.height / 2 }}>
                <span aria-hidden="true">→</span> {renderInline(toInline(output.label))}
              </span>
            );
          })}
        </div>
        <div className="dg-figure-nodes" data-dg-part="nodes">
          {items.map((node, i) => {
            const shape = 'shape' in node.item ? String((node.item as FigNode & { shape?: string }).shape ?? 'step') : 'step';
            const activeAttr = stepper ? (node.layer === active ? 'true' : 'false') : undefined;
            const style: CSSProperties = {
              left: node.x, top: node.y, width: node.width, height: node.height,
              animationDelay: !reduce && figure.reveal === 'sequential' ? `${i * 80}ms` : undefined,
            };
            const inner = (
              <>
                <FlowShape shape={shape} />
                <span className="dg-figure-node-body">
                  <span className="dg-figure-node-label" data-dg-part="node-label">{renderInline(toInline(node.item.label))}</span>
                  {node.item.detail ? <span className="dg-figure-node-detail">{renderInline(toInline(node.item.detail))}</span> : null}
                  {node.item.note ? <span className="dg-figure-node-note">{node.item.note}</span> : null}
                </span>
                {numbered ? <span className="dg-flow-number" aria-hidden="true">{i + 1}</span> : null}
              </>
            );
            const className = `dg-figure-node dg-flow-node${!reduce && figure.reveal === 'sequential' ? ' dg-figure-pop' : ''}`;
            return focusable ? (
              <button key={node.id} type="button" className={className} data-dg-part="node"
                data-dg-ref={`${nodeId}/${node.id}`} data-dg-shape={shape} data-dg-active={activeAttr}
                style={style} aria-label={labelOf(node.item.label, renderInline)}
                onClick={() => {
                  setActive(node.layer);
                  emit({ type: 'focus', nodeId, ref: `${nodeId}/${node.id}`, label: labelOf(node.item.label, renderInline) });
                }}>
                {inner}
              </button>
            ) : (
              <div key={node.id} className={className} data-dg-part="node" data-dg-shape={shape}
                data-dg-active={activeAttr} style={style}>
                {inner}
              </div>
            );
          })}
        </div>
        {stepper ? (
          <div className="dg-figure-stepper" role="group" aria-label="Process steps">
            {items.map((node, i) => (
              <button key={node.id} type="button" aria-current={i === active ? 'step' : undefined}
                className="dg-figure-step-dot" data-dg-active={i === active ? 'true' : undefined}
                onClick={() => setActive(i)}>{i + 1}</button>
            ))}
          </div>
        ) : null}
      </div>
    </FigureRoot>
  );
}

function FlowchartView(props: FigureRendererProps & { figure: Extract<Figure, { kind: 'flowchart' }> }): ReactNode {
  const { figure } = props;
  const nodes: FigNode[] = figure.nodes.map((node) => ({
    id: node.id, label: node.label, detail: node.detail, lane: node.lane,
    ...('shape' in node ? { shape: node.shape } : {}),
  }));
  const layout = layoutFlowchart(nodes, figure.edges.map(({ from, to, kind }) => ({ from, to, kind })), {
    down: figure.direction !== 'right',
    narrow: false,
    lanes: figure.lanes?.map((lane) => lane.id),
  });
  const laneLabels = Object.fromEntries((figure.lanes ?? []).map((lane) => [lane.id, lane.label]));
  const edgeLabels = figure.edges
    .filter((edge) => edge.label !== undefined)
    .map((edge) => ({ from: edge.from, to: edge.to, kind: edge.kind, label: toInline(edge.label) }));
  return (
    <FlowView {...props} figure={figure} layout={layout} stepper={figure.narrow === 'stepper'}
      reduce={props.reducedMotion} laneLabels={laneLabels} numbered={figure.numbered === true} edgeLabels={edgeLabels} />
  );
}

const TIMELINE_HUES = [
  { var: '--dg-color-accent', hex: '#2e5dc4' },
  { var: '--dg-color-info', hex: '#2563eb' },
  { var: '--dg-color-success', hex: '#15803d' },
  { var: '--dg-color-warn', hex: '#b45309' },
  { var: '--dg-color-danger', hex: '#b91c1c' },
  { var: '--dg-color-muted', hex: '#565650' },
] as const;

function TimelineView(props: FigureRendererProps & { figure: Extract<Figure, { kind: 'timeline' }> }): ReactNode {
  const { figure, nodeId, emit, renderInline, reducedMotion } = props;
  const horizontal = figure.orientation !== 'vertical';
  const focusable = figure.focusable === true;
  const timelineEvents = figure.events;
  return (
    <FigureRoot figure={figure} role={focusable ? 'group' : 'img'}>
      <div className="dg-figure-surface dg-timeline-rail-surface" data-dg-part="surface">
        <ol className="dg-timeline-rail" data-dg-part="rail" data-dg-orientation={horizontal ? 'horizontal' : 'vertical'}>
          {timelineEvents.map((event, i) => {
            const hue = TIMELINE_HUES[i % TIMELINE_HUES.length] ?? TIMELINE_HUES[0];
            const style = { '--dg-tl-hue': `var(${hue.var}, ${hue.hex})` } as CSSProperties;
            const focusHandler = () => emit({ type: 'focus', nodeId, ref: `${nodeId}/${event.id}`, label: labelOf(event.label, renderInline) });
            const card = (
              <>
                <span className="dg-timeline-when" data-dg-part="when">{event.when}</span>
                <span className="dg-timeline-stem" aria-hidden="true" />
                <span className="dg-timeline-card" data-dg-part="node">
                  <span className="dg-timeline-label" data-dg-part="node-label">{renderInline(toInline(event.label))}</span>
                  {event.detail ? <span className="dg-timeline-detail">{renderInline(toInline(event.detail))}</span> : null}
                </span>
              </>
            );
            return (
              <li key={event.id} className="dg-timeline-item" style={style} data-dg-part="segment">
                {focusable ? (
                  <button type="button" className="dg-timeline-cell" data-dg-ref={`${nodeId}/${event.id}`}
                    aria-label={`${event.when}: ${labelOf(event.label, renderInline)}`}
                    onClick={focusHandler}>
                    {card}
                  </button>
                ) : (
                  <div className="dg-timeline-cell">{card}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </FigureRoot>
  );
}

function LabeledView(props: FigureRendererProps & { figure: Extract<Figure, { kind: 'labeled' }> }): ReactNode {
  const { figure, nodeId, assets, emit } = props;
  const url = useSource(`${figure.pack}/${figure.art}`, assets);
  return (
    <FigureRoot figure={figure}>
      <div className="dg-figure-surface" data-dg-part="surface">
        {url ? <img src={url} alt={figure.alt} className="dg-figure-image" data-dg-part="poster" /> : <div className="dg-figure-poster" data-dg-part="poster">{figure.alt}</div>}
        {figure.labels?.map((label) => (
          <button key={label.part} type="button" className="dg-figure-label" data-dg-part="node"
            data-dg-ref={`${nodeId}/${label.part}`}
            data-dg-highlight={figure.highlight?.includes(label.part) ? 'true' : undefined}
            onClick={() => emit({ type: 'focus', nodeId, ref: `${nodeId}/${label.part}`, label: label.text })}>
            {label.text || label.part}
          </button>
        ))}
      </div>
    </FigureRoot>
  );
}

const CHART_PALETTE = [
  'var(--dg-color-accent, #8faaff)',
  'var(--dg-color-info, #5cc4f5)',
  'var(--dg-color-success, #5fd08a)',
  'var(--dg-color-warn, #ffb454)',
  'var(--dg-color-danger, #f4727f)',
  'var(--dg-color-muted, #9a9cae)',
];

type ChartFigure = Extract<Figure, { kind: 'chart' }>;
type ChartDatum = ChartFigure['series'] extends Array<infer S> | undefined ? S extends { data: Array<infer D> } ? D : never : never;

/** Normalise an x key out of a data point (numbers are indexed 1..n). */
function xKeyOf(point: ChartDatum, index: number): string | number {
  return typeof point === 'number' ? index + 1 : point.x;
}

/** Ordered union of x keys across every series. */
function chartXKeys(figure: ChartFigure): Array<string | number> {
  const seen = new Map<string, string | number>();
  for (const series of figure.series ?? []) {
    series.data.forEach((point, index) => {
      const key = xKeyOf(point, index);
      const id = String(key);
      if (!seen.has(id)) seen.set(id, key);
    });
  }
  return [...seen.values()];
}

function yOf(point: ChartDatum | undefined): number | undefined {
  if (point === undefined) return undefined;
  return typeof point === 'number' ? point : point.y;
}

/** x × series rows for axis-style charts. */
function chartRows(figure: ChartFigure): Array<Record<string, string | number>> {
  const xs = chartXKeys(figure);
  return xs.map((x) => {
    const row: Record<string, string | number> = { x: typeof x === 'number' ? x : x };
    for (const series of figure.series ?? []) {
      const point = series.data.find((d, i) => String(xKeyOf(d, i)) === String(x));
      const y = yOf(point);
      if (y !== undefined) row[series.name] = y;
    }
    return row;
  });
}

/** Pie / funnel / single-value rows from a given series. */
function nameValueRows(figure: ChartFigure, seriesIndex = 0): Array<{ name: string; value: number }> {
  const series = figure.series?.[seriesIndex];
  if (!series) return [];
  return series.data.map((point, i) => ({
    name: typeof point === 'number' ? String(i + 1) : String(point.x),
    value: yOf(point) ?? 0,
  }));
}

/** Treemap: merged size rows from every series. */
function treemapRows(figure: ChartFigure): Array<{ name: string; size: number }> {
  const rows: Array<{ name: string; size: number }> = [];
  for (const series of figure.series ?? []) {
    for (const [i, point] of series.data.entries()) {
      const y = yOf(point);
      rows.push({
        name: `${typeof point === 'number' ? String(i + 1) : String(point.x)} (${series.name})`,
        size: Math.abs(y ?? 0),
      });
    }
  }
  return rows.filter((row) => row.size > 0);
}

/** Sankey: node-index links resolved from the tutor's name links. */
function sankeyRows(figure: ChartFigure): {
  nodes: Array<{ name: string }>;
  links: Array<{ source: number; target: number; value: number }>;
  cyclic: boolean;
} {
  const names: string[] = [];
  const index = new Map<string, number>();
  for (const link of figure.links ?? []) {
    for (const name of [link.source, link.target]) {
      if (!index.has(name)) {
        index.set(name, names.length);
        names.push(name);
      }
    }
  }
  // d3-sankey assumes a DAG; detect cycles so a bad payload degrades to `alt`.
  const adjacency = new Map<number, number[]>();
  for (const link of figure.links ?? []) {
    const from = index.get(link.source) ?? 0;
    const to = index.get(link.target) ?? 0;
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  }
  const state = new Map<number, 1 | 2>();
  const visit = (node: number): boolean => {
    const mark = state.get(node);
    if (mark === 1) return true;
    if (mark === 2) return false;
    state.set(node, 1);
    for (const next of adjacency.get(node) ?? []) {
      if (visit(next)) return true;
    }
    state.set(node, 2);
    return false;
  };
  const cyclic = names.some((_, i) => visit(i));
  return {
    nodes: names.map((name) => ({ name })),
    links: (figure.links ?? []).map((link) => ({
      source: index.get(link.source) ?? 0,
      target: index.get(link.target) ?? 0,
      value: link.value,
    })),
    cyclic,
  };
}

const AXIS_STROKE = 'var(--dg-color-muted, #9a9cae)';
const GRID_STROKE = 'var(--dg-color-muted, #9a9cae)';
const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'var(--dg-color-surface, #1b1b30)',
  border: '1px solid var(--dg-color-ink, #e9eaf2)',
  borderRadius: 'var(--dg-radius-md, 10px)',
  color: 'var(--dg-color-ink, #e9eaf2)',
};
const tickProps = { fontSize: 11, fill: AXIS_STROKE } as const;

function ChartView(props: FigureRendererProps & { figure: ChartFigure }): ReactNode {
  const { figure, reducedMotion } = props;
  const anim = !reducedMotion;
  const palette = CHART_PALETTE;
  const series = figure.series ?? [];
  const rows = chartRows(figure);
  const surface = (children: ReactNode): ReactNode => (
    <FigureRoot figure={figure}>
      <div
        className="dg-figure-surface dg-figure-chart-surface"
        data-dg-part="surface"
        data-testid="dg-figure-chart"
        data-dg-chart-type={figure.type}
      >
        {children}
      </div>
    </FigureRoot>
  );
  const xAxis = (xLabel?: string): ReactNode => (
    <XAxis dataKey="x" stroke={AXIS_STROKE} tick={tickProps}
      label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -2, ...tickProps } : undefined} />
  );
  const yAxis = (yLabel?: string): ReactNode => (
    <YAxis stroke={AXIS_STROKE} tick={tickProps}
      label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', offset: 10, ...tickProps } : undefined} />
  );
  const grid = <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.35} vertical={false} />;
  const tooltip = <Tooltip cursor={{ stroke: AXIS_STROKE, strokeOpacity: 0.5 }} contentStyle={TOOLTIP_STYLE} />;
  const legend = <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: AXIS_STROKE }} />;
  switch (figure.type) {
    case 'bar':
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: figure.xLabel ? 16 : 4 }}>
            {grid}
            {xAxis(figure.xLabel)}
            {yAxis(figure.yLabel)}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} name={s.name} stackId={figure.stacked ? 'stack' : undefined}
                fill={palette[i % palette.length]} radius={figure.stacked ? 0 : [4, 4, 0, 0]} isAnimationActive={anim} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    case 'line':
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: figure.xLabel ? 16 : 4 }}>
            {grid}
            {xAxis(figure.xLabel)}
            {yAxis(figure.yLabel)}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Line key={s.name} type={figure.curve ?? 'monotone'} dataKey={s.name} name={s.name}
                stroke={palette[i % palette.length]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={anim} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    case 'area':
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: figure.xLabel ? 16 : 4 }}>
            {grid}
            {xAxis(figure.xLabel)}
            {yAxis(figure.yLabel)}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Area key={s.name} type={figure.curve ?? 'monotone'} dataKey={s.name} name={s.name}
                stackId={figure.stacked ? 'stack' : undefined}
                stroke={palette[i % palette.length]} fill={palette[i % palette.length]} fillOpacity={0.35}
                strokeWidth={2} isAnimationActive={anim} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    case 'composed':
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: figure.xLabel ? 16 : 4 }}>
            {grid}
            {xAxis(figure.xLabel)}
            {yAxis(figure.yLabel)}
            {tooltip}
            {legend}
            {series.map((s, i) => {
              const color = palette[i % palette.length];
              const key = s.name;
              switch (s.seriesType ?? 'bar') {
                case 'line':
                  return <Line key={key} type={figure.curve ?? 'monotone'} dataKey={key} name={key} stroke={color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={anim} />;
                case 'area':
                  return <Area key={key} type={figure.curve ?? 'monotone'} dataKey={key} name={key} stackId={figure.stacked ? 'stack' : undefined} stroke={color} fill={color} fillOpacity={0.3} isAnimationActive={anim} />;
                default:
                  return <Bar key={key} dataKey={key} name={key} stackId={figure.stacked ? 'stack' : undefined} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={anim} />;
              }
            })}
          </ComposedChart>
        </ResponsiveContainer>
      );
    case 'pie': {
      const data = nameValueRows(figure);
      const outer = 84;
      const inner = Math.round(((figure.innerRadius ?? 0) / 100) * outer);
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            {tooltip}
            {legend}
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={inner} outerRadius={outer}
              paddingAngle={2} isAnimationActive={anim}>
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={palette[i % palette.length]} stroke="var(--dg-color-bg, #0b0b1e)" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }
    case 'radar':
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={rows} outerRadius={80}>
            <PolarGrid stroke={GRID_STROKE} strokeOpacity={0.35} />
            <PolarAngleAxis dataKey="x" tick={tickProps} />
            <PolarRadiusAxis tick={tickProps} stroke={AXIS_STROKE} />
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Radar key={s.name} dataKey={s.name} name={s.name}
                stroke={palette[i % palette.length]} fill={palette[i % palette.length]} fillOpacity={0.3}
                isAnimationActive={anim} />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      );
    case 'radialBar':
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <RadialBarChart data={rows} innerRadius={18} outerRadius={100} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" dataKey={series[0]?.name ?? 'value'} domain={[0, 'auto']} tick={false} />
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <RadialBar key={s.name} dataKey={s.name} name={s.name}
                fill={palette[i % palette.length]} background isAnimationActive={anim} />
            ))}
          </RadialBarChart>
        </ResponsiveContainer>
      );
    case 'scatter': {
      const xNumeric = series.every((s) => s.data.every((d) => typeof d === 'number' || typeof d.x === 'number'));
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 8, right: 12, left: 4, bottom: figure.xLabel ? 16 : 4 }}>
            {grid}
            <XAxis dataKey="x" type={xNumeric ? 'number' : 'category'} name={figure.xLabel} stroke={AXIS_STROKE} tick={tickProps} />
            <YAxis dataKey="y" type="number" name={figure.yLabel} stroke={AXIS_STROKE} tick={tickProps} />
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Scatter key={s.name} name={s.name}
                data={s.data.map((d, di) => ({ x: xKeyOf(d, di), y: yOf(d) ?? 0 }))}
                fill={palette[i % palette.length]} isAnimationActive={anim} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      );
    }
    case 'funnel': {
      const data = nameValueRows(figure);
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <FunnelChart>
            {tooltip}
            {legend}
            <Funnel dataKey="value" data={data} nameKey="name" isAnimationActive={anim}>
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={palette[i % palette.length]} stroke="var(--dg-color-bg, #0b0b1e)" />
              ))}
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      );
    }
    case 'treemap': {
      const data = treemapRows(figure);
      const renderCell = (cellProps: { x?: number; y?: number; width?: number; height?: number; name?: string; index?: number }) => {
        const { x = 0, y = 0, width = 0, height = 0, name = '', index = 0 } = cellProps;
        if (width < 2 || height < 2) return <g />;
        return (
          <g>
            <rect x={x} y={y} width={width} height={height} fill={palette[index % palette.length]}
              stroke="var(--dg-color-bg, #0b0b1e)" strokeWidth={2} rx={4} />
            {width > 60 && height > 24 ? (
              <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle"
                fill="var(--dg-color-bg, #0b0b1e)" fontSize={12}>{name.length > 18 ? `${name.slice(0, 17)}…` : name}</text>
            ) : null}
          </g>
        );
      };
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <Treemap data={data} dataKey="size" nameKey="name" aspectRatio={4 / 3}
            content={renderCell} isAnimationActive={anim} />
        </ResponsiveContainer>
      );
    }
    case 'sankey': {
      const { nodes, links, cyclic } = sankeyRows(figure);
      if (cyclic) return surface(<div data-dg-part="surface">{figure.alt}</div>);
      return surface(
        <ResponsiveContainer width="100%" height={240}>
          <Sankey data={{ nodes, links }} node={{ fill: palette[0] }}
            link={{ stroke: 'var(--dg-color-muted, #9a9cae)', strokeOpacity: 0.4 }} nodePadding={24} />
        </ResponsiveContainer>
      );
    }
    default:
      return surface(<div data-dg-part="surface">{figure.alt}</div>);
  }
}

interface LottiePlayer {
  destroy: () => void;
  addEventListener?: (name: string, callback: () => void) => void;
  goToAndStop?: (value: number, isFrame?: boolean) => void;
}
interface LottieModule {
  loadAnimation: (params: Record<string, unknown>) => LottiePlayer;
}

/** Decode an inline animation (data URI or JSON text); URLs stay with the player. */
function lottieData(src: string): unknown | undefined {
  const trimmed = src.trim();
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch { return undefined; }
  }
  if (trimmed.startsWith('data:application/json')) {
    const comma = trimmed.indexOf(',');
    if (comma < 0) return undefined;
    const meta = trimmed.slice(0, comma);
    const body = trimmed.slice(comma + 1);
    try { return JSON.parse(meta.includes(';base64') ? atob(body) : decodeURIComponent(body)); } catch { return undefined; }
  }
  return undefined;
}

function LottieView({ figure, assets, reducedMotion }: FigureRendererProps & { figure: Extract<Figure, { kind: 'lottie' }> }): ReactNode {
  const src = useSource(figure.src, assets);
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const container = host.current;
    if (!src || !container) return;
    let disposed = false;
    let player: LottiePlayer | undefined;
    container.innerHTML = '';
    setFailed(false);
    void (async () => {
      try {
        // lottie_light is the expression-free SVG build: no eval, no new Function.
        const mod = await import('lottie-web/build/player/lottie_light');
        const lottie = ((mod as { default?: LottieModule }).default ?? (mod as unknown as LottieModule));
        if (disposed || !container) return;
        const data = lottieData(src);
        player = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop: figure.loop === true,
          autoplay: !reducedMotion,
          animationData: data,
          path: data === undefined ? src : undefined,
          rendererSettings: { progressiveLoad: true, hideOnTransparent: true },
        });
        player.addEventListener?.('data_failed', () => { if (!disposed) setFailed(true); });
        if (reducedMotion) player.goToAndStop?.(0, true);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      player?.destroy();
      container.innerHTML = '';
    };
  }, [src, reducedMotion, figure.loop]);
  return (
    <FigureRoot figure={figure}>
      {failed || !src ? (
        <div className="dg-figure-poster" data-dg-part="poster">{figure.alt}</div>
      ) : (
        <div className="dg-figure-lottie" data-dg-part="animation" ref={host} aria-hidden="true" />
      )}
    </FigureRoot>
  );
}

/** Resolve any 2D figure kind. Unknown/3D kinds return null; the wrapper falls back to `alt`. */
export function FigureRenderer(props: FigureRendererProps): ReactNode {
  switch (props.figure.kind) {
    case 'image': return <ImageView {...props} figure={props.figure} />;
    case 'icon': return <IconView {...props} figure={props.figure} />;
    case 'diagram': return <DiagramView {...props} figure={props.figure} />;
    case 'flowchart': return <FlowchartView {...props} figure={props.figure} />;
    case 'timeline': return <TimelineView {...props} figure={props.figure} />;
    case 'labeled': return <LabeledView {...props} figure={props.figure} />;
    case 'chart': return <ChartView {...props} figure={props.figure} />;
    case 'lottie': return <LottieView {...props} figure={props.figure} />;
    default: return null; // model3d/scene3d: 3D runtime (M5b)
  }
}

export default FigureRenderer;
