import { useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import type { Block, TextBlock, ChoicesBlock, CalloutBlock, StepsBlock, GroupBlock } from '../../schema/blocks';
import type { EnterEffect } from '../../schema/motion';
import { DEFAULT_TEXT_ENTER, KINETIC_PRESETS, type KineticEffect } from '../../motion/presets';
import { KineticText } from '../kinetic/KineticText';
import { renderInline } from './inline';
import { useEmitEvent } from '../provider';

// --- Text ---

// Provisional tags for the new variants; the screen-owning `hero` layout and
// the kinetic typography engine land with the M3 renderer work.
const TEXT_VARIANTS: Record<TextBlock['variant'], ElementType> = {
  hero: 'h1',
  kicker: 'p',
  quote: 'blockquote',
  heading: 'h2',
  definition: 'p',
  body: 'p',
  note: 'aside',
};

/** True when the text engine itself owns the entrance (container must stay static). */
function isKineticEffect(effect: EnterEffect | undefined): effect is KineticEffect {
  return effect !== undefined && effect in KINETIC_PRESETS;
}

export function TextBlockView({ block }: { block: TextBlock }): ReactNode {
  const Tag = TEXT_VARIANTS[block.variant];
  const effect = block.enter?.effect;
  // data-dg-variant is the styling hook for variant-specific host CSS (§7.6).
  const variantHook = { 'data-dg-variant': block.variant } as const;
  if (!block.enter) {
    // §9.2: kinetic by default — every variant has an appropriate entrance.
    return (
      <Tag className={`dg-text dg-text-${block.variant}`} data-node-id={block.id} {...variantHook}>
        <KineticText content={block.content} effect={DEFAULT_TEXT_ENTER[block.variant] ?? 'words'} />
      </Tag>
    );
  }
  if (isKineticEffect(effect)) {
    return (
      <Tag className={`dg-text dg-text-${block.variant}`} data-node-id={block.id} {...variantHook}>
        <KineticText content={block.content} effect={effect} split={block.enter.split === 'chars' ? 'chars' : block.enter.split === 'words' ? 'words' : undefined} />
      </Tag>
    );
  }
  // Container-level effect: the Animated wrapper in NodeView animates; render
  // text plainly. The inner span keeps the hero's flex column from turning
  // every inline fragment/mark into its own flex item (review fix).
  return (
    <Tag className={`dg-text dg-text-${block.variant}`} data-node-id={block.id} {...variantHook}>
      <span>{renderInline(block.content)}</span>
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
    <div className={`dg-choices dg-choices-${block.layout}`} role="group" data-node-id={block.id}>
      {block.prompt && <p className="dg-choices-prompt">{renderInline(block.prompt)}</p>}
      {block.items.map((item: ChoicesBlock['items'][number]) => (
        <button
          key={item.id}
          type="button"
          className={`dg-choice${selected.has(item.id) ? ' dg-choice-selected' : ''}`}
          data-ref={item.ref ?? item.id}
          aria-pressed={block.multi ? selected.has(item.id) : undefined}
          onClick={() => fire(item)}
        >
          {item.icon && <span className="dg-choice-icon" aria-hidden="true">{item.icon}</span>}
          <span className="dg-choice-label">{item.label}</span>
          {item.caption && <span className="dg-choice-caption">{item.caption}</span>}
        </button>
      ))}
    </div>
  );
}

// --- Callout ---

export function CalloutView({ block }: { block: CalloutBlock }): ReactNode {
  return (
    <aside className={`dg-callout dg-callout-${block.tone}`} role="note" data-node-id={block.id}>
      {block.title && <strong className="dg-callout-title">{block.title}</strong>}
      <div className="dg-callout-content">{renderInline(block.content)}</div>
    </aside>
  );
}

// --- Steps ---

export function StepsView({ block }: { block: StepsBlock }): ReactNode {
  return (
    <ol className={`dg-steps dg-steps-${block.reveal}`} data-node-id={block.id}>
      {block.items.map((item: StepsBlock['items'][number], i: number) => (
        <li key={item.id} className="dg-step">
          <span className="dg-step-number" aria-hidden="true">{i + 1}</span>
          <div>
            <strong className="dg-step-title">{item.title}</strong>
            <div className="dg-step-content">{renderInline(item.content)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// --- Group ---

export function GroupView({ block, children }: { block: GroupBlock; children: ReactNode }): ReactNode {
  return (
    <div className={`dg-group dg-group-${block.layout}`} data-node-id={block.id}>
      {children}
    </div>
  );
}

export type { Block };
