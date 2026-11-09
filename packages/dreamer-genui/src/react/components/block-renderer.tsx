import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Node } from '../../core/types';
import type { Block } from '../../schema/blocks';
import type { LibraryError } from '../../core/types';
import { createError } from '../../core/errors';
import { useDreamer } from '../provider';
import { Animated } from '../motion/animated';
import { TextBlockView, ChoicesView, CalloutView, StepsView, GroupView } from './blocks';
import { renderInline } from './inline';

/** Fallback render for invalid/unknown/failed nodes — never blank, never crash. */
export function FallbackView({ node }: { node: Node }): ReactNode {
  // `alt` lives on the node base, except figures where it sits inside `figure`.
  const block = node.block as { alt?: string; figure?: { alt?: string } };
  const text = node.altText ?? block.alt ?? block.figure?.alt ?? `(unable to render "${node.id}")`;
  return (
    <div className="dgui-fallback" data-node-id={node.id}>
      {text}
    </div>
  );
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

  switch (node.block.type) {
    case 'text':
      return <TextBlockView block={node.block} />;
    case 'choices':
      return <ChoicesView block={node.block} />;
    case 'callout':
      return <CalloutView block={node.block} />;
    case 'steps':
      return <StepsView block={node.block} />;
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
}

/** One board node: enter animation wrapper + default component or fallback. */
export function NodeView({ node, docIndex, nested = false }: NodeViewProps): ReactNode {
  const block = node.block;
  return (
    <Animated
      enter={block.enter}
      emphasis={block.emphasis}
      // exit plays via <AnimatePresence> wrapper (M4 wires detours/replace exits)
      exit={block.exit}
      docIndex={docIndex}
      data-node-id={node.id}
      className={`dgui-node dgui-node-${node.state}`}
    >
      <DefaultBlockView node={node} nested={nested} />
    </Animated>
  );
}
