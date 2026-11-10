/** React renderer surface (M3). */
export { DreamerProvider, useDreamer, useEmitEvent, defaultStrings } from './provider';
export type { DreamerProviderProps, DreamerContextValue, UIStrings } from './provider';
export { Board } from './board';
export type { BoardProps } from './board';
export { createBoardStore, useBoard, useBoardVersion } from './use-board';
export type { BoardStore } from './use-board';
export { MotionProvider, Animated } from './motion/animated';
export { createMotionDriver, createReducedMotionDriver, STAGGER_SECONDS } from './motion/driver';
export type { MotionDriver, MotionAnimation } from './motion/driver';
export { renderInline } from './components/inline';
export { NodeView, FallbackView } from './components/block-renderer';
export { TextBlockView, ChoicesView, CalloutView, StepsView, GroupView } from './components/blocks';
export { resolveTheme, tokensToVars, DEFAULT_VARS, namedPresets } from '../theme/tokens';
export type { CssTokens, ThemeName } from '../theme/tokens';
export { KineticText } from './kinetic/KineticText';
export { splitIntoParts, joinParts } from './kinetic/split';
export type { SplitMode, SplitPart } from './kinetic/split';
export { TempoContext, useTempo } from './motion/tempo';
export {
  EASE,
  ENTER_PRESETS,
  EMPHASIS_PRESETS,
  EXIT_PRESETS,
  KINETIC_PRESETS,
  DEFAULT_TEXT_ENTER,
  applyTempo,
  ORDER_STEP_MS,
} from '../motion/presets';
export type { EnterPreset, EmphasisPreset, ExitPreset, KineticPreset, KineticEffect } from '../motion/presets';
