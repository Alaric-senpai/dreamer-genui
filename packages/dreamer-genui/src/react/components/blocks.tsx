import { useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import type { Block, TextBlock, ChoicesBlock, CalloutBlock, StepsBlock, GroupBlock } from '../../schema/blocks';
import { renderInline } from './inline';
import { useEmitEvent } from '../provider';

// --- Text ---

// Provisional tags for the new variants; the screen-owning `hero` layout and
// the kinetic typography engine land with the M3 renderer work.
const TEXT_VARIANTS: Record<TextBlock['variant'], ElementType> = {
  hero: 'h1',
  kicker: 'p',
  quote: 'blockquote',
  heading: 'h3',
  definition: 'p',
  body: 'p',
  note: 'aside',
};

export function TextBlockView({ block }: { block: TextBlock }): ReactNode {
  const Tag = TEXT_VARIANTS[block.variant];
  return (
    <Tag className={`dgui-text dgui-text-${block.variant}`} data-node-id={block.id}>
      {renderInline(block.content)}
    </Tag>
  );
}

// --- Choices ---

export function ChoicesView({ block }: { block: ChoicesBlock }): ReactNode {
  const emit = useEmitEvent();
  // Selection must survive re-renders (streams, host state updates, theme swaps).
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  function fire(item: ChoicesBlock['items'][number]): void {
    if (block.intent === 'answer') {
      if (block.multi) {
        const next = new Set(selected);
        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
        setSelected(next);
        emit({ type: 'answer', nodeId: block.id, value: [...next] });
      } else {
        emit({ type: 'answer', nodeId: block.id, value: item.id });
      }
    } else {
      emit({ type: 'select', nodeId: block.id, ref: item.ref ?? item.id, label: item.label });
    }
  }

  return (
    <div className={`dgui-choices dgui-choices-${block.layout}`} role="group" data-node-id={block.id}>
      {block.prompt && <p className="dgui-choices-prompt">{renderInline(block.prompt)}</p>}
      {block.items.map((item: ChoicesBlock['items'][number]) => (
        <button
          key={item.id}
          type="button"
          className={`dgui-choice${selected.has(item.id) ? ' dgui-choice-selected' : ''}`}
          data-ref={item.ref ?? item.id}
          aria-pressed={block.multi ? selected.has(item.id) : undefined}
          onClick={() => fire(item)}
        >
          {item.icon && <span className="dgui-choice-icon" aria-hidden="true">{item.icon}</span>}
          <span className="dgui-choice-label">{item.label}</span>
          {item.caption && <span className="dgui-choice-caption">{item.caption}</span>}
        </button>
      ))}
    </div>
  );
}

// --- Callout ---

export function CalloutView({ block }: { block: CalloutBlock }): ReactNode {
  return (
    <aside className={`dgui-callout dgui-callout-${block.tone}`} role="note" data-node-id={block.id}>
      {block.title && <strong className="dgui-callout-title">{block.title}</strong>}
      <div className="dgui-callout-content">{renderInline(block.content)}</div>
    </aside>
  );
}

// --- Steps ---

export function StepsView({ block }: { block: StepsBlock }): ReactNode {
  return (
    <ol className={`dgui-steps dgui-steps-${block.reveal}`} data-node-id={block.id}>
      {block.items.map((item: StepsBlock['items'][number], i: number) => (
        <li key={item.id} className="dgui-step">
          <span className="dgui-step-number" aria-hidden="true">{i + 1}</span>
          <div>
            <strong className="dgui-step-title">{item.title}</strong>
            <div className="dgui-step-content">{renderInline(item.content)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// --- Group ---

export function GroupView({ block, children }: { block: GroupBlock; children: ReactNode }): ReactNode {
  return (
    <div className={`dgui-group dgui-group-${block.layout}`} data-node-id={block.id}>
      {children}
    </div>
  );
}

export type { Block };
