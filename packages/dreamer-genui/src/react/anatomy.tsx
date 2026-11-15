import { createContext, useContext } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DreamerContext } from './provider';

export { COMPONENT_META, COMPONENT_REGISTRY, defineComponentMeta } from './anatomy-meta';
export type { ComponentMeta } from './anatomy-meta';

/**
 * Component anatomy contract (§8.5, "Customization Surface"). Every built-in
 * component:
 *
 * 1. exports a `ComponentMeta` — `{ name, parts, tokens, variants, dataAttrs,
 *    events, effects }`;
 * 2. renders each part with `data-dg-part="<part>"` and the stable class
 *    `dg-<component>-<part>` (via `partProps`);
 * 3. styles only through `--dg-*` variables, including its component tokens
 *    `--dg-<component>-<token>`;
 * 4. accepts per-part `classNames` (Tailwind strings welcome) and `styles`
 *    (token-safe), and is replaceable through the provider `components` map.
 *
 * `docs/components/<name>.md` is generated from the metadata by
 * `pnpm dg:component-docs`; the CI test (`tests/react/anatomy.test.tsx`)
 * fails if a built-in component lacks metadata or cannot be replaced.
 */

/**
 * A component override (§8.5.4). Receives the component's own props plus
 * `renderDefault()`; returns whatever it wants to render. Overrides are
 * trusted host code — they receive validated data only.
 */
export type ComponentOverride = (props: { renderDefault: () => ReactNode } & Record<string, unknown>) => ReactNode;

/** Per-part class and style overrides (§8.5.3/4); Tailwind strings welcome. */
export type PartClassNames = Record<string, string | undefined>;
export type PartStyles = Record<string, CSSProperties | undefined>;

/**
 * Props for one part: the part marker, the stable class, and the host's
 * per-part class/style merged in. Library classes stay first so host
 * utilities (Tailwind) win the cascade.
 */
export function partProps(
  component: string,
  part: string,
  classNames?: PartClassNames,
  styles?: PartStyles,
  extraClassName?: string,
): { 'data-dg-part': string; className: string; style?: CSSProperties } {
  const own = `dg-${component}-${part}`;
  const host = classNames?.[part];
  const style = styles?.[part];
  const tokens = `${own}${extraClassName ? ` ${extraClassName}` : ''}${host ? ` ${host}` : ''}`;
  const className = Array.from(new Set(tokens.split(/\s+/).filter(Boolean))).join(' ');
  return {
    'data-dg-part': part,
    className,
    ...(style ? { style } : {}),
  };
}

/** Read the host's component-overrides map (§8.5.4). Empty outside a provider. */
export function useComponents(): Record<string, ComponentOverride | undefined> {
  return useContext(DreamerContext)?.components ?? {};
}

/**
 * Resolve an override for one component. Call at the top of a component body
 * (it is a hook); render `defaultView` and let the override decide.
 *
 * ```tsx
 * const override = useOverride('callout');
 * const defaultView = (<aside …>…</aside>);
 * return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
 * ```
 */
export function useOverride(name: string): ComponentOverride | undefined {
  return useComponents()[name];
}

/**
 * Board-level per-part class/style overrides: built-in component name →
 * per-part map. The <Board> provides them; every built-in part resolves
 * through `useParts`.
 */
export type PartOverrides = Record<string, PartClassNames | undefined>;
export type PartStyleOverrides = Record<string, PartStyles | undefined>;

const AnatomyContext = createContext<{ classNames: PartOverrides; styles: PartStyleOverrides }>({ classNames: {}, styles: {} });

export interface AnatomyProviderProps {
  classNames?: PartOverrides;
  styles?: PartStyleOverrides;
  children: ReactNode;
}

/** Provides the board's per-part class/style overrides to every built-in part. */
export function AnatomyProvider({ classNames, styles, children }: AnatomyProviderProps): ReactNode {
  const value = { classNames: classNames ?? {}, styles: styles ?? {} };
  return <AnatomyContext.Provider value={value}>{children}</AnatomyContext.Provider>;
}

/**
 * Per-part props bound to one component (§8.5). Call once per component body:
 *
 * ```tsx
 * const p = useParts('callout');
 * <aside {...p.props('root', `dg-callout-${block.tone}`)}>
 * ```
 *
 * Hosts pass `partClassNames={{ callout: { root: 'my-classes' } }}` (and
 * `partStyles`) on `<Board>`; every part merges them after the library class.
 */
export function useParts(component: string): { props: (part: string, extraClassName?: string) => { 'data-dg-part': string; className: string; style?: CSSProperties } } {
  const { classNames, styles } = useContext(AnatomyContext);
  return {
    props: (part: string, extraClassName?: string) => partProps(component, part, classNames[component], styles[component], extraClassName),
  };
}
