import type { CSSProperties, ReactNode } from 'react';
import { useParts } from '../anatomy';

/** Hand-drawn annotation primitives (§6.6, §7.7, §11). */
export type AnnotationKind = 'circle' | 'underline' | 'box' | 'bracket' | 'strike';

export interface AnnotationStrokeProps {
  kind: AnnotationKind;
  /** Seed keeps jitter deterministic across SSR/hydration (no Math.random in render). */
  seed?: string;
  color?: string;
  className?: string;
}

/** Deterministic, small jitter from a string seed — stable on server and client. */
function jitter(seed: string, index: number): number {
  let h = 2166136261;
  const source = `${seed}:${index}`;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 2.6;
}

function pathFor(kind: AnnotationKind, seed: string): string {
  const j = (i: number) => jitter(seed, i);
  switch (kind) {
    case 'underline':
      return `M 2 13 Q 30 ${11 + j(1)} 60 ${13 + j(2)} T 118 ${12 + j(3)} T 196 ${13 + j(4)}`;
    case 'circle':
      return `M 96 4 C 150 ${2 + j(1)} 197 12 198 ${34 + j(2)} C 199 ${58 + j(3)} 140 ${66 + j(4)} 94 ${66 + j(5)} C 40 ${67 + j(6)} 2 ${54 + j(7)} 3 ${34 + j(8)} C 4 ${14 + j(9)} 48 ${5 + j(10)} 96 4 Z`;
    case 'box':
      return `M 3 ${5 + j(1)} L 197 ${3 + j(2)} L 198 ${65 + j(3)} L 4 ${66 + j(4)} Z`;
    case 'bracket':
      return `M 10 4 L 4 ${3 + j(1)} L 5 ${66 + j(2)} L 11 ${64 + j(3)} M 190 4 L 196 ${3 + j(4)} L 195 ${66 + j(5)} L 189 ${64 + j(6)}`;
    case 'strike':
      return `M 3 ${50 + j(1)} Q 100 ${40 + j(2)} 197 ${19 + j(3)}`;
  }
}

/** An SVG stroke that draws itself on mount and settles into a hand-drawn mark. */
export function AnnotationStroke({ kind, seed = kind, color, className }: AnnotationStrokeProps): ReactNode {
  const p = useParts('annotation');
  const root = p.props('root', `dg-annotation dg-annotation-${kind} ${className ?? ''}`.trim());
  return (
    <svg
      {...root}
      viewBox="0 0 200 70"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-dg-part="root"
      data-dg-kind={kind}
      style={color ? ({ '--dg-annotation-color': color } as CSSProperties) : undefined}
    >
      <path
        {...p.props('stroke', 'dg-annotation-stroke')}
        data-dg-part="stroke"
        d={pathFor(kind, seed)}
        pathLength={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Wrap inline text with an annotation overlay positioned by the host CSS. */
export function Annotated({ kind, seed, children }: { kind: AnnotationKind; seed?: string; children: ReactNode }): ReactNode {
  return (
    <span className={`dg-annotated dg-annotated-${kind}`} data-dg-part="annotated">
      {children}
      <AnnotationStroke kind={kind} seed={seed} />
    </span>
  );
}
