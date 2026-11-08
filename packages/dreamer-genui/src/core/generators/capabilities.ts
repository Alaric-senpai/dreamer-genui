import { createRegistry, type Registry } from '../registry';
import { FigureSchema } from '../../schema/figures';

// Derive figure kinds from the canonical FigureSchema so the capability list
// can never drift from the schema.
type FigureMember = { shape: { kind: { value: string } } };
const FIGURE_KINDS: string[] = (FigureSchema as unknown as { options: FigureMember[] })
  .options.map(m => m.shape.kind.value);

/** Extend registry types with figure kinds (figure.image, figure.tree, ...). */
export function getCapabilities(registry: Registry): string[] {
  const caps: string[] = [...registry.getCapabilities()];
  for (const kind of FIGURE_KINDS) {
    caps.push(`figure.${kind}`);
  }
  return caps;
}

/** Default capabilities using the built-ins registry. */
export function getDefaultCapabilities(): string[] {
  return getCapabilities(createRegistry());
}

