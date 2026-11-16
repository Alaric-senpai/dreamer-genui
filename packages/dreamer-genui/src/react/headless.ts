'use client';

import { useBoardVersion } from './use-board';
import { useDreamer } from './provider';
import { useBoardStatus, useBoardStore } from './store-context';
import type { BoardStatus } from './store-context';
import type { Node } from '../core/types';
import type { EntryPlan, Pacing } from '../core/cues';
import { defaultPacing } from '../core/cues';
import type { AssessmentMachine } from '../core/assessment';
import type { AssessmentState } from '../schema/assessment';
import type { Registry } from '../core/registry';

export { useBoardStore, useBoardStatus };
export type { BoardStatus };

/** One node by id, or undefined when it is not on the board. */
export function useNode(id: string): Node | undefined {
  const store = useBoardStore();
  useBoardVersion(store);
  return store.getState().nodes[id];
}

/** The current entry plan for a node: entered, pending, or not on the board. */
export interface NodeEnterState {
  entered: boolean;
  pending: boolean;
  /** Full plan, useful for progress dots and skip affordances. */
  plan: EntryPlan;
}

/**
 * Entry state of one node (headless equivalent of the board's entry gates).
 * Pass the board's pacing when it is not the default (`cued` when any node
 * uses cue triggers, else `auto`).
 */
export function useNodeEnter(id: string, pacing?: Pacing): NodeEnterState {
  const store = useBoardStore();
  useBoardVersion(store);
  const plan = store.getEntry(pacing ?? defaultPacing(store.getState()));
  return {
    entered: plan.entered.includes(id),
    pending: plan.pending.includes(id),
    plan,
  };
}

/** Cue state and controls for a custom board UI (§6.3). */
export interface UseCueResult {
  /** Cue ids fired on this board. */
  fired: string[];
  /** Cue ids referenced by pending nodes and not yet fired. */
  pending: string[];
  fire(cueId: string): void;
  flush(): void;
  seek(cueId: string): void;
}

export function useCue(): UseCueResult {
  const store = useBoardStore();
  useBoardVersion(store);
  const state = store.getState();
  const plan = store.getEntry(defaultPacing(state));
  const { cue, flush, seek } = store;
  return {
    fired: state.firedCues,
    pending: plan.pendingCues,
    fire: cue,
    flush,
    seek,
  };
}

/** The resolved board theme, or undefined before any theme has been set. */
export function useTheme() {
  const store = useBoardStore();
  useBoardVersion(store);
  return store.getState().theme;
}

/** The current board layout spec (§6.4). */
export function useLayout() {
  const store = useBoardStore();
  useBoardVersion(store);
  return store.getState().layout;
}

/** Assessment state plus its headless machine, if the node is an assessment. */
export interface UseAssessmentResult {
  state: AssessmentState | undefined;
  machine: AssessmentMachine | undefined;
}

export function useAssessment(id: string): UseAssessmentResult {
  const store = useBoardStore();
  useBoardVersion(store);
  const state = store.getState().assessments[id];
  const machine = store.assessments.get(id);
  return { state, machine };
}

/** The provider registry (types, effects, layouts, plugins...). */
export function useRegistry(): Registry {
  return useDreamer().registry;
}
