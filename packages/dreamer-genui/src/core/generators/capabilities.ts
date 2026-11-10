import type { z } from 'zod';
import { createRegistry, type Registry } from '../registry';
import { FigureSchema } from '../../schema/figures';
import { EnterEffectsSchema, EmphasisSchema, ExitSchema, EaseNameSchema } from '../../schema/motion';

// Derive lists from the canonical schemas so the capability lists can never
// drift from the protocol.
type EnumMember = { shape: { kind: { value: string } } };
const FIGURE_KINDS: string[] = (FigureSchema as unknown as { options: EnumMember[] })
  .options.map(m => m.shape.kind.value);

function enumOptions(schema: z.ZodEnum<[string, ...string[]]>): string[] {
  return (schema as unknown as { options: string[] }).options;
}

const ENTER_EFFECTS = enumOptions(EnterEffectsSchema);

/** Registry-aware capabilities (§8.4): types, figure kinds, effects, easings, moods, ambience, surfaces. */
export function getCapabilities(registry: Registry): string[] {
  const caps: string[] = [...registry.getCapabilities()];
  for (const kind of FIGURE_KINDS) caps.push(`figure.${kind}`);
  for (const e of ENTER_EFFECTS) caps.push(`enter.${e}`);
  for (const e of enumOptions(EmphasisSchema.shape.effect)) caps.push(`emphasis.${e}`);
  for (const e of enumOptions(ExitSchema.shape.effect)) caps.push(`exit.${e}`);
  for (const e of enumOptions(EaseNameSchema)) caps.push(`ease.${e}`);
  for (const m of registry.listMoods()) caps.push(`mood.${m.name}`);
  for (const a of registry.listAmbience()) caps.push(`ambience.${a.name}`);
  for (const s of registry.listSurfaces()) caps.push(`surface.${s.name}`);
  return caps;
}

/** Default capabilities using the built-ins registry. */
export function getDefaultCapabilities(): string[] {
  return getCapabilities(createRegistry());
}
