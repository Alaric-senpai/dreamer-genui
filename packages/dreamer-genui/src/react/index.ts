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
export { lightTheme, darkTheme, resolveTheme, TOKEN_KEYS } from '../theme/tokens';
export type { CssTokens, ThemeName } from '../theme/tokens';
