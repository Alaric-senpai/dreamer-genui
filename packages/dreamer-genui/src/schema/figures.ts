import { z } from 'zod';

export const FigureSchema = z.object({ kind: z.string() });
