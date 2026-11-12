'use client';

/**
 * M3 showreel (§9.4, scoped to what M3 implements).
 *
 * One deterministic, auto-playing sequence in seven beats:
 *   1. type        — kicker / hero slam / body words
 *   2. voices      — every text variant with its kinetic default
 *   3. marks       — highlight, emphasis, term, focusable, annotations, emphasis FX
 *   4. entrances   — all 16 enter effects, one focal line each
 *   5. cues        — mock narrator drives nodes in on cue (nothing mounted early)
 *   6. mood        — playful → solemn transition (surface + tempo + colour)
 *   7. detour      — attach explainer inline, clickable term, end card
 *
 * Camera moves, receding, the detour return control and ambience runtime are
 * M4; diagram draw-on is M5. They are honestly absent here (see
 * docs/showreel/SELF_REVIEW.md).
 *
 * Capture hook: `?capture=1` waits for `window.__SHOWREEL_START__()` instead of
 * autoplaying, hides the studio chrome, and publishes playback metrics.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DreamerProvider, Board, useBoard, type Reply, type UIEvent } from 'dreamer-genui';
import { createRegistry } from 'dreamer-genui/core';
import './showreel.css';

declare global {
  interface Window {
    __SHOWREEL_READY__?: boolean;
    __SHOWREEL_START__?: () => void;
    __SHOWREEL_DONE__?: boolean;
    __SHOWREEL_METRICS__?: Record<string, unknown>;
    __SHOWREEL_SCENE__?: string;
  }
}

const registry = createRegistry();

/** Reply helper — the showreel is data, kept in one place for easy retuning. */
function reply(ops: unknown[]): Reply {
  return { v: 1, ops } as unknown as Reply;
}

const theme = (mood: string, duration = 1) =>
  reply([{ op: 'theme', theme: { mood, transition: { duration, ease: 'smooth' } } }]);

// ---------------------------------------------------------------------------
// Scene data
// ---------------------------------------------------------------------------

const SCENE_1 = reply([
  {
    op: 'append',
    blocks: [
      {
        id: 's1-kicker',
        type: 'text',
        variant: 'kicker',
        content: ['a showreel in seven beats'],
        enter: { effect: 'wipe', order: 0 },
      },
      {
        id: 's1-hero',
        type: 'text',
        variant: 'hero',
        content: ['Every idea has a shape.'],
        enter: { effect: 'slam', split: 'words', order: 1 },
      },
      {
        id: 's1-body',
        type: 'text',
        variant: 'body',
        content: ['Words arrive with weight, one beat at a time.'],
        enter: { effect: 'words', trigger: { on: 'after', node: 's1-hero' } },
      },
    ],
  },
]);

const SCENE_2 = reply([
  {
    op: 'replace',
    blocks: [
      {
        id: 's2-heading',
        type: 'text',
        variant: 'heading',
        content: ['Seven voices, one page.'],
        enter: { effect: 'chars' },
      },
      {
        id: 's2-definition',
        type: 'text',
        variant: 'definition',
        content: [
          'A definition is a sentence that ',
          { mark: 'emphasis', text: 'earns its weight' },
          '.',
        ],
        enter: { effect: 'typewriter', delay: 900 },
      },
      {
        id: 's2-note',
        type: 'text',
        variant: 'note',
        content: ['A note lands quietly.'],
        enter: { effect: 'reveal', delay: 2400 },
      },
      {
        id: 's2-quote',
        type: 'text',
        variant: 'quote',
        content: ['“Motion carries meaning.”'],
        enter: { effect: 'words', delay: 3300 },
      },
    ],
  },
]);

const SCENE_3 = reply([
  {
    op: 'replace',
    blocks: [
      {
        id: 's3-heading',
        type: 'text',
        variant: 'heading',
        content: ['Point at the thing that matters.'],
        enter: { effect: 'chars' },
      },
      {
        id: 's3-body',
        type: 'text',
        variant: 'body',
        content: [
          'A ',
          { mark: 'highlight', text: 'highlight' },
          ', an ',
          { mark: 'emphasis', text: 'emphasis' },
          ', a ',
          { mark: 'term', text: 'term', definition: 'a word that opens an explanation' },
          ' you can open, a ',
          { mark: 'focusable', text: 'focusable', ref: 's3-demo' },
          ' you can press — and ',
          { mark: 'annotate', kind: 'underline', text: 'drawn attention' },
          '.',
        ],
        enter: { effect: 'words', delay: 600 },
      },
      {
        id: 's3-annotations',
        type: 'text',
        variant: 'body',
        content: [
          { mark: 'annotate', kind: 'box', text: 'boxed' },
          ' · ',
          { mark: 'annotate', kind: 'strike', text: 'struck' },
          ' · ',
          { mark: 'annotate', kind: 'bracket', text: 'bracketed' },
          ' · ',
          { mark: 'annotate', kind: 'circle', text: 'circled' },
        ],
        enter: { effect: 'rise', delay: 1600 },
      },
      {
        id: 's3-pulse',
        type: 'text',
        variant: 'note',
        content: ['pulse'],
        emphasis: { effect: 'pulse' },
        enter: { effect: 'pop', delay: 2200 },
      },
      {
        id: 's3-glow',
        type: 'text',
        variant: 'note',
        content: ['glow'],
        emphasis: { effect: 'glow' },
        enter: { effect: 'pop', delay: 2500 },
      },
      {
        id: 's3-underline',
        type: 'text',
        variant: 'note',
        content: ['underline'],
        emphasis: { effect: 'underline' },
        enter: { effect: 'pop', delay: 2800 },
      },
      {
        id: 's3-shake',
        type: 'text',
        variant: 'note',
        content: ['shake'],
        emphasis: { effect: 'shake' },
        enter: { effect: 'pop', delay: 3100 },
      },
      {
        id: 's3-bounce',
        type: 'text',
        variant: 'note',
        content: ['bounce'],
        emphasis: { effect: 'bounce' },
        enter: { effect: 'pop', delay: 3400 },
      },
      {
        id: 's3-wobble',
        type: 'text',
        variant: 'note',
        content: ['wobble'],
        emphasis: { effect: 'wobble' },
        enter: { effect: 'pop', delay: 3700 },
      },
    ],
  },
]);

/**
 * All 16 enter effects, one line at a time: each replace carries the next
 * effect, so every entrance owns the screen. Timing: one beat per effect.
 */
const EFFECT_LINES: Array<{ effect: string; variant: string; text: string }> = [
  { effect: 'reveal', variant: 'heading', text: 'reveal — it simply arrives.' },
  { effect: 'rise', variant: 'heading', text: 'rise — it lifts from below.' },
  { effect: 'pop', variant: 'heading', text: 'pop — it springs into place.' },
  { effect: 'sweep', variant: 'heading', text: 'sweep — it slides in from the side.' },
  { effect: 'draw', variant: 'heading', text: 'draw — strokes would draw here (M5).' },
  { effect: 'stagger', variant: 'heading', text: 'stagger — the group settles.' },
  { effect: 'zoom', variant: 'heading', text: 'zoom — it pushes toward you.' },
  { effect: 'morph', variant: 'heading', text: 'morph — a crossfade for now (M5).' },
  { effect: 'none', variant: 'heading', text: 'none — no entrance at all.' },
  { effect: 'words', variant: 'body', text: 'words — a quiet cascade of words.' },
  { effect: 'chars', variant: 'body', text: 'chars — characters, one at a time.' },
  { effect: 'slam', variant: 'body', text: 'slam — it lands with weight.' },
  { effect: 'typewriter', variant: 'body', text: 'typewriter — for the quiet moments.' },
  { effect: 'wipe', variant: 'body', text: 'wipe — the line is revealed.' },
  { effect: 'scribble', variant: 'body', text: 'scribble — a stroke underlines it.' },
  { effect: 'count-up', variant: 'body', text: 'count-up — numbers climb to 42.' },
];

function effectReply(line: (typeof EFFECT_LINES)[number]): Reply {
  return reply([
    {
      op: 'replace',
      blocks: [
        {
          id: `fx-${line.effect}`,
          type: 'text',
          variant: line.variant,
          content: [line.text],
          enter: { effect: line.effect },
        },
      ],
    },
    // replace resets the board theme by ruling; the reel keeps its register
    { op: 'theme', theme: { mood: 'calm', transition: { duration: 1, ease: 'smooth' } } },
  ]);
}

const SCENE_5 = reply([
  {
    op: 'replace',
    blocks: [
      {
        id: 's5-kicker',
        type: 'text',
        variant: 'kicker',
        content: ['the narrator sets the pace'],
        enter: { effect: 'wipe', trigger: { on: 'cue', id: 'beat-1' } },
      },
      {
        id: 's5-body',
        type: 'text',
        variant: 'body',
        content: ['Each line is written only when it is spoken.'],
        enter: { effect: 'typewriter', trigger: { on: 'cue', id: 'beat-2' } },
      },
      {
        id: 's5-heading',
        type: 'text',
        variant: 'heading',
        content: ['Nothing arrives early.'],
        enter: { effect: 'slam', trigger: { on: 'cue', id: 'beat-3' } },
      },
      {
        id: 's5-note',
        type: 'text',
        variant: 'note',
        content: ['Unentered nodes are absent — not hidden, not in the accessibility tree.'],
        enter: { effect: 'reveal', trigger: { on: 'cue', id: 'beat-4' } },
      },
      {
        id: 's5-choices',
        type: 'choices',
        prompt: ['Which line landed first?'],
        layout: 'chips',
        intent: 'answer',
        items: [
          { id: 'first-kicker', label: 'the kicker' },
          { id: 'first-body', label: 'the body line' },
          { id: 'first-heading', label: 'the heading' },
        ],
        enter: { effect: 'pop', trigger: { on: 'cue', id: 'beat-4' }, order: 1 },
      },
    ],
  },
]);

const SCENE_6 = reply([
  {
    op: 'replace',
    blocks: [
      {
        id: 's6-kicker',
        type: 'text',
        variant: 'kicker',
        content: ['a bright register'],
        enter: { effect: 'wipe' },
      },
      {
        id: 's6-hero',
        type: 'text',
        variant: 'hero',
        content: ['Light.'],
        enter: { effect: 'slam' },
      },
      {
        id: 's6-body',
        type: 'text',
        variant: 'body',
        content: ['Quick, springy, paper-warm.'],
        enter: { effect: 'words', delay: 700 },
      },
    ],
  },
]);

const SCENE_6B = reply([
  {
    op: 'append',
    blocks: [
      {
        id: 's6-heading',
        type: 'text',
        variant: 'heading',
        content: ['And then it turns.'],
        enter: { effect: 'typewriter' },
      },
      {
        id: 's6-note',
        type: 'text',
        variant: 'note',
        content: ['Slower. Heavier. Chalk and quiet.'],
        enter: { effect: 'reveal', delay: 1700 },
      },
    ],
  },
]);

const SCENE_7 = reply([
  {
    op: 'replace',
    blocks: [
      {
        id: 's7-body',
        type: 'text',
        variant: 'body',
        content: [
          'A last word: ',
          { mark: 'term', text: 'estuary', definition: 'where a river meets the sea' },
          ' — open it.',
        ],
        enter: { effect: 'words' },
      },
    ],
  },
]);

const SCENE_7B = reply([
  {
    op: 'attach',
    to: 's7-body',
    blocks: [
      {
        id: 's7-detour-text',
        type: 'text',
        variant: 'body',
        content: [
          'Where a river meets the sea, fresh water and salt water mix. The detour expands inline, right after the line it explains.',
        ],
        enter: { effect: 'rise' },
      },
      {
        id: 's7-detour-callout',
        type: 'callout',
        tone: 'info',
        title: 'Detour',
        content: ['Attached content opens on the board; the return control is M4.'],
        enter: { effect: 'rise', delay: 400 },
      },
    ],
    placement: 'right',
    connector: 'arrow',
    target: { annotate: 'circle' },
    mode: 'spotlight',
  },
]);

const SCENE_7C = reply([
  {
    op: 'replace',
    blocks: [
      {
        id: 's7-end-kicker',
        type: 'text',
        variant: 'kicker',
        content: ['thank you'],
        enter: { effect: 'wipe' },
      },
      {
        id: 's7-end-hero',
        type: 'text',
        variant: 'hero',
        content: ['Fin.'],
        enter: { effect: 'slam' },
      },
    ],
  },
  // replace resets the board theme by ruling; the reel re-applies its register.
  { op: 'theme', theme: { mood: 'calm', transition: { duration: 400, ease: 'smooth' } } },
]);

// ---------------------------------------------------------------------------
// Timeline (absolute ms from start)
// ---------------------------------------------------------------------------

const T = {
  scene2: 7_000,
  scene3: 15_000,
  scene4: 24_000,
  effectStep: 1_050,
  scene5: 41_000,
  scene6: 51_000,
  scene7: 60_000,
  done: 68_500,
} as const;

const SCENE_NAMES = ['type', 'voices', 'marks', 'entrances', 'cues', 'mood', 'detour'] as const;
type SceneName = (typeof SCENE_NAMES)[number];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShowreelPage() {
  const board = useBoard();
  const [scene, setScene] = useState<SceneName>('type');
  const [playing, setPlaying] = useState(false);
  const [cues, setCues] = useState<string[]>([]);
  const [lastEvent, setLastEvent] = useState<UIEvent | null>(null);
  const [capture, setCapture] = useState(false);

  const timers = useRef<number[]>([]);
  const playingRef = useRef(false);
  const metrics = useRef({
    start: 0,
    firstNodeMount: 0,
    firstMotionFrame: 0,
    sceneStarts: {} as Record<string, number>,
    frames: [] as number[],
  });

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const at = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const go = useCallback((name: SceneName) => {
    setScene(name);
    window.__SHOWREEL_SCENE__ = name;
    metrics.current.sceneStarts[name] = performance.now() - metrics.current.start;
  }, []);

  const play = useCallback(() => {
    clearTimers();
    board.reset();
    setCues([]);
    setLastEvent(null);
    setPlaying(true);
    playingRef.current = true;
    metrics.current = {
      start: performance.now(),
      firstNodeMount: 0,
      firstMotionFrame: 0,
      sceneStarts: {},
      frames: [],
    };
    window.__SHOWREEL_DONE__ = false;

    at(0, () => {
      go('type');
      board.applyFinal(theme('calm'));
      board.applyFinal(SCENE_1);
    });
    at(T.scene2, () => {
      go('voices');
      board.applyFinal(SCENE_2);
      board.applyFinal(theme('calm'));
    });
    at(T.scene3, () => {
      go('marks');
      board.applyFinal(SCENE_3);
      board.applyFinal(theme('calm'));
      // Scripted demonstration: press the focusable mark so the event ticker
      // shows a real UIEvent travelling out of the board.
      at(5_200, () => {
        const el = document.querySelector<HTMLButtonElement>('.dg-mark-focusable');
        el?.click();
      });
    });
    at(T.scene4, () => {
      go('entrances');
      EFFECT_LINES.forEach((line, i) => at(i * T.effectStep, () => board.applyFinal(effectReply(line))));
    });
    at(T.scene5, () => {
      go('cues');
      setCues([]);
      board.applyFinal(SCENE_5);
      board.applyFinal(theme('calm'));
      // The mock narrator: cues land on narration beats.
      at(800, () => board.cue('beat-1'));
      at(2_400, () => board.cue('beat-2'));
      at(4_000, () => board.cue('beat-3'));
      at(6_200, () => board.cue('beat-4'));
    });
    at(T.scene6, () => {
      go('mood');
      board.applyFinal(SCENE_6);
      board.applyFinal(theme('playful'));
      at(3_800, () => board.applyFinal(theme('solemn', 900)));
      at(4_100, () => board.applyFinal(SCENE_6B));
    });
    at(T.scene7, () => {
      go('detour');
      board.applyFinal(SCENE_7);
      board.applyFinal(theme('calm', 500));
      at(1_200, () => board.applyFinal(SCENE_7B));
      at(3_200, () => document.querySelector<HTMLElement>('.dg-mark-term')?.click());
      at(5_200, () => board.applyFinal(SCENE_7C));
    });
    at(T.done, () => {
      playingRef.current = false;
      setPlaying(false);
      const m = metrics.current;
      const deltas: number[] = [];
      for (let i = 1; i < m.frames.length; i += 1) deltas.push(m.frames[i]! - m.frames[i - 1]!);
      deltas.sort((a, b) => a - b);
      const pct = (p: number) => deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * p))] ?? 0;
      const avg = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
      window.__SHOWREEL_METRICS__ = {
        start: m.start,
        done: performance.now(),
        firstNodeMount: m.firstNodeMount,
        firstMotionFrame: m.firstMotionFrame,
        frames: m.frames.length,
        avgFrameMs: avg,
        fps: avg > 0 ? 1000 / avg : 0,
        p50FrameMs: pct(0.5),
        p95FrameMs: pct(0.95),
        maxFrameMs: deltas[deltas.length - 1] ?? 0,
        longFrames: deltas.filter((d) => d > 50).length,
        sceneStarts: m.sceneStarts,
      };
      window.__SHOWREEL_DONE__ = true;
    });
  }, [at, board, clearTimers, go]);

  // Auto-start for humans; capture mode waits for the recording script.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isCapture = params.get('capture') === '1';
    setCapture(isCapture);
    window.__SHOWREEL_READY__ = true;
    window.__SHOWREEL_START__ = play;
    window.__SHOWREEL_SCENE__ = 'type';
    if (!isCapture) {
      const id = window.setTimeout(play, 350);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [play]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Frame instrumentation (60 fps evidence on a CPU-throttled run).
  useEffect(() => {
    let raf = 0;
    const tick = (t: number): void => {
      if (playingRef.current) {
        metrics.current.frames.push(t);
        if (metrics.current.firstNodeMount > 0 && metrics.current.firstMotionFrame === 0) {
          metrics.current.firstMotionFrame = Math.max(metrics.current.firstNodeMount, t - metrics.current.start);
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  // First node mount relative to the showreel start (first-motion evidence).
  useEffect(() => {
    const root = document.querySelector('.dg-board');
    if (!root) return undefined;
    const obs = new MutationObserver(() => {
      if (!playingRef.current || metrics.current.firstNodeMount > 0) return;
      if (root.querySelector('.dg-node')) {
        metrics.current.firstNodeMount = performance.now() - metrics.current.start;
      }
    });
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  // Telemetry for the studio strip.
  useEffect(() => board.events.subscribe((event) => setLastEvent(event)), [board]);
  useEffect(() => board.cueBus.subscribe((id) => setCues((prev) => [...prev, id])), [board]);

  return (
    <DreamerProvider registry={registry}>
      <main className="showreel-stage" data-capture={capture ? '1' : undefined}>
        <h1 className="dg-sr-only">dreamer-genui M3 showreel</h1>
        <Board
          store={board}
          classNames={{ root: 'showreel-board', content: 'showreel-content' }}
          onEvent={(e) => setLastEvent(e)}
        />

        {!capture && (
          <div className="showreel-chrome" role="group" aria-label="showreel controls">
            <div className="showreel-row">
              <button type="button" onClick={play} className="showreel-button">
                {playing ? 'replay' : 'play'}
              </button>
              <button type="button" onClick={() => board.flush()} className="showreel-button">
                flush
              </button>
              <button type="button" onClick={() => board.seek('beat-3')} className="showreel-button">
                seek beat-3
              </button>
              <span className="showreel-meta">
                scene <strong>{scene}</strong>
                {cues.length > 0 && <> · cues {cues.join(' · ')}</>}
                {lastEvent && <> · event {lastEvent.type}</>}
              </span>
            </div>
            <p className="showreel-note">
              M3 scope: all 16 enter effects, kinetic variants, marks, cue gating and a mood shift.
              Camera, receding, detour return and ambience runtime are M4.
            </p>
          </div>
        )}
      </main>
    </DreamerProvider>
  );
}
