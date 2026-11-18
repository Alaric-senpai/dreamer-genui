import { Fragment, useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Inline, Mark, TermMark as TermMarkValue } from '../../schema/inline';
import type { UIEvent } from '../../schema/events';
import { useEmitEvent } from '../provider';

function markText(t: string | string[] | undefined): string {
  if (Array.isArray(t)) return t.join(' ');
  return t ?? '';
}

/**
 * A term and its definition. Hover reveals the definition on pointer devices;
 * a tap/Enter toggles it persistently on touch and for keyboard users. The
 * richer `detail` payload (added in v3) renders beneath the definition.
 */
function TermMark({ mark, emit }: { mark: TermMarkValue; emit: (event: UIEvent) => void }): ReactNode {
  const [open, setOpen] = useState(false);
  const id = useId();
  const hasDetail = Boolean(mark.detail?.length);
  const toggle = (): void => {
    setOpen(value => !value);
    emit({ type: 'focus', nodeId: mark.text, label: mark.definition });
  };
  return (
    <span className="dg-term-wrap" data-open={open ? 'true' : undefined}>
      <button
        type="button"
        role="button"
        className="dg-mark-term"
        aria-describedby={id}
        aria-expanded={hasDetail ? open : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        {mark.text}
      </button>
      <span id={id} className="dg-term-popover" role="tooltip">
        <span className="dg-term-definition">{mark.definition}</span>
        {hasDetail ? <span className="dg-term-detail">{renderInline(mark.detail)}</span> : null}
      </span>
    </span>
  );
}

/** Render a single mark. Unknown marks degrade to plain text (never crash). */
export function MarkRenderer({ mark }: { mark: Mark }): ReactNode {
  const emit = useEmitEvent();
  switch (mark.mark) {
    case 'highlight':
      return (
        <mark className="dg-mark-highlight" data-color={mark.color ?? 'accent'}>
          {markText(mark.text)}
        </mark>
      );
    case 'emphasis':
      return <em className="dg-mark-emphasis">{markText(mark.text)}</em>;
    case 'term':
      return <TermMark mark={mark} emit={emit} />;
    case 'focusable':
      return (
        <button type="button" className="dg-mark-focusable" onClick={() => emit({ type: 'focus', nodeId: mark.ref, label: markText(mark.text) })}>
          {markText(mark.text)}
        </button>
      );
    case 'annotate': {
      const style: CSSProperties = { textDecorationColor: 'var(--dg-color-accent)' };
      if (mark.kind === 'underline') style.textDecoration = 'underline';
      else if (mark.kind === 'strike') style.textDecoration = 'line-through';
      else if (mark.kind === 'box') style.border = '2px solid var(--dg-color-accent)';
      // circle/bracket get their shapes from CSS here; the hand-drawn SVG
      // stroke primitives (and draw-on sequencing) are the M5 pass.
      return (
        <span className={`dg-mark-annotate dg-annotate-${mark.kind}`} data-color={mark.color} style={style}>
          {markText(mark.text)}
        </span>
      );
    }
    case 'math':
      // KaTeX rendering lands in M6; plain text keeps content visible and safe.
      return <code className="dg-mark-math" data-tex={mark.tex}>{mark.tex}</code>;
  }
}

/** Render `Inline[]` — strings and marks, degrading gracefully. */
export function renderInline(content: Inline[] | undefined): ReactNode {
  if (!content) return null;
  return content.map((part, i) =>
    typeof part === 'string' ? <Fragment key={i}>{part}</Fragment> : <MarkRenderer key={i} mark={part} />
  );
}
