// Schema package — server-safe, no React imports
// All exports are pure Zod schemas and derived types

export * from './common';
export * from './envelope';
export * from './ops';
export * from './blocks';
export * from './inline';
export * from './figures';
export * from './motion';
export * from './events';
export * from './errors';
export { schemaToJsonSchema } from './json-schema';

// Generators (server-safe, no React) — full implementations in M2 core package
export type { Reply, Version } from './envelope';
export type { Op, AppendOp, AttachOp, ReplaceOp, UpdateOp, RemoveOp } from './ops';
export type { Block, NodeBase } from './blocks';
export type { Inline, Mark } from './inline';
export type { Figure } from './figures';
export type { Enter, Emphasis, Exit, ColorToken, MotionFields } from './motion';
export type { UIEvent } from './events';
