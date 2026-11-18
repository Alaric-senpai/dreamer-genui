import type { z } from 'zod';
import { createRegistry, type Registry } from '../registry';
import { FigureSchema } from '../../schema/figures';
import { QuestionBlockSchema } from '../../schema/question';
import { EnterEffectsSchema, EmphasisSchema, ExitSchema, EaseNameSchema } from '../../schema/motion';

// Derive lists from the canonical schemas so the capability lists can never
// drift from the protocol.
type EnumMember = { shape: { kind: { value: string } } };
const FIGURE_KINDS: string[] = (FigureSchema as unknown as { options: EnumMember[] })
  .options.map(m => m.shape.kind.value);
const QUESTION_KINDS: string[] = (QuestionBlockSchema as unknown as { options: EnumMember[] })
  .options.map(m => m.shape.kind.value);

function enumOptions(schema: z.ZodEnum<[string, ...string[]]>): string[] {
  return (schema as unknown as { options: string[] }).options;
}

const ENTER_EFFECTS = enumOptions(EnterEffectsSchema);

/**
 * Registry-aware capabilities (§10.4): block types, figure kinds, question
 * kinds, effects, easings, layouts, moods, ambience, surfaces and connector
 * support. `model3d` is advertised only when at least one model connector is
 * registered (§6.16); `scene3d` needs no registry.
 */
export function getCapabilities(registry: Registry): string[] {
  const caps: string[] = [...registry.getCapabilities()];
  const hasConnectors = registry.listModelConnectors().length > 0;

  for (const kind of FIGURE_KINDS) {
    if (kind === 'model3d' && !hasConnectors) continue;
    caps.push(`figure.${kind}`);
  }
  if (registry.get('blocks', 'question')) {
    for (const kind of QUESTION_KINDS) caps.push(`question.${kind}`);
  }
  for (const entry of registry.list('layouts')) {
    if (!entry.disabled) caps.push(`layout.${entry.name}`);
  }
  for (const entry of registry.list('transitions')) {
    if (!entry.disabled) caps.push(`transition.${entry.name}`);
  }
  for (const e of ENTER_EFFECTS) caps.push(`enter.${e}`);
  for (const e of enumOptions(EmphasisSchema.shape.effect)) caps.push(`emphasis.${e}`);
  for (const e of enumOptions(ExitSchema.shape.effect)) caps.push(`exit.${e}`);
  for (const e of enumOptions(EaseNameSchema)) caps.push(`ease.${e}`);
  for (const m of registry.listMoods()) caps.push(`mood.${m.name}`);
  for (const a of registry.listAmbience()) caps.push(`ambience.${a.name}`);
  for (const s of registry.listSurfaces()) caps.push(`surface.${s.name}`);
  if (hasConnectors) caps.push('model.connectors');
  for (const locale of registry.list('strings').filter(entry => !entry.disabled).map(entry => entry.name)) {
    caps.push(`strings.${locale}`);
  }
  for (const profile of registry.list('profiles').filter(entry => !entry.disabled).map(entry => entry.name)) {
    caps.push(`profile.${profile}`);
  }
  return caps;
}

/** Default capabilities using the built-ins registry. */
export function getDefaultCapabilities(): string[] {
  return getCapabilities(createRegistry());
}
