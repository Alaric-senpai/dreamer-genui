import { createContext } from 'react';
import type { UIEvent } from '../schema/events';

/**
 * Board-local emitter: provided by <Board>, consumed by interactive
 * components. Emitting here routes the event onto the board store's
 * `events` bus, which <Board> bridges to the host-facing sinks. Falls
 * back to the provider sink when components render without a <Board>.
 */
export const BoardEmitContext = createContext<((event: UIEvent) => void) | null>(null);
