import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { m, useReducedMotion } from 'motion/react';
import type { Inline, Mark } from '../../schema/inline';
import type { EnterEffect } from '../../schema/motion';
import { KINETIC_PRESETS, EASE, applyTempo, type KineticEffect } from '../../motion/presets';
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

function plainText(content: Inline[]): string {
  return content.map((p) => (typeof p === 'string' ? p : '')).join('');
}

function textLength(content: Inline[]): number {
  return content.reduce((n, p) => n + (typeof p === 'string' ? p.length : 0), 0);
}

/** Splitting entrance: words, chars or slam — one animated unit per word/char. */
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
  const mode = split ?? preset.split;
  const segments = flatten(content);
  const out: ReactNode[] = [];
  let unitIndex = 0;
  for (const [i, seg] of segments.entries()) {
    if (seg.text !== undefined) {
      const parts: SplitPart[] = splitIntoParts(seg.text, mode);
      for (const part of parts) {
        if (part.kind === 'space') {
          out.push(<span key={`s${i}-${unitIndex++}`}>{part.text}</span>);
          continue;
        }
        const delay = applyTempo(preset.stagger, tempo) * unitIndex;
        const duration = applyTempo(preset.duration, tempo) / 1000;
        const initial =
          effect === 'slam' ? { opacity: 0, scale: 1.9, y: -12 } : { opacity: 0, y: mode === 'chars' ? 10 : 18 };
        const animate = effect === 'slam' ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 };
        out.push(
          <m.span
            key={`u${i}-${unitIndex++}`}
            style={{ display: 'inline-block', willChange: 'transform, opacity' }}
            initial={initial}
            animate={animate}
            transition={{ duration, delay: delay / 1000, ease: EASE[preset.ease] }}
          >
            {part.text}
          </m.span>
        );
      }
    } else if (seg.mark) {
      out.push(<MarkRenderer key={`m${i}`} mark={seg.mark} />);
    }
  }
  const full = plainText(content);
  return (
    <span className={className} aria-label={full}>
      <span aria-hidden="true">{out}</span>
    </span>
  );
}

/** Whole-run clip sweep (kicker wipes, hero slams alternate). */
function WipeRun({ content, effect, tempo, className }: { content: Inline[]; effect: KineticEffect; tempo: number; className?: string | undefined }): ReactNode {
  const preset = KINETIC[effect];
  const full = plainText(content);
  return (
    <span className={className} aria-label={full}>
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
    const tick = (now: number): void => {
      const n = Math.min(total, Math.floor((now - start) / perChar));
      setCountSafe(n);
      if (n < total) raf = requestAnimationFrame(tick);
    };
    let latest = 0;
    const setCountSafe = (n: number): void => {
      if (n !== latest) {
        latest = n;
        setTyped(n);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, perChar]);
  const full = plainText(content);
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
    <span className={className} aria-label={full}>
      <span aria-hidden="true">{pieces}</span>
    </span>
  );
}

/** rAF number tween (count-up): cubic ease-out over the preset duration. */
function CountUpRun({ content, effect, tempo, className }: { content: Inline[]; effect: KineticEffect; tempo: number; className?: string | undefined }): ReactNode {
  const preset = KINETIC[effect];
  const full = plainText(content);
  const match = /-?\d+(?:\.\d+)?/.exec(full);
  const target = match ? parseFloat(match[0]) : null;
  const start = match ? match.index : 0;
  const decimals = match ? (match[0].split('.')[1] ?? '').length : 0;
  const [value, setValue] = useState(target === null ? 0 : 0);
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
  if (target === null) {
    // nothing numeric to count — rise in instead
    return (
      <span className={className} aria-label={full}>
        <m.span
          aria-hidden="true"
          style={{ display: 'inline-block' }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: applyTempo(KINETIC.words.duration, tempo) / 1000, ease: EASE.smooth }}
        >
          {renderInline(content)}
        </m.span>
      </span>
    );
  }
  const shown = (value / 10 ** decimals).toFixed(decimals);
  const pieces: ReactNode[] = [
    <span key="pre">{full.slice(0, start)}</span>,
    <span key="num">{shown}</span>,
    <span key="post">{full.slice(start + fullMatchEnd(match))}</span>,
  ];
  return (
    <span className={className} aria-label={full}>
      <span aria-hidden="true">{pieces}</span>
    </span>
  );
}

function fullMatchEnd(match: RegExpExecArray | null): number {
  return match ? match[0].length : 0;
}

/** Wavy underline drawing itself in (refined with hand-drawn primitives in M5). */
function ScribbleRun({ content, effect, tempo, className }: { content: Inline[]; effect: KineticEffect; tempo: number; className?: string | undefined }): ReactNode {
  const preset = KINETIC[effect];
  const full = plainText(content);
  return (
    <span className={className} aria-label={full}>
      <span aria-hidden="true" style={{ position: 'relative', display: 'inline-block' }}>
        {renderInline(content)}
        <svg
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
    </span>
  );
}

/**
 * Kinetic text engine (§9.1): words/chars/slam per-unit entrances, typewriter,
 * wipe, count-up and the scribble stroke — plain DOM, no GSAP. Marks render
 * through the standard renderer and are never split (mark-level sweeps land
 * with styling in M3e).
 *
 * Reduced motion (§9.3): 'instant' presets step straight to the final visual;
 * 'fade' presets apply one short fade. Content is never gated by animation —
 * the full text is always announced via aria-label and present in the DOM.
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
          <m.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
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
  switch (effect) {
    case 'wipe':
      return <WipeRun content={content} effect={effect} tempo={tempo} className={className} />;
    case 'typewriter':
      return <TypewriterRun content={content} effect={effect} tempo={tempo} className={className} />;
    case 'count-up':
      return <CountUpRun content={content} effect={effect} tempo={tempo} className={className} />;
    case 'scribble':
      return <ScribbleRun content={content} effect={effect} tempo={tempo} className={className} />;
    default:
      return <span className={className}>{renderInline(content)}</span>;
  }
}
