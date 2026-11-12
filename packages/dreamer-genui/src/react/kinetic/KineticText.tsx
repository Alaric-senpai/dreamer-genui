import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { m, useReducedMotion } from 'motion/react';
import type { Inline, Mark } from '../../schema/inline';
import type { EnterEffect } from '../../schema/motion';
import { KINETIC_PRESETS, EASE, applyTempo, REDUCED_FADE_MS, type KineticEffect } from '../../motion/presets';
import { splitIntoParts, type SplitMode, type SplitPart } from './split';
import { renderInline, MarkRenderer } from '../components/inline';
import { useTempo } from '../motion/tempo';

/** Effects the kinetic engine implements (§9.1). */
const KINETIC = KINETIC_PRESETS;

function isKinetic(effect: EnterEffect | undefined): effect is KineticEffect {
  return effect !== undefined && effect in KINETIC;
}

function easeOf(effect: KineticEffect): [number, number, number, number] {
  return EASE[KINETIC[effect].ease];
}

/** Flatten content into plain-text runs and marks; plain text splits, marks never do. */
interface Segment {
  text?: string;
  mark?: Mark;
}

function flatten(content: Inline[]): Segment[] {
  return content.map((part) => (typeof part === 'string' ? { text: part } : { mark: part })) as Segment[];
}

/** The announced text of an inline part — strings as-is, marks by their meta text. */
function inlineLabel(inline: Inline): string {
  if (typeof inline === 'string') return inline;
  const mark = inline as Mark & { text?: unknown };
  if (mark.mark === 'math') return String((mark as { tex?: string }).tex ?? '');
  if (typeof mark.text === 'string') return mark.text;
  if (Array.isArray(mark.text)) return mark.text.map(inlineLabel).join(' '); // matches MarkRenderer.markText
  return '';
}

/** The full, well-formed text for a run's visually-hidden copy (mark meta text included). */
function metaText(content: Inline[]): string {
  return content.map(inlineLabel).join('');
}

/** Marks that expose focus (term role=button, focusable button). */
function isInteractiveMark(mark: Mark): boolean {
  return mark.mark === 'term' || mark.mark === 'focusable';
}

function hasInteractiveMark(content: Inline[]): boolean {
  return flatten(content).some((seg) => seg.mark !== undefined && isInteractiveMark(seg.mark));
}

function hasAnyMark(content: Inline[]): boolean {
  return flatten(content).some((seg) => seg.mark !== undefined);
}

function textLength(content: Inline[]): number {
  return content.reduce((n, p) => n + (typeof p === 'string' ? p.length : 0), 0);
}

/**
 * Accessible split-run structure (review round 2): split runs are FULLY
 * visible to assistive technology — no hidden copy, no aria-label (naming a
 * generic span is spec-prohibited). AT reads the unit spans and live marks
 * in DOM order, so a term/focusable stays in the accessibility tree and no
 * string-only run can ever announce nothing.
 */
function SplitRun({
  content,
  effect,
  split,
  tempo,
  className,
}: {
  content: Inline[];
  effect: KineticEffect;
  split?: SplitMode;
  tempo: number;
  className?: string | undefined;
}): ReactNode {
  const preset = KINETIC[effect];
  const requested = split ?? preset.split;
  // `chars` puts every character in an inline-block, which makes Chrome's
  // accessible-name computation insert a space between each character
  // ("P o i n t …"). Two consequences (review fix after the AX snapshot):
  //  - plain chars runs get an sr-only full-text copy; the animated copy is
  //    aria-hidden, exactly like wipe/typewriter/count-up;
  //  - chars + an interactive mark cannot be hidden, so it falls back to
  //    word splitting: words stay atomic, the mark stays in the a11y tree.
  const mode = requested === 'chars' && hasInteractiveMark(content) ? 'words' : requested;
  let unitIndex = 0;
  const segments: ReactNode[] = [];
  // `chars` animates each character as an inline-block. Left as direct
  // siblings, the line breaker treats them as independent atomic boxes and
  // can break inside a word ("thi / ng"). Group them per word in one
  // inline-block wrapper so breaks only happen between words (review fix).
  let charWord: ReactNode[] = [];
  let wordKey = 0;
  const flushChars = (): void => {
    if (charWord.length === 0) return;
    segments.push(
      <span key={`w${wordKey++}`} style={{ display: 'inline-block' }}>
        {charWord}
      </span>
    );
    charWord = [];
  };
  flatten(content).forEach((seg, i) => {
    if (seg.mark) {
      flushChars();
      segments.push(<MarkRenderer key={`m${i}`} mark={seg.mark} />);
      return;
    }
    const parts: SplitPart[] = splitIntoParts(seg.text!, mode);
    parts.forEach((part, j) => {
      if (part.kind === 'space') {
        flushChars();
        unitIndex += 1;
        segments.push(<span key={`s${i}-${j}`}>{part.text}</span>);
        return;
      }
      const delay = applyTempo(preset.stagger, tempo) * unitIndex++;
      const duration = applyTempo(preset.duration, tempo) / 1000;
      const initial =
        effect === 'slam' ? { opacity: 0, scale: 1.9, y: -12 } : { opacity: 0, y: mode === 'chars' ? 10 : 18 };
      const animate = effect === 'slam' ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 };
      const unit = (
        <m.span
          key={`u${i}-${j}`}
          style={{ display: 'inline-block', willChange: 'transform, opacity' }}
          initial={initial}
          animate={animate}
          transition={{ duration, delay: delay / 1000, ease: EASE[preset.ease] }}
        >
          {part.text}
        </m.span>
      );
      if (mode === 'chars') charWord.push(unit);
      else segments.push(unit);
    });
  });
  flushChars();
  if (mode === 'chars') {
    return (
      <>
        <SrOnlyText text={metaText(content)} />
        <span className={className} aria-hidden="true">
          {segments}
        </span>
      </>
    );
  }
  return <span className={className}>{segments}</span>;
}

/** Whole-run clip sweep (§9.1). Callers guarantee no interactive marks. */
function WipeRun({ content, effect, tempo, className }: { content: Inline[]; effect: KineticEffect; tempo: number; className?: string | undefined }): ReactNode {
  const preset = KINETIC[effect];
  return (
    <span className={className}>
      <SrOnlyText text={metaText(content)} />
      <m.span
        aria-hidden="true"
        style={{ display: 'inline-block', willChange: 'clip-path' }}
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 -2% 0 0)' }}
        transition={{ duration: applyTempo(preset.duration, tempo) / 1000, ease: EASE[preset.ease] }}
      >
        {renderInline(content)}
      </m.span>
    </span>
  );
}

/** Typewriter: characters type in sequentially; marks appear once their slot is typed. */
function TypewriterRun({ content, effect, tempo, className }: { content: Inline[]; effect: KineticEffect; tempo: number; className?: string | undefined }): ReactNode {
  const preset = KINETIC[effect];
  const total = textLength(content);
  const perChar = applyTempo(preset.duration, tempo);
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    let latest = 0;
    const tick = (now: number): void => {
      const n = Math.min(total, Math.floor((now - start) / perChar));
      if (n !== latest) {
        latest = n;
        setTyped(n);
      }
      if (n < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, perChar]);
  const segments = flatten(content);
  let consumed = 0;
  const pieces: ReactNode[] = [];
  for (const [i, seg] of segments.entries()) {
    if (seg.text !== undefined) {
      const take = Math.max(0, Math.min(seg.text.length, typed - consumed));
      consumed += seg.text.length;
      pieces.push(<span key={`t${i}`}>{seg.text.slice(0, take)}</span> as ReactNode);
    } else if (seg.mark && consumed <= typed) {
      pieces.push(<MarkRenderer key={`m${i}`} mark={seg.mark} />);
    }
  }
  return (
    <span className={className}>
      <SrOnlyText text={metaText(content)} />
      <span aria-hidden="true">{pieces}</span>
    </span>
  );
}

/** rAF number tween (count-up): cubic ease-out over the preset duration. */
function CountUpRun({ content, effect, tempo, className }: { content: Inline[]; effect: KineticEffect; tempo: number; className?: string | undefined }): ReactNode {
  const preset = KINETIC[effect];
  const full = content.map((p) => (typeof p === 'string' ? p : '')).join('');
  const match = /-?\d+(?:\.\d+)?/.exec(full);
  const target = match ? parseFloat(match[0]) : null;
  const start = match ? match.index : 0;
  const decimals = match ? (match[0].split('.')[1] ?? '').length : 0;
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    const duration = applyTempo(preset.duration, tempo);
    let raf = 0;
    const begin = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - begin) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, tempo, preset.duration]);
  if (target === null) return null; // unreachable: dispatcher routes no-number content to the rise fallback
  const shown = (value / 10 ** decimals).toFixed(decimals);
  const pieces: ReactNode[] = [
    <span key="pre">{full.slice(0, start)}</span>,
    <span key="num">{shown}</span>,
    <span key="post">{full.slice(start + fullMatchEnd(match))}</span>,
  ];
  return (
    <span className={className}>
      <SrOnlyText text={metaText(content)} />
      <span aria-hidden="true">{pieces}</span>
    </span>
  );
}

function fullMatchEnd(match: RegExpExecArray | null): number {
  return match ? match[0].length : 0;
}

/**
 * Visually-hidden copy of the full run text — the spec-compliant
 * announcement mechanism for whole-run effects that alter their visible
 * text (typewriter typing, wipe clipping, count-up digits). The animated
 * run carries aria-hidden; this copy carries the final content as a plain
 * text node. Styling comes from `.dg-sr-only` in the base stylesheet.
 */
function SrOnlyText({ text }: { text: string }): ReactNode {
  return <span className="dg-sr-only">{text}</span>;
}

/** Wavy underline drawing itself in (refined with hand-drawn primitives in M5). Content is fully visible — no hidden copy needed. */
function ScribbleRun({ content, effect, tempo, className }: { content: Inline[]; effect: KineticEffect; tempo: number; className?: string | undefined }): ReactNode {
  const preset = KINETIC[effect];
  return (
    <span className={className} style={{ position: 'relative', display: 'inline-block' }}>
      {renderInline(content)}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', left: '-4%', bottom: '-0.35em', width: '108%', height: '0.5em', overflow: 'visible' }}
        viewBox="0 0 200 20"
        preserveAspectRatio="none"
      >
          <m.path
            d="M2 12 Q 30 4 58 11 T 118 10 T 196 13"
            fill="none"
            stroke="var(--dg-color-accent)"
            strokeWidth="3.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: applyTempo(preset.duration, tempo) / 1000, ease: EASE.smooth }}
          />
        </svg>
    </span>
  );
}

/**
 * Kinetic text engine (§9.1): words/chars/slam per-unit entrances, typewriter,
 * wipe, count-up and the scribble stroke — plain DOM, no GSAP. Marks render
 * through the standard renderer and are never split.
 *
 * Accessibility (review round 2): split runs are fully visible to AT (no
 * hidden copy — an aria-label on a generic span is spec-prohibited, which
 * would let string-only runs announce nothing). Whole-run effects that alter
 * their visible text (typewriter/wipe/count-up) hide the animated run behind
 * aria-hidden and announce a visually-hidden `.dg-sr-only` copy of the final
 * text; runs carrying an interactive mark (term/focusable) degrade to a
 * static render, and count-up degrades on ANY mark (its renderer shows
 * string parts only).
 *
 * Reduced motion (§9.3): 'instant' presets step straight to the final visual;
 * 'fade' presets apply one short REDUCED_FADE_MS fade. Content is never
 * gated by animation.
 */
export function KineticText({
  content,
  effect,
  split,
  className,
}: {
  content: Inline[];
  effect: KineticEffect | EnterEffect | undefined;
  split?: SplitMode;
  className?: string;
}): ReactNode {
  const prefersReduced = useReducedMotion();
  const tempo = useTempo();

  if (!isKinetic(effect)) {
    return <span className={className}>{renderInline(content)}</span>;
  }
  const preset = KINETIC[effect];

  if (prefersReduced) {
    if (preset.reducedMotion === 'fade') {
      return (
        <span className={className}>
          <m.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: REDUCED_FADE_MS / 1000 }}>
            {renderInline(content)}
          </m.span>
        </span>
      );
    }
    return <span className={className}>{renderInline(content)}</span>;
  }

  if (preset.split === 'words' || preset.split === 'chars') {
    return <SplitRun content={content} effect={effect} split={split} tempo={tempo} className={className} />;
  }

  if (effect !== 'scribble' && hasInteractiveMark(content)) {
    // Whole-run effects that swap/clip/hide text would hide an interactive
    // mark's semantics; content-first: render statically, marks live.
    return <span className={className}>{renderInline(content)}</span>;
  }

  switch (effect) {
    case 'wipe':
      return <WipeRun content={content} effect={effect} tempo={tempo} className={className} />;
    case 'typewriter':
      return <TypewriterRun content={content} effect={effect} tempo={tempo} className={className} />;
    case 'count-up': {
      if (hasAnyMark(content)) {
        // CountUpRun renders string parts only — a mark would vanish visually
        // while the sr-only copy announced it. Content-first: static render.
        return <span className={className}>{renderInline(content)}</span>;
      }
      const plain = content.map((p) => (typeof p === 'string' ? p : '')).join('');
      if (!/-?\d+(?:\.\d+)?/.test(plain)) {
        // nothing numeric to count — render plainly (the rise is a container entrance)
        return <span className={className}>{renderInline(content)}</span>;
      }
      return <CountUpRun content={content} effect={effect} tempo={tempo} className={className} />;
    }
    case 'scribble':
      return <ScribbleRun content={content} effect={effect} tempo={tempo} className={className} />;
    default:
      return <span className={className}>{renderInline(content)}</span>;
  }
}
