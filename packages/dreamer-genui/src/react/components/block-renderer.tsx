import type { ReactNode } from 'react';
import type { Node } from '../../core/types';
import type { Block } from '../../schema/blocks';import { createError } from '../../core/errors';
import { useDreamer } from '../provider';
import { Animated } from '../motion/animated';
import { TextBlockView, ChoicesView, CalloutView, StepsView, GroupView } from './blocks';
import { renderInline } from './inline';

/** Fallback render for invalid/unknown/failed nodes — never blank, never crash. */
export function FallbackView({ node }: { node: Node }): ReactNode {
  return (
    <div className="dgui-fallback" role="status" data-node-id={node.id}>
      {node.altText ?? node.block.alt ?? `(unable to render "${node.id}")`}
    </div>
  );
}

function DefaultBlockView({ node, nested }: { node: Node; nested: boolean }): ReactNode {
  const { onError } = useDreamer();
  const block = node.block;

  if (node.state === 'error') return <FallbackView node={node} />;

  switch (block.type) {
    case 'text':
      return <TextBlockView block={block} />;
    case 'choices':
      return <ChoicesView block={block} />;
    case 'callout':
      return <CalloutView block={block} />;
    case 'steps':
      return <StepsView block={block} />;
    case 'group': {
      if (nested) {
        // Avoid unbounded recursion from tutor-authored nesting
        const err = createError('depth-exceeded', 'Nested group exceeded allowed depth', block.id, block.type);
        onError?.(err);
        return <FallbackView node={node} />;
      }
      return (
        <GroupView block={block}>
          {block.blocks.map((child: Block, i: number) => (
            <NodeView key={child.id} node={{ id: child.id, block: child, state: 'complete', altText: child.alt }} docIndex={i} nested />
          ))}
        </GroupView>
      );
    }
    case 'figure':
    case 'table':
    case 'math':
    case 'code':
      // Figure rendering lands in M5, table/math/code in M6 — render alt/text fallback now.
      return <FallbackView node={node} />;
    default: {
      const err = createError('unknown-type', `No component for block type: ${(block as Block).type}`, node.id, (block as Block).type);
      onError?.(err);
      return <FallbackView node={node} />;
    }
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
      exit={block.exit}
      docIndex={docIndex}
      data-node-id={node.id}
      className={`dgui-node dgui-node-${node.state}`}
    >
      <DefaultBlockView node={node} nested={nested} />
    </Animated>
  );
}
