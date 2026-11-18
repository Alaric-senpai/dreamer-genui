import { useEffect, useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { useReducedMotion } from 'motion/react';
import type { Inline } from '../../schema/inline';
import type {
  AccordionBlock,
  AlertBlock,
  AvatarBlock,
  BadgeBlock,
  Block,
  CardBlock,
  CarouselBlock,
  CollapsibleBlock,
  CounterBlock,
  KbdBlock,
  ProgressBlock,
  SeparatorBlock,
  TabsBlock,
} from '../../schema/blocks';
import { renderInline } from './inline';
import { useDreamer, useEmitEvent } from '../provider';
import { useOverride, useParts } from '../anatomy';

/**
 * Tutor-addressable UI-kit blocks (§6.19). Built on Radix primitives for the
 * interaction and accessibility layer; presentation is token-only CSS. Every
 * view honours the §8.5 anatomy contract and is replaceable through the
 * provider `components` map.
 */

type RenderBlocks = (blocks: Block[]) => ReactNode;

// --- Card ---

export function CardView({ block, renderBlocks }: { block: CardBlock; renderBlocks: RenderBlocks }): ReactNode {
  const p = useParts('card');
  const override = useOverride('card');
  const emit = useEmitEvent();
  const { strings } = useDreamer();
  const titleId = useId();
  const interactive = Boolean(block.interactive);
  const variant = block.variant ?? 'plain';
  const media = block.media;
  const select = (): void => {
    if (interactive) emit({ type: 'select', nodeId: block.id });
  };
  const defaultView = (
    <article
      {...p.props('root', `dg-card dg-card-${variant}`)}
      data-node-id={block.id}
      data-interactive={interactive ? 'true' : undefined}
      aria-labelledby={block.title?.length ? titleId : undefined}
      aria-label={!block.title?.length && interactive ? strings.card : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        const control = target.closest('button, a, input, textarea, select, [role="button"]');
        if (control && control !== event.currentTarget) return;
        select();
      }}
      onKeyDown={(event) => {
        if (!interactive) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      }}
    >
      {media?.kind === 'image' && typeof media.src === 'string' ? (
        <img {...p.props('media', 'dg-card-media')} src={media.src} alt={media.alt} />
      ) : media ? (
        <div {...p.props('media', 'dg-card-media dg-card-media-fallback')} aria-hidden="true" />
      ) : null}
      <div {...p.props('body', 'dg-card-body')}>
        {block.title?.length ? (
          <h3 {...p.props('title', 'dg-card-title')} id={titleId}>
            {renderInline(block.title)}
          </h3>
        ) : null}
        {block.description?.length ? (
          <p {...p.props('description', 'dg-card-description')}>{renderInline(block.description)}</p>
        ) : null}
        <div {...p.props('content', 'dg-card-content')}>{renderBlocks(block.blocks)}</div>
      </div>
      {block.footer?.length ? (
        <footer {...p.props('footer', 'dg-card-footer')}>{renderBlocks(block.footer)}</footer>
      ) : null}
    </article>
  );
  return override ? override({ block, renderBlocks, renderDefault: () => defaultView }) : defaultView;
}

// --- Alert ---

export function AlertView({ block }: { block: AlertBlock }): ReactNode {
  const p = useParts('alert');
  const override = useOverride('alert');
  const emit = useEmitEvent();
  const { strings } = useDreamer();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const defaultView = (
    <div
      {...p.props('root', `dg-alert dg-alert-${block.tone}`)}
      data-node-id={block.id}
      role={block.tone === 'danger' || block.tone === 'warn' ? 'alert' : 'status'}
    >
      {block.icon ? <span {...p.props('icon', 'dg-alert-icon')} aria-hidden="true">{block.icon}</span> : null}
      <div {...p.props('body', 'dg-alert-body')}>
        {block.title?.length ? <strong {...p.props('title', 'dg-alert-title')}>{renderInline(block.title)}</strong> : null}
        <div {...p.props('content', 'dg-alert-content')}>{renderInline(block.content)}</div>
      </div>
      {block.dismissible ? (
        <button
          type="button"
          {...p.props('dismiss', 'dg-alert-dismiss')}
          aria-label={strings.dismiss}
          onClick={() => {
            setDismissed(true);
            emit({ type: 'action', nodeId: block.id, action: 'dismiss' });
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Accordion ---

function inlineLabel(label: Inline[] | undefined): string {
  return (label ?? [])
    .map((part) => {
      if (typeof part === 'string') return part;
      switch (part.mark) {
        case 'highlight':
        case 'emphasis':
        case 'focusable':
        case 'annotate':
          return typeof part.text === 'string' ? part.text : inlineLabel(part.text);
        case 'term':
          return part.text;
        case 'math':
          return part.tex;
        case 'blank':
          return part.id;
      }
    })
    .join(' ')
    .trim();
}

export function AccordionView({ block, renderBlocks }: { block: AccordionBlock; renderBlocks: RenderBlocks }): ReactNode {
  const p = useParts('accordion');
  const override = useOverride('accordion');
  const emit = useEmitEvent();
  const multiple = Boolean(block.multiple);
  const [value, setValue] = useState<string[]>(() => block.items.filter(item => item.open).map(item => item.id));
  const onValueChange = (next: string | string[]): void => {
    const list = Array.isArray(next) ? next : next ? [next] : [];
    const changed = block.items.find(item => list.includes(item.id) !== value.includes(item.id));
    setValue(list);
    if (changed) {
      emit({ type: 'action', nodeId: block.id, action: 'toggle', detail: { itemId: changed.id, open: list.includes(changed.id) } });
    }
  };
  const defaultView = (
    <AccordionPrimitive.Root
      {...p.props('root', 'dg-accordion')}
      data-node-id={block.id}
      {...(multiple
        ? { type: 'multiple' as const, value, onValueChange }
        : { type: 'single' as const, collapsible: true, value: value[0], onValueChange })}
    >
      {block.items.map((item) => (
        <AccordionPrimitive.Item {...p.props('item', 'dg-accordion-item')} key={item.id} value={item.id}>
          <AccordionPrimitive.Header {...p.props('header', 'dg-accordion-header')}>
            <AccordionPrimitive.Trigger {...p.props('trigger', 'dg-accordion-trigger')}>
              <span {...p.props('title', 'dg-accordion-title')}>{renderInline(item.title)}</span>
              <span {...p.props('indicator', 'dg-accordion-indicator')} aria-hidden="true" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content {...p.props('content', 'dg-accordion-content')}>
            <div {...p.props('body', 'dg-accordion-body')}>{renderBlocks(item.blocks)}</div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
  return override ? override({ block, renderBlocks, renderDefault: () => defaultView }) : defaultView;
}

// --- Collapsible ---

export function CollapsibleView({ block, renderBlocks }: { block: CollapsibleBlock; renderBlocks: RenderBlocks }): ReactNode {
  const p = useParts('collapsible');
  const override = useOverride('collapsible');
  const emit = useEmitEvent();
  const [open, setOpen] = useState(Boolean(block.open));
  const defaultView = (
    <CollapsiblePrimitive.Root
      {...p.props('root', 'dg-collapsible')}
      data-node-id={block.id}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        emit({ type: 'action', nodeId: block.id, action: 'toggle', detail: { open: next } });
      }}
    >
      <CollapsiblePrimitive.Trigger {...p.props('trigger', 'dg-collapsible-trigger')}>
        <span {...p.props('title', 'dg-collapsible-title')}>{renderInline(block.title)}</span>
        <span {...p.props('indicator', 'dg-collapsible-indicator')} aria-hidden="true" />
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content {...p.props('content', 'dg-collapsible-content')}>
        <div {...p.props('body', 'dg-collapsible-body')}>{renderBlocks(block.blocks)}</div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
  return override ? override({ block, renderBlocks, renderDefault: () => defaultView }) : defaultView;
}

// --- Tabs ---

export function TabsView({ block, renderBlocks }: { block: TabsBlock; renderBlocks: RenderBlocks }): ReactNode {
  const p = useParts('tabs');
  const override = useOverride('tabs');
  const emit = useEmitEvent();
  const { strings } = useDreamer();
  const first = block.tabs[0]?.id ?? '';
  const initial = block.active && block.tabs.some(tab => tab.id === block.active) ? block.active : first;
  const [active, setActive] = useState(initial);
  const defaultView = (
    <TabsPrimitive.Root
      {...p.props('root', 'dg-tabs')}
      data-node-id={block.id}
      value={active}
      onValueChange={(next) => {
        setActive(next);
        emit({ type: 'select', nodeId: block.id, ref: next, label: inlineLabel(block.tabs.find(tab => tab.id === next)?.label) || undefined });
      }}
    >
      <TabsPrimitive.List {...p.props('list', 'dg-tabs-list')} aria-label={strings.card}>
        {block.tabs.map((tab) => (
          <TabsPrimitive.Trigger {...p.props('trigger', 'dg-tabs-trigger')} key={tab.id} value={tab.id}>
            {renderInline(tab.label)}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {block.tabs.map((tab) => (
        <TabsPrimitive.Content {...p.props('panel', 'dg-tabs-panel')} key={tab.id} value={tab.id}>
          <div {...p.props('body', 'dg-tabs-body')}>{renderBlocks(tab.blocks)}</div>
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
  return override ? override({ block, renderBlocks, renderDefault: () => defaultView }) : defaultView;
}

// --- Badge ---

export function BadgeView({ block }: { block: BadgeBlock }): ReactNode {
  const p = useParts('badge');
  const override = useOverride('badge');
  const tone = block.tone ?? 'accent';
  const defaultView = (
    <span {...p.props('root', `dg-badge dg-badge-${tone}`)} data-node-id={block.id}>
      <span {...p.props('text', 'dg-badge-text')}>{renderInline(block.text)}</span>
    </span>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Progress ---

function clampProgress(value: number | undefined): number | null {
  if (value === undefined) return null;
  return Math.max(0, Math.min(100, value));
}

export function ProgressView({ block }: { block: ProgressBlock }): ReactNode {
  const p = useParts('progress');
  const override = useOverride('progress');
  const { strings } = useDreamer();
  const reduced = useReducedMotion();
  const target = clampProgress(block.value);
  const [shown, setShown] = useState(reduced ? target ?? 0 : 0);
  useEffect(() => {
    if (target === null) return;
    const frame = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);
  const variant = block.variant ?? 'bar';
  const label = block.label ?? strings.progress;
  const defaultView = (
    <div {...p.props('root', `dg-progress dg-progress-${variant}`)} data-node-id={block.id}>
      {variant === 'ring' ? (
        <div
          {...p.props('ring', 'dg-progress-ring')}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={target ?? undefined}
          aria-valuetext={target === null ? undefined : `${target}%`}
        >
          <svg viewBox="0 0 42 42" aria-hidden="true">
            <circle {...p.props('ringTrack', 'dg-progress-ring-track')} cx="21" cy="21" r="16" pathLength={100} />
            <circle
              {...p.props('ringFill', 'dg-progress-ring-fill')}
              cx="21"
              cy="21"
              r="16"
              pathLength={100}
              strokeDasharray={`${shown} 100`}
            />
          </svg>
          <span {...p.props('value', 'dg-progress-value')} aria-hidden="true">{target === null ? '' : `${Math.round(target)}%`}</span>
        </div>
      ) : (
        <ProgressPrimitive.Root
          {...p.props('track', 'dg-progress-track')}
          value={target}
          max={100}
          aria-label={label}
        >
          <ProgressPrimitive.Indicator
            {...p.props('fill', 'dg-progress-fill')}
            style={{ transform: `translateX(-${100 - shown}%)` }}
          />
        </ProgressPrimitive.Root>
      )}
      {block.label ? <span {...p.props('label', 'dg-progress-label')}>{block.label}</span> : null}
    </div>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Counter ---

function formatCounter(value: number, format: CounterBlock['format'], locale: string): string {
  switch (format) {
    case 'percent': {
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
    }
    case 'time': {
      const total = Math.max(0, Math.round(value));
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      const mm = hours ? String(minutes).padStart(2, '0') : String(minutes);
      return `${hours ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
    }
    case 'currency': {
      // The schema carries no currency code (6.5); use the locale's decimal
      // grouping with two fraction digits and put the unit in `label`.
      return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    }
    default:
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  }
}

export function CounterView({ block }: { block: CounterBlock }): ReactNode {
  const p = useParts('counter');
  const override = useOverride('counter');
  const { locale } = useDreamer();
  const reduced = useReducedMotion();
  const from = block.from ?? 0;
  const [display, setDisplay] = useState(reduced ? block.value : from);
  useEffect(() => {
    if (reduced) {
      setDisplay(block.value);
      return;
    }
    const started = performance.now();
    const duration = 800;
    let frame = 0;
    const step = (now: number): void => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (block.value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [block.value, from, reduced]);
  const formatted = formatCounter(display, block.format, locale);
  const final = formatCounter(block.value, block.format, locale);
  const defaultView = (
    <div {...p.props('root', 'dg-counter')} data-node-id={block.id} data-format={block.format ?? 'number'}>
      <span {...p.props('value', 'dg-counter-value')} aria-hidden="true">{formatted}</span>
      <span className="dg-sr-only">{final}</span>
      {block.label ? <span {...p.props('label', 'dg-counter-label')}>{block.label}</span> : null}
    </div>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Avatar ---

export function AvatarView({ block }: { block: AvatarBlock }): ReactNode {
  const p = useParts('avatar');
  const override = useOverride('avatar');
  const src = typeof block.src === 'string' ? block.src : undefined;
  const size = block.size ?? 'md';
  const fallback = block.name ? block.name.trim().slice(0, 1).toUpperCase() : block.icon ?? '?';
  const defaultView = (
    <AvatarPrimitive.Root {...p.props('root', `dg-avatar dg-avatar-${size}`)} data-node-id={block.id}>
      {src ? <AvatarPrimitive.Image {...p.props('image', 'dg-avatar-image')} src={src} alt={block.name ?? ''} /> : null}
      <AvatarPrimitive.Fallback {...p.props('fallback', 'dg-avatar-fallback')} delayMs={src ? 400 : 0}>
        {block.icon ? <span aria-hidden="true">{block.icon}</span> : fallback}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Separator ---

export function SeparatorView({ block }: { block: SeparatorBlock }): ReactNode {
  const p = useParts('separator');
  const override = useOverride('separator');
  const orientation = block.orientation ?? 'horizontal';
  const defaultView = block.label ? (
    <div {...p.props('root', `dg-separator dg-separator-${orientation} dg-separator-labelled`)} data-node-id={block.id} role="separator" aria-orientation={orientation} aria-label={block.label}>
      <span {...p.props('line', 'dg-separator-line')} aria-hidden="true" />
      <span {...p.props('label', 'dg-separator-label')}>{block.label}</span>
      <span {...p.props('line', 'dg-separator-line')} aria-hidden="true" />
    </div>
  ) : (
    <SeparatorPrimitive.Root
      {...p.props('root', 'dg-separator')}
      data-node-id={block.id}
      orientation={orientation}
      decorative={false}
    />
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}

// --- Carousel ---

export function CarouselView({ block, renderBlocks }: { block: CarouselBlock; renderBlocks: RenderBlocks }): ReactNode {
  const p = useParts('carousel');
  const override = useOverride('carousel');
  const emit = useEmitEvent();
  const { strings } = useDreamer();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const count = block.slides.length;
  useEffect(() => {
    if (!block.auto || reduced) return;
    const id = window.setInterval(() => setIndex(current => (current + 1) % count), 6000);
    return () => window.clearInterval(id);
  }, [block.auto, reduced, count]);
  const go = (next: number): void => {
    if (next === index) return;
    setIndex(next);
    emit({ type: 'select', nodeId: block.id, ref: block.slides[next]?.id });
  };
  const slide = block.slides[index];
  const style: CSSProperties = { '--dg-carousel-index': index } as CSSProperties;
  const defaultView = (
    <section
      {...p.props('root', 'dg-carousel')}
      data-node-id={block.id}
      style={style}
      role="region"
      aria-roledescription={strings.carousel}
      aria-label={block.alt ?? strings.carousel}
    >
      <div {...p.props('viewport', 'dg-carousel-viewport')}>
        {slide ? (
          <div
            {...p.props('slide', 'dg-carousel-slide')}
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${count}`}
          >
            {renderBlocks(slide.blocks)}
          </div>
        ) : null}
      </div>
      <div {...p.props('controls', 'dg-carousel-controls')}>
        <button type="button" {...p.props('previous', 'dg-carousel-previous')} aria-label={strings.previous} disabled={count < 2} onClick={() => go((index - 1 + count) % count)}>
          <span aria-hidden="true">‹</span>
        </button>
        <div {...p.props('dots', 'dg-carousel-dots')} role="group" aria-label={strings.slide}>
          {block.slides.map((item, i) => (
            <button
              type="button"
              {...p.props('dot', 'dg-carousel-dot')}
              key={item.id}
              data-active={i === index ? 'true' : undefined}
              aria-label={`${strings.slide} ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" {...p.props('next', 'dg-carousel-next')} aria-label={strings.next} disabled={count < 2} onClick={() => go((index + 1) % count)}>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
  return override ? override({ block, renderBlocks, renderDefault: () => defaultView }) : defaultView;
}

// --- Kbd ---

export function KbdView({ block }: { block: KbdBlock }): ReactNode {
  const p = useParts('kbd');
  const override = useOverride('kbd');
  const defaultView = (
    <span {...p.props('root', 'dg-kbd')} data-node-id={block.id}>
      {block.keys.map((key, index) => (
        <kbd {...p.props('key', 'dg-kbd-key')} key={`${key}-${index}`}>
          {key}
        </kbd>
      ))}
    </span>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}
