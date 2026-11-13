'use client';

/**
 * Ambience runtime (§6.9).
 *
 * Renders a registered preset's generic layer kind behind the board content:
 * CSS layers for grain/vignette/haze/flicker, a small canvas for particles.
 * Hard rules enforced here:
 *  - counts are capped (and halved in lite mode) by ambience/particles.ts;
 *  - animation pauses when the tab is hidden or the board is off-screen;
 *  - prefers-reduced-motion draws one static frame and never starts rAF;
 *  - the layer is aria-hidden, pointer-events: none and sits below content.
 * Preset names never appear in logic: the renderer switches on `layer`.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import type { AmbiencePreset } from '../../theme/presets';
import type { ThemeTokens } from '../../schema/theme';
import { drawParticles, seedParticles, stepParticles } from '../../ambience/particles';

const FRAME_MS = 1000 / 30; // fixed ambience frame budget
const FADE_MS = 800;

export interface AmbienceLayerProps {
  preset?: AmbiencePreset | null;
  texture?: ThemeTokens['texture'];
  /** "off" disables ambience; "lite" halves particles; "auto" uses the preset as-is. */
  mode?: 'auto' | 'off' | 'lite';
  /** Host override; defaults to the OS preference. */
  reducedMotion?: boolean;
}

export function AmbienceLayer({ preset, texture, mode = 'auto', reducedMotion }: AmbienceLayerProps): ReactNode {
  const prefersReduced = useReducedMotion();
  const reduced = reducedMotion ?? Boolean(prefersReduced);
  const effective = mode === 'off' ? null : (preset ?? null);
  // Lite mode: host override, or auto-detected on low-end devices (§6.9).
  const autoLite =
    mode === 'auto' && typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const lite = mode === 'lite' || autoLite;

  // Crossfade between presets (§6.8: ambience fades, never a hard cut).
  const [active, setActive] = useState<AmbiencePreset | null>(effective);
  const [leaving, setLeaving] = useState<AmbiencePreset | null>(null);
  useEffect(() => {
    if ((active?.name ?? null) === (effective?.name ?? null)) return;
    if (reduced) {
      setActive(effective);
      setLeaving(null);
      return;
    }
    setLeaving(active);
    setActive(effective);
    const timer = setTimeout(() => setLeaving(null), FADE_MS);
    return () => clearTimeout(timer);
  }, [effective, active, reduced]);

  const grain = texture?.grain ?? 0;
  const vignette = texture?.vignette ?? 0;

  return (
    <div className="dg-ambience" aria-hidden="true" data-dg-ambience-mode={lite ? 'lite' : mode} data-dg-ambience-preset={active?.name ?? preset?.name}>
      {grain > 0 && <div className="dg-ambience-texture dg-ambience-grain" style={{ opacity: grain }} />}
      {vignette > 0 && <div className="dg-ambience-texture dg-ambience-vignette" style={{ opacity: vignette }} />}
      {leaving && <PresetLayer key={`old-${leaving.name}`} preset={leaving} lite={lite} reduced={reduced} leaving />}
      {active && <PresetLayer key={`new-${active.name}`} preset={active} lite={lite} reduced={reduced} />}
    </div>
  );
}

function PresetLayer({
  preset,
  lite,
  reduced,
  leaving,
}: {
  preset: AmbiencePreset;
  lite: boolean;
  reduced: boolean;
  leaving?: boolean;
}): ReactNode {
  const layer = preset.layer ?? 'grain';
  const intensity = preset.intensity ?? 1;
  const style = {
    '--dg-ambience-intensity': String(intensity),
    opacity: leaving ? 0 : intensity,
  } as CSSProperties;
  if (layer === 'particles' && preset.particles) {
    return <ParticleCanvas config={preset.particles} lite={lite} reduced={reduced} leaving={leaving} />;
  }
  return (
    <div
      className={`dg-ambience-layer dg-ambience-${layer}${leaving ? ' dg-ambience-leaving' : ''}`}
      data-dg-ambience-kind={layer}
      style={style}
    />
  );
}

function ParticleCanvas({
  config,
  lite,
  reduced,
  leaving,
}: {
  config: NonNullable<AmbiencePreset['particles']>;
  lite: boolean;
  reduced: boolean;
  leaving?: boolean;
}): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [state, setState] = useState<'static' | 'running' | 'paused'>('paused');

  // Tab visibility (§6.9 pause rule).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = (): void => setVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  // Off-screen pause (§6.9 pause rule).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setInView(entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles = [] as ReturnType<typeof seedParticles>;
    let dpr = 1;

    const measure = (): void => {
      const host = canvas.parentElement;
      width = host?.clientWidth ?? 0;
      height = host?.clientHeight ?? 0;
      if (width === 0 || height === 0) return;
      dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = seedParticles(config, width, height, lite);
    };
    measure();
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    const host = canvas.parentElement;
    if (resize && host) resize.observe(host);

    const color =
      typeof window !== 'undefined'
        ? getComputedStyle(canvas).getPropertyValue(`--dg-color-${config.color}`).trim() || '#565650'
        : '#565650';

    if (reduced) {
      drawParticles(ctx, particles, color, 0);
      setState('static');
      return () => resize?.disconnect();
    }

    if (!visible || !inView) {
      setState('paused');
      // keep a calm frame visible while paused
      drawParticles(ctx, particles, color, 0);
      return () => resize?.disconnect();
    }

    setState('running');
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    const frame = (now: number): void => {
      if (last === 0) last = now;
      const delta = now - last;
      if (delta >= FRAME_MS) {
        elapsed += delta / 1000;
        particles = stepParticles(particles, delta / 1000, width, height, config.direction);
        ctx.clearRect(0, 0, width, height);
        drawParticles(ctx, particles, color, elapsed);
        last = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      resize?.disconnect();
    };
  }, [config, lite, reduced, visible, inView]);

  return (
    <canvas
      ref={canvasRef}
      className={`dg-ambience-layer dg-ambience-particles${leaving ? ' dg-ambience-leaving' : ''}`}
      data-dg-ambience-kind="particles"
      data-dg-ambience-state={state}
    />
  );
}
