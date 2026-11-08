// Re-export the protocol types so hosts depending only on `dreamer-genui/core`
// can type ops and blocks without importing the schema package directly.
export type { Op, AppendOp, AttachOp, ReplaceOp, UpdateOp, RemoveOp } from '../schema/ops';
export type { Block } from '../schema/blocks';
export type { UIEvent } from '../schema/events';
export type { ErrorCode } from '../schema/errors';

export * from './types';
export * from './errors';
export * from './events';
export * from './registry';
export * from './validator';
export * from './reducer';
export * from './resolver';
export * from './generators';
