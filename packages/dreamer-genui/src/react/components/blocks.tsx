import { useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import type { Block, TextBlock, ChoicesBlock, CalloutBlock, StepsBlock, GroupBlock, ListBlock } from '../../schema/blocks';
import type { EnterEffect } from '../../schema/motion';
import { DEFAULT_TEXT_ENTER, KINETIC_PRESETS, type KineticEffect } from '../../motion/presets';
import { KineticText } from '../kinetic/KineticText';
import { renderInline } from './inline';
import { splitTemplate } from '../layout/regions';
import { useEmitEvent } from '../provider';
import { useOverride, useParts } from '../anatomy';

// Every built-in view below follows the §8.5 anatomy contract: metadata lives
// in `anatomy-meta.ts`, parts are rendered through `useParts` (stable
// `dg-<component>-<part>` class + `data-dg-part`), and the whole view can be
// replaced through the provider `components` map.

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
  const p = useParts('text');
  const override = useOverride('text');
  const Tag = TEXT_VARIANTS[block.variant];
  const effect = block.enter?.effect;
  // data-dg-variant is the styling hook for variant-specific host CSS (§7.6).
  const variantHook = { 'data-dg-variant': block.variant } as const;
  const root = p.props('root', `dg-text dg-text-${block.variant}`);

  let content: ReactNode;
  if (!block.enter) {
    // §9.2: kinetic by default — every variant has an appropriate entrance.
    content = <KineticText content={block.content} effect={DEFAULT_TEXT_ENTER[block.variant] ?? 'words'} />;
  } else if (isKineticEffect(effect)) {
    content = (
      <KineticText
        content={block.content}
        effect={effect}
        split={block.enter.split === 'chars' ? 'chars' : block.enter.split === 'words' ? 'words' : undefined}
      />
    );
  } else {
    // Container-level effect: the Animated wrapper in NodeView animates; render
    // text plainly. The inner span keeps the hero's flex column from turning
    // every inline fragment/mark into its own flex item (review fix).
    content = <span>{renderInline(block.content)}</span>;
  }

  const defaultView = (
    <Tag {...root} data-node-id={block.id} {...variantHook}>
      {content}
    </Tag>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Choices ---

export function ChoicesView({ block }: { block: ChoicesBlock }): ReactNode {
  const emit = useEmitEvent();
  const p = useParts('choices');
  const override = useOverride('choices');
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

  const defaultView = (
    <div {...p.props('root', `dg-choices dg-choices-${block.layout}`)} role="group" data-node-id={block.id}>
      {block.prompt && <p {...p.props('prompt', 'dg-choices-prompt')}>{renderInline(block.prompt)}</p>}
      {block.items.map((item: ChoicesBlock['items'][number]) => (
        <button
          key={item.id}
          type="button"
          {...p.props('item', `dg-choice${selected.has(item.id) ? ' dg-choice-selected' : ''}`)}
          data-dg-target={item.ref ?? `${block.id}/${item.id}`}
          data-ref={item.ref ?? item.id}
          aria-pressed={block.multi ? selected.has(item.id) : undefined}
          onClick={() => fire(item)}
        >
          {item.icon && (
            <span {...p.props('item-icon', 'dg-choice-icon')} aria-hidden="true">
              {item.icon}
            </span>
          )}
          <span {...p.props('item-label', 'dg-choice-label')}>{item.label}</span>
          {item.caption && <span {...p.props('item-caption', 'dg-choice-caption')}>{item.caption}</span>}
        </button>
      ))}
    </div>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Callout ---

export function CalloutView({ block }: { block: CalloutBlock }): ReactNode {
  const p = useParts('callout');
  const override = useOverride('callout');
  const defaultView = (
    <aside {...p.props('root', `dg-callout dg-callout-${block.tone}`)} role="note" data-node-id={block.id}>
      {block.title && <strong {...p.props('title', 'dg-callout-title')}>{block.title}</strong>}
      <div {...p.props('content', 'dg-callout-content')}>{renderInline(block.content)}</div>
    </aside>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Steps ---

export function StepsView({ block }: { block: StepsBlock }): ReactNode {
  const p = useParts('steps');
  const override = useOverride('steps');
  const defaultView = (
    <ol {...p.props('root', `dg-steps dg-steps-${block.reveal}`)} data-node-id={block.id}>
      {block.items.map((item: StepsBlock['items'][number], i: number) => (
        <li key={item.id} {...p.props('item', 'dg-step')} data-dg-target={`${block.id}/${item.id}`}>
          <span {...p.props('number', 'dg-step-number')} aria-hidden="true">
            {i + 1}
          </span>
          <div>
            <strong {...p.props('title', 'dg-step-title')}>{item.title}</strong>
            <div {...p.props('content', 'dg-step-content')}>{renderInline(item.content)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Group ---

/** Token gap → the `--dg-gap-*` scale (§6.4); `none` collapses to zero. */
function gapVar(gap: Exclude<GroupBlock['gap'], undefined>): string {
  return gap === 'none' ? '0px' : `var(--dg-gap-${gap}, calc(0.75rem * var(--dg-space-scale, 1)))`;
}

/**
 * The `group` flex/grid vocabulary (§6.4), expressed as `--dg-*` custom
 * properties the stylesheet turns into flex/grid. `ratio` reuses the split
 * track grammar and turns the group into a track-based grid, so proportions
 * never need per-child flex values.
 */
export function GroupView({ block, children }: { block: GroupBlock; children: ReactNode }): ReactNode {
  const p = useParts('group');
  const override = useOverride('group');
  // Custom properties are not part of React's CSSProperties index; the record
  // is cast once on use. Values are token names only — never model CSS.
  const style = {} as Record<string, string>;
  if (block.gap !== undefined) style['--dg-group-gap'] = gapVar(block.gap);
  if (block.direction) style['--dg-group-direction'] = block.direction;
  if (block.align) style['--dg-group-align'] = block.align;
  if (block.wrap !== undefined) style['--dg-group-wrap'] = block.wrap ? 'wrap' : 'nowrap';
  if (block.justify) {
    style['--dg-group-justify'] =
      block.justify === 'between' ? 'space-between' : block.justify === 'around' ? 'space-around' : block.justify;
  }
  if (block.columns) style['--dg-group-columns'] = String(block.columns);
  if (block.minItemWidth) style['--dg-group-min-width'] = `var(--dg-gap-${block.minItemWidth})`;
  if (block.ratio) style['--dg-group-template'] = splitTemplate(block.ratio);
  const root = p.props('root', `dg-group dg-group-${block.layout}`);
  const defaultView = (
    <div
      {...root}
      data-node-id={block.id}
      data-dg-reverse={block.reverseOnNarrow ? 'true' : undefined}
      data-dg-autofit={block.minItemWidth ? 'true' : undefined}
      style={{ ...root.style, ...(style as CSSProperties) }}
    >
      {children}
    </div>
  );
  return override ? override({ block, children, renderDefault: () => defaultView }) : defaultView;
}

// --- List (v2.1) ---

/**
 * The `list` block (§6.5): bullet / number / check / none. Glyphs are
 * stylesheet-owned; item-level `enter` choreography lands with C2.
 */
export function ListView({ block }: { block: ListBlock }): ReactNode {
  const p = useParts('list');
  const override = useOverride('list');
  const Tag: ElementType = block.style === 'number' ? 'ol' : 'ul';
  const defaultView = (
    <Tag {...p.props('root', `dg-list dg-list-${block.style}`)} data-node-id={block.id}>
      {block.items.map((item, i) => (
        <li key={item.id ?? i} {...p.props('item', 'dg-list-item')} data-dg-item-id={item.id}>
          {block.style === 'check' && <span {...p.props('marker', 'dg-list-check')} aria-hidden="true" />}
          <div {...p.props('content', 'dg-list-content')}>{renderInline(item.content)}</div>
        </li>
      ))}
    </Tag>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

export type { Block };
