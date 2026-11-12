import { Fragment } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Inline, Mark } from '../../schema/inline';
import { useEmitEvent } from '../provider';

function markText(t: string | string[] | undefined): string {
  if (Array.isArray(t)) return t.join(' ');
  return t ?? '';
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
      return (
        <span
          className="dg-mark-term"
          role="button"
          tabIndex={0}
          title={mark.definition}
          aria-label={`${mark.text}: ${mark.definition}`}
          onClick={() => emit({ type: 'focus', nodeId: mark.text, label: mark.definition })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              // Space must not scroll the page when "pressing" a term
              e.preventDefault();
              emit({ type: 'focus', nodeId: mark.text, label: mark.definition });
            }
          }}
        >
          {mark.text}
        </span>
      );
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
