import { z } from 'zod';

export const ColorTokenSchema = z.enum(['accent', 'info', 'success', 'warn', 'danger', 'muted']);
export type ColorToken = z.infer<typeof ColorTokenSchema>;
