// Schema package — server-safe, no React imports
// All exports are pure Zod schemas and derived types

export * from './common';
export * from './node';
export * from './layout';
export * from './envelope';
export * from './ops';
export * from './blocks';
export * from './inline';
export * from './figures';
export * from './model';
export * from './connector';
export * from './question';
export * from './assessment';
export * from './motion';
export * from './theme';
export * from './events';
export * from './errors';
export { schemaToJsonSchema } from './json-schema';

// Generators (server-safe, no React) — full implementations in M2 core package
export type { Reply, Version } from './envelope';
export type { Op, AppendOp, AttachOp, ReplaceOp, UpdateOp, RemoveOp, ThemeOp, CameraOp, CameraMove as CameraMoveSpec, CameraTarget, LayoutOp } from './ops';
export type { Block, CoreBlock, NodeBase } from './blocks';
export type { Inline, Mark } from './inline';
export type { Figure, FigureKind } from './figures';
export type { Enter, EnterEffect, Emphasis, Exit, ColorToken, MotionFields, Trigger, EaseName } from './motion';
export type { ThemeSpec, ThemeTokens, AmbienceSpec, DensityTokens, ComponentTokens } from './theme';
export type { UIEvent, CoreUIEvent, NamespacedUIEvent } from './events';
export type { QuestionBlock, QuestionKind, AnswerValue } from './question';
export type { AssessmentBlock, AssessmentState, AssessmentMode } from './assessment';
export type { LayoutSpec, LayoutKind, Slot, Gap, Ratio } from './layout';
export type { Model3DFigure, Scene3DFigure, ModelManifest, ModelSummary, ModelQuery, PartId, ViewRef } from './model';
export type { ModelConnector, ConnectorContext } from './connector';
