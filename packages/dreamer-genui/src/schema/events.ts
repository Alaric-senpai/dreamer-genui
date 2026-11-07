import { z } from 'zod';

export const UIEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('focus'),
    nodeId: z.string(),
    ref: z.string().optional(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal('select'),
    nodeId: z.string(),
    ref: z.string().optional(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal('answer'),
    nodeId: z.string(),
    value: z.union([z.string(), z.array(z.string())]),
  }),
  z.object({
    type: z.literal('action'),
    nodeId: z.string().optional(),
    action: z.union([
      z.enum(['return', 'continue', 'hint']),
      z.string(),
    ]),
  }),
]);

export type UIEvent = z.infer<typeof UIEventSchema>;
