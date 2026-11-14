import type { Op } from '../schema/ops';
import type { Block } from '../schema/blocks';
import type { UIEvent } from '../schema/events';
import { createError } from './errors';
import type { LibraryError } from './types';
import type { MiddlewareContext, MiddlewareDefinition } from './plugin';
import type { Registry } from './registry';

/**
 * Middleware pipeline (§8.6). Each hook can transform, expand or drop ops and
 * events; errors are isolated per middleware and reported as `middleware-error`
 * so a broken plugin can never break the board.
 *
 * Hooks may be async. The synchronous helpers are what the current resolver
 * uses; hosts that need async interception can call the async pipeline before
 * handing ops to the board.
 */

export interface MiddlewareRuntimeContext extends MiddlewareContext {
  readonly registry: Registry;
  readonly direction: 'ltr' | 'rtl';
  readonly locale: string;
}

export interface MiddlewarePipelineOptions {
  registry: Registry;
  locale?: string;
  dir?: 'ltr' | 'rtl';
  onError?: (error: LibraryError) => void;
}

export interface MiddlewarePipeline {
  readonly middleware: MiddlewareDefinition[];
  /** Apply op middleware in priority order. Expansions flow into later entries. */
  applyOps(ops: Op[]): Promise<Op[]>;
  applyEvent(event: UIEvent): Promise<UIEvent | null>;
  applyTheme(spec: unknown): Promise<unknown>;
  applyNode(node: Block): Promise<Block | null>;
  /** Synchronous variant used by the resolver. Async hooks are reported and skipped. */
  applyOpsSync(ops: Op[]): Op[];
  applyEventSync(event: UIEvent): UIEvent | null;
  applyThemeSync(spec: unknown): unknown;
  applyNodeSync(node: Block): Block | null;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof (value as { then?: unknown }).then === 'function';
}

/** Sort middleware by ascending priority, keeping registration order on ties. */
export function sortMiddleware(
  entries: Array<{ plugin?: string; priority?: number; value: MiddlewareDefinition }> | MiddlewareDefinition[],
): MiddlewareDefinition[] {
  const normalized: Array<{ definition: MiddlewareDefinition; order: number }> = entries.map((entry, order) => {
    if ('value' in entry) return { definition: entry.value, order };
    return { definition: entry as MiddlewareDefinition, order };
  });
  normalized.sort((a, b) => {
    const priority = (a.definition.priority ?? 100) - (b.definition.priority ?? 100);
    return priority !== 0 ? priority : a.order - b.order;
  });
  return normalized.map(entry => entry.definition);
}

export function createMiddlewarePipeline(
  middleware: MiddlewareDefinition[],
  options: MiddlewarePipelineOptions,
): MiddlewarePipeline {
  const sorted = sortMiddleware(middleware);
  const context: MiddlewareRuntimeContext = {
    registry: options.registry,
    direction: options.dir ?? 'ltr',
    locale: options.locale ?? 'en',
  };
  const errors: LibraryError[] = [];

  const report = (middlewareName: string, error: unknown) => {
    const err = createError(
      'middleware-error',
      `${middlewareName}: ${error instanceof Error ? error.message : String(error)}`,
    );
    errors.push(err);
    options.onError?.(err);
  };

  async function applyOpsAsync(ops: Op[]): Promise<Op[]> {
    let current = ops;
    for (const mw of sorted) {
      if (!mw.onOp) continue;
      const next: Op[] = [];
      for (const op of current) {
        try {
          const result = await mw.onOp(op, context);
          if (result === null) continue;
          if (Array.isArray(result)) next.push(...result);
          else next.push(result);
        } catch (error) {
          report(mw.name, error);
          next.push(op);
        }
      }
      current = next;
    }
    return current;
  }

  function applyOpsSync(ops: Op[]): Op[] {
    let current = ops;
    for (const mw of sorted) {
      if (!mw.onOp) continue;
      const next: Op[] = [];
      for (const op of current) {
        try {
          const result = mw.onOp(op, context);
          if (isPromiseLike(result)) {
            report(mw.name, new Error('async onOp is not supported by the synchronous board resolver'));
            next.push(op);
            continue;
          }
          if (result === null) continue;
          if (Array.isArray(result)) next.push(...result);
          else next.push(result);
        } catch (error) {
          report(mw.name, error);
          next.push(op);
        }
      }
      current = next;
    }
    return current;
  }

  async function applyEventAsync(event: UIEvent): Promise<UIEvent | null> {
    let current: UIEvent | null = event;
    for (const mw of sorted) {
      if (!mw.onEvent || current === null) continue;
      try {
        current = await mw.onEvent(current, context);
      } catch (error) {
        report(mw.name, error);
      }
    }
    return current;
  }

  function applyEventSync(event: UIEvent): UIEvent | null {
    let current: UIEvent | null = event;
    for (const mw of sorted) {
      if (!mw.onEvent || current === null) continue;
      try {
        const result = mw.onEvent(current, context);
        if (isPromiseLike(result)) {
          report(mw.name, new Error('async onEvent is not supported by the synchronous board resolver'));
          continue;
        }
        current = result;
      } catch (error) {
        report(mw.name, error);
      }
    }
    return current;
  }

  async function applyThemeAsync(spec: unknown): Promise<unknown> {
    let current = spec;
    for (const mw of sorted) {
      if (!mw.onThemeResolve) continue;
      try {
        current = await mw.onThemeResolve(current, context);
      } catch (error) {
        report(mw.name, error);
      }
    }
    return current;
  }

  function applyThemeSync(spec: unknown): unknown {
    let current = spec;
    for (const mw of sorted) {
      if (!mw.onThemeResolve) continue;
      try {
        const result = mw.onThemeResolve(current, context);
        if (isPromiseLike(result)) {
          report(mw.name, new Error('async onThemeResolve is not supported by the synchronous board resolver'));
          continue;
        }
        current = result;
      } catch (error) {
        report(mw.name, error);
      }
    }
    return current;
  }

  async function applyNodeAsync(node: Block): Promise<Block | null> {
    let current: Block | null = node;
    for (const mw of sorted) {
      if (!mw.onNodeResolve || current === null) continue;
      try {
        current = await mw.onNodeResolve(current, context);
      } catch (error) {
        report(mw.name, error);
      }
    }
    return current;
  }

  function applyNodeSync(node: Block): Block | null {
    let current: Block | null = node;
    for (const mw of sorted) {
      if (!mw.onNodeResolve || current === null) continue;
      try {
        const result = mw.onNodeResolve(current, context);
        if (isPromiseLike(result)) {
          report(mw.name, new Error('async onNodeResolve is not supported by the synchronous board resolver'));
          continue;
        }
        current = result;
      } catch (error) {
        report(mw.name, error);
      }
    }
    return current;
  }

  return {
    middleware: sorted,
    applyOps: applyOpsAsync,
    applyEvent: applyEventAsync,
    applyTheme: applyThemeAsync,
    applyNode: applyNodeAsync,
    applyOpsSync,
    applyEventSync,
    applyThemeSync,
    applyNodeSync,
  };
}
