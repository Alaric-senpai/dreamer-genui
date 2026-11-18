import { Component, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Node } from '../../core/types';
import type { Block } from '../../schema/blocks';
import type { LibraryError } from '../../core/types';
import { createError } from '../../core/errors';
import { useDreamer } from '../provider';
import { BoardErrorContext } from '../emit-context';
import { useParts } from '../anatomy';
import { Animated } from '../motion/animated';
import { TextBlockView, ChoicesView, CalloutView, StepsView, GroupView, ListView } from './blocks';
import {
  CardView,
  AlertView,
  AccordionView,
  CollapsibleView,
  TabsView,
  BadgeView,
  ProgressView,
  CounterView,
  AvatarView,
  SeparatorView,
  CarouselView,
  KbdView,
} from './ui-kit';
import { renderInline } from './inline';

/** Fallback render for invalid/unknown/failed nodes — never blank, never crash. */
export function FallbackView({ node }: { node: Node }): ReactNode {
  const p = useParts('fallback');
  const root = p.props('root', 'dg-fallback');
  const alt = p.props('alt', 'dg-fallback-text');
  // `alt` lives on the node base, except figures where it sits inside `figure`.
  const block = node.block as { alt?: string; figure?: { alt?: string } };
  const text = node.altText ?? block.alt ?? block.figure?.alt ?? `(unable to render "${node.id}")`;
  return (
    <div {...root} data-node-id={node.id}>
      <span {...alt}>{text}</span>
    </div>
  );
}

interface NodeBoundaryProps {
  node: Node;
  onError?: (err: LibraryError) => void;
  children: ReactNode;
}

interface NodeBoundaryState {
  failed: boolean;
}

/**
 * Per-node error boundary (§2.4/§7.4): one misbehaving block degrades to its
 * `alt` fallback without taking down the rest of the board. Reset by keying
 * the boundary on the node id in `NodeView`.
 */
class NodeBoundary extends Component<NodeBoundaryProps, NodeBoundaryState> {
  override state: NodeBoundaryState = { failed: false };

  static getDerivedStateFromError(): NodeBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.props.onError?.(
      createError(
        'invalid-node',
        `Node "${this.props.node.id}" failed to render: ${message}`,
        this.props.node.id,
        this.props.node.block.type,
      ),
    );
  }

  override render(): ReactNode {
    if (this.state.failed) return <FallbackView node={this.props.node} />;
    return this.props.children;
  }
}

/** Non-null when the node cannot render normally (i.e. must show a fallback). */
function renderErrorFor(node: Node, nested: boolean): LibraryError | null {
  if (node.state === 'error') return null;
  const block = node.block;
  switch (block.type) {
    case 'group':
      return nested
        ? // Avoid unbounded recursion from tutor-authored nesting
          createError('depth-exceeded', 'Nested group exceeded allowed depth', block.id, block.type)
        : null;
    case 'text':
    case 'choices':
    case 'callout':
    case 'steps':
      return null;
    case 'list':
    case 'card':
    case 'alert':
    case 'accordion':
    case 'collapsible':
    case 'tabs':
    case 'badge':
    case 'progress':
    case 'counter':
    case 'avatar':
    case 'separator':
    case 'carousel':
    case 'kbd':
      return null;
    case 'figure':
    case 'table':
    case 'math':
    case 'code':
      // Figure rendering lands in M5, table/math/code in M6 — alt/text fallback now (placeholder, not an error).
      return null;
    default:
      return createError('unknown-type', `No component for block type: ${(block as Block).type}`, node.id, (block as Block).type);
  }
}

function DefaultBlockView({ node, nested }: { node: Node; nested: boolean }): ReactNode {
  const { onError } = useDreamer();
  // Memoized so re-renders do not re-trigger the emission effect; the ref
  // keeps identity churn from the provider out of the dependency list.
  const renderError = useMemo(() => renderErrorFor(node, nested), [node, nested]);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  useEffect(() => {
    if (renderError) onErrorRef.current?.(renderError);
  }, [renderError]);

  if (node.state === 'error') return <FallbackView node={node} />;

  const renderBlocks = (blocks: Block[]): ReactNode =>
    blocks.map((child: Block, i: number) => (
      <NodeView
        key={child.id}
        node={{ id: child.id, block: child, state: 'complete', altText: child.alt }}
        docIndex={i}
        nested
      />
    ));

  switch (node.block.type) {
    case 'text':
      return <TextBlockView block={node.block} />;
    case 'choices':
      return <ChoicesView block={node.block} />;
    case 'callout':
      return <CalloutView block={node.block} />;
    case 'steps':
      return <StepsView block={node.block} />;
    case 'list':
      return <ListView block={node.block} />;
    case 'card':
      return <CardView block={node.block} renderBlocks={renderBlocks} />;
    case 'alert':
      return <AlertView block={node.block} />;
    case 'accordion':
      return <AccordionView block={node.block} renderBlocks={renderBlocks} />;
    case 'collapsible':
      return <CollapsibleView block={node.block} renderBlocks={renderBlocks} />;
    case 'tabs':
      return <TabsView block={node.block} renderBlocks={renderBlocks} />;
    case 'badge':
      return <BadgeView block={node.block} />;
    case 'progress':
      return <ProgressView block={node.block} />;
    case 'counter':
      return <CounterView block={node.block} />;
    case 'avatar':
      return <AvatarView block={node.block} />;
    case 'separator':
      return <SeparatorView block={node.block} />;
    case 'carousel':
      return <CarouselView block={node.block} renderBlocks={renderBlocks} />;
    case 'kbd':
      return <KbdView block={node.block} />;
    case 'group': {
      if (nested) return <FallbackView node={node} />;
      return (
        <GroupView block={node.block}>
          {node.block.blocks.map((child: Block, i: number) => (
            <NodeView key={child.id} node={{ id: child.id, block: child, state: 'complete', altText: child.alt }} docIndex={i} nested />
          ))}
        </GroupView>
      );
    }
    case 'figure':
    case 'table':
    case 'math':
    case 'code':
      return <FallbackView node={node} />;
    default:
      return <FallbackView node={node} />;
  }
}

export interface NodeViewProps {
  node: Node;
  docIndex: number;
  /** True when rendering inside a group (one level of nesting allowed). */
  nested?: boolean;
  /** True for board-level nodes (as opposed to detour/nested content);
   * marks the element for FLIP re-flow capture and region dimming. */
  topLevel?: boolean;
  /** Previous scene receded because newer content owns the focal point (§9.2). */
  receded?: boolean;
  /** True when an open detour points at this node (§7.5 dimming). */
  detourTarget?: boolean;
}

/** One board node: enter animation wrapper + default component or fallback. */
export function NodeView({ node, docIndex, nested = false, topLevel = false, receded = false, detourTarget = false }: NodeViewProps): ReactNode {
  const block = node.block;
  const p = useParts('node');
  const { onError: providerOnError } = useDreamer();
  const boardOnError = useContext(BoardErrorContext);
  const onError = boardOnError ?? providerOnError;
  const root = p.props('root', `dg-node dg-node-${node.state}`);
  const inner = p.props('inner', 'dg-node-inner');
  // Grid `span` (§6.2 placement) applies only at board level, inside a grid
  // region; LayoutRegions wraps the node when the span needs a track.
  const span = topLevel && !nested ? (block as { span?: number | 'full' }).span : undefined;
  return (
    <Animated
      enter={block.enter}
      emphasis={block.emphasis}
      // exit plays via <AnimatePresence> wrapper (M4 wires detours/replace exits)
      exit={block.exit}
      docIndex={docIndex}
      {...root}
      data-node-id={node.id}
      data-dg-board-node={topLevel ? 'true' : undefined}
      data-dg-span={span !== undefined ? String(span) : undefined}
      // data-dg-state is the §7.6 hook host CSS keys off (entering/visible/dimmed
      // treatments); receding is a separate hook so hosts can style it alone.
      data-dg-state={node.state}
      data-dg-receded={receded ? 'true' : undefined}
      data-dg-detour-target={detourTarget ? 'true' : undefined}
    >
      <div {...inner}>
        <NodeBoundary key={node.id} node={node} onError={onError}>
          <DefaultBlockView node={node} nested={nested} />
        </NodeBoundary>
      </div>
    </Animated>
  );
}
