import { z } from 'zod';

export const NodeIdSchema = z.string().min(1).max(64);
export type NodeId = z.infer<typeof NodeIdSchema>;

export const NodeRefSchema = z.string();
export type NodeRef = z.infer<typeof NodeRefSchema>;
