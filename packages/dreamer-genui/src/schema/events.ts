import { z } from 'zod';

export const UIEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('focus'), nodeId: z.string() }),
  z.object({ type: z.literal('select'), nodeId: z.string() }),
  z.object({ type: z.literal('answer'), nodeId: z.string(), value: z.string() }),
  z.object({ type: z.literal('action'), nodeId: z.string().optional(), action: z.string() }),
]);
