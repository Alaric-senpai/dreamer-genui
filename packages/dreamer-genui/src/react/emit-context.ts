import { createContext } from 'react';
import type { UIEvent } from '../schema/events';
import type { LibraryError } from '../core/types';

/**
 * Board-local emitter: provided by <Board>, consumed by interactive
 * components. Emitting here routes the event onto the board store's
 * `events` bus, which <Board> bridges to the host-facing sinks. Falls
 * back to the provider sink when components render without a <Board>.
 */
export const BoardEmitContext = createContext<((event: UIEvent) => void) | null>(null);

/**
 * Board-local error reporter: per-node error boundaries report here so the
 * failure reaches both the board and provider `onError` sinks. Falls back to
 * the provider sink when a component renders without a <Board>.
 */
export const BoardErrorContext = createContext<((error: LibraryError) => void) | null>(null);
