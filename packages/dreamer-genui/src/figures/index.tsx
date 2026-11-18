/**
 * Lazy figure chunk (M5). Loaded via `dreamer-genui/figures` only when a figure
 * node enters; never part of the initial React bundle. All host callbacks are
 * passed in as props (no provider imports), so context identity stays intact
 * and the chunk can be shipped as a separate tsup entry.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Figure } from '../schema/figures';
import type { Inline } from '../schema/inline';
import type { UIEvent } from '../schema/events';
import type { AssetResolver } from '../core/assets';
import { layoutFlowchart, layoutRadial, layoutTimeline } from './layout';
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
  figure, nodeId, emit, renderInline, layout, caption, decls, stepper, reduce, laneLabels,
}: FigureRendererProps & {
  figure: Figure;
  layout: LayoutResult<FigNode>;
  caption?: string;
  decls?: ReactNode;
  stepper?: boolean;
  reduce: boolean;
  laneLabels?: Record<string, string>;
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
            };
            const shape = 'shape' in node.item ? String((node.item as FigNode & { shape?: string }).shape ?? 'step') : undefined;
            // The stepper is responsive: all nodes render on wide boards; only a
            // narrow container hides non-active layers (see base.css @container).
            const activeAttr = stepper ? (node.layer === active ? 'true' : 'false') : undefined;
            return focusable ? (
              <button key={node.id} type="button" className="dg-figure-node dg-figure-node-focusable" data-dg-part="node"
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
              <div key={node.id} className="dg-figure-node" data-dg-part="node" data-dg-shape={shape} data-dg-active={activeAttr} style={style}>
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

function DiagramView(props: FigureRendererProps & { figure: Extract<Figure, { kind: 'diagram' }> }): ReactNode {
  const { figure, renderInline } = props;
  const nodes: FigNode[] = figure.nodes.map((node) => ({ id: node.id, label: node.label, note: node.note }));
  const layout = layoutRadial(nodes, figure.edges, (n) => n.id, figure.layout);
  return <GraphView {...props} layout={layout} reduce={props.reducedMotion} />;
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
  const decls = (
    <>
      {figure.inputs?.map((input, i) => (
        <g key={`in-${i}`} className="dg-figure-io" data-dg-part="edge-label">
          <text x={6} y={28 + i * 20}>{labelOf(input.label, props.renderInline)}</text>
        </g>
      ))}
      {figure.outputs?.map((output, i) => (
        <g key={`out-${i}`} className="dg-figure-io" data-dg-part="edge-label">
          <text x={layout.width - 80} y={layout.height - 12 - i * 20}>{labelOf(output.label, props.renderInline)}</text>
        </g>
      ))}
      {figure.edges.map((edge, i) => {
        if (!edge.label) return null;
        const laid = layout.edges.find((e) => e.from === edge.from && e.to === edge.to && (e.kind ?? 'flow') === (edge.kind ?? 'flow'));
        return (
          <text key={`el-${i}`} className="dg-figure-edge-label" data-dg-part="edge-label"
            x={(laid?.labelPt?.x ?? 0)} y={(laid?.labelPt?.y ?? 0) - 6}>
            {labelOf(edge.label, props.renderInline)}
          </text>
        );
      })}
    </>
  );
  const laneLabels = Object.fromEntries((figure.lanes ?? []).map((lane) => [lane.id, lane.label]));
  return <GraphView {...props} layout={layout} decls={decls} stepper={figure.narrow === 'stepper'} reduce={props.reducedMotion} laneLabels={laneLabels} />;
}

function TimelineView(props: FigureRendererProps & { figure: Extract<Figure, { kind: 'timeline' }> }): ReactNode {
  const { figure } = props;
  const horizontal = figure.orientation !== 'vertical';
  const nodes: FigNode[] = figure.events.map((event) => ({ id: event.id, label: event.label, detail: event.detail, when: event.when }));
  const layout = layoutTimeline(nodes, horizontal);
  return <GraphView {...props} layout={layout} reduce={props.reducedMotion} />;
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

function ChartView(props: FigureRendererProps & { figure: Extract<Figure, { kind: 'chart' }> }): ReactNode {
  const { figure } = props;
  const values = figure.series.flatMap((s) => s.data.map((d) => (typeof d === 'number' ? d : d.y)));
  const max = Math.max(1, ...values.map(Math.abs));
  const bars = figure.series.flatMap((s, si) => s.data.map((d, i) => ({ key: `${si}-${i}`, value: typeof d === 'number' ? d : d.y, si, i })));
  return (
    <FigureRoot figure={figure}>
      <svg className="dg-figure-chart" data-dg-part="surface" viewBox="0 0 400 180" role="presentation">
        {bars.map((bar) => {
          const h = (Math.abs(bar.value) / max) * 130;
          return <rect key={bar.key} className="dg-figure-chart-bar" data-dg-part="node"
            x={20 + bar.i * (360 / Math.max(1, bars.length)) + bar.si * 3}
            y={150 - h} width={Math.min(28, 320 / Math.max(1, bars.length))} height={h} />;
        })}
      </svg>
    </FigureRoot>
  );
}

function LottieView({ figure }: FigureRendererProps & { figure: Extract<Figure, { kind: 'lottie' }> }): ReactNode {
  // Expression-free player is a later milestone; show the mandatory alt now.
  return <FigureRoot figure={figure}><div className="dg-figure-poster" data-dg-part="poster">{figure.alt}</div></FigureRoot>;
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
