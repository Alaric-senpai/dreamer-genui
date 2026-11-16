'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { BoardStore } from './use-board';

/** Lifecycle of the tutor/voice pipeline shown by the board status pill (§7.5). */
export type BoardStatus = 'idle' | 'thinking' | 'listening' | 'speaking';

/** The board store in scope for headless hooks and devtools (§8.7). */
export const BoardStoreContext = createContext<BoardStore | null>(null);

/** Current board status, provided by `<Board status>` or a headless host. */
export const BoardStatusContext = createContext<BoardStatus>('idle');

export interface BoardStoreProviderProps {
  store: BoardStore;
  /** Optional status for `useBoardStatus()` when no `<Board>` is rendered. */
  status?: BoardStatus;
  children: ReactNode;
}

/**
 * Provide a board store to headless hooks. `<Board>` installs this
 * automatically, so hosts only need it when they render their own UI.
 */
export function BoardStoreProvider({ store, status = 'idle', children }: BoardStoreProviderProps): ReactNode {
  return (
    <BoardStoreContext.Provider value={store}>
      <BoardStatusContext.Provider value={status}>{children}</BoardStatusContext.Provider>
    </BoardStoreContext.Provider>
  );
}

/** The active board store. Throws when used outside `<Board>`/`BoardStoreProvider`. */
export function useBoardStore(): BoardStore {
  const store = useContext(BoardStoreContext);
  if (!store) {
    throw new Error('dreamer-genui: useBoardStore must be used inside <Board> or <BoardStoreProvider>');
  }
  return store;
}

/** The current board lifecycle status (`idle` outside a board). */
export function useBoardStatus(): BoardStatus {
  return useContext(BoardStatusContext);
}
