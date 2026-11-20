import { Fragment, useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Inline, Mark, TermMark as TermMarkValue } from '../../schema/inline';
import type { UIEvent } from '../../schema/events';
import { useEmitEvent } from '../provider';
import { Annotated } from './annotations';
import { InlineMathView } from './math';

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
      // Hand-drawn SVG strokes (M5). The deterministic seed keeps the jitter
      // identical on server and client; a coloured token keeps it themeable.
      const seed = markText(mark.text).slice(0, 48) || mark.kind;
      return (
        <span
          className={`dg-mark-annotate dg-annotate-${mark.kind}`}
          data-color={mark.color ?? 'accent'}
          style={{ '--dg-annotation-color': `var(--dg-color-${mark.color ?? 'accent'})` } as CSSProperties}
        >
          <Annotated kind={mark.kind} seed={seed}>
            {markText(mark.text)}
          </Annotated>
        </span>
      );
    }
    case 'math':
      return <InlineMathView tex={mark.tex} />;
  }
}

/** Render `Inline[]` — strings and marks, degrading gracefully. */
export function renderInline(content: Inline[] | undefined): ReactNode {
  if (!content) return null;
  return content.map((part, i) =>
    typeof part === 'string' ? <Fragment key={i}>{part}</Fragment> : <MarkRenderer key={i} mark={part} />
  );
}
