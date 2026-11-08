import type { ZodType } from 'zod';
import { createError } from './errors';
import type { LibraryError, ResolvedNode } from './types';
import {
  TextBlockSchema,
  FigureBlockSchema,
  ChoicesBlockSchema,
  StepsBlockSchema,
  CalloutBlockSchema,
  GroupBlockSchema,
  TableBlockSchema,
  MathBlockSchema,
  CodeBlockSchema,
} from '../schema/blocks';

export interface TypeManifest {
  schema: ZodType;
  promptGuide?: string;
  fallback?: string;
}

export interface Plugin {
  name: string;
  version: string;
  types: Record<string, TypeManifest>;
}

export interface Registry {
  /** All registered plugins (including built-ins). */
  plugins: Map<string, Plugin>;

  /** Get the TypeManifest for a block type, or undefined if unknown. */
  getManifest(type: string): TypeManifest | undefined;

  /** Register a lazy loader for a block type. */
  registerLoader(type: string, loader: () => unknown): void;

  /** Get the loader for a block type. */
  getLoader(type: string): (() => unknown) | undefined;

  /** Validate props against the type's schema; return resolved node. */
  resolve(type: string, props: unknown): ResolvedNode;

  /** List all registered block types. */
  getCapabilities(): string[];
}

export interface RegistryOptions {
  onError?: (err: LibraryError) => void;
}

// Built-in type manifests. Schemas are the CANONICAL per-type schemas from
// schema/blocks.ts (single source of truth — the registry never re-derives or
// loosens them). Loaders are added in M3 when the React renderer is built.
// promptGuide snippets are the minimal tutor-facing hint per type.
const BUILTIN_MANIFESTS: Record<string, TypeManifest> = {
  text: { schema: TextBlockSchema, promptGuide: 'text block: variant (body|definition|heading|note), content is Inline[] array.' },
  figure: { schema: FigureBlockSchema, promptGuide: 'figure block: figure.kind (image|icon|diagram|labeled|chart|lottie), alt required.' },
  choices: { schema: ChoicesBlockSchema, promptGuide: 'choices block: items array with {id, label}. intent=navigate emits select; intent=answer emits answer.' },
  steps: { schema: StepsBlockSchema, promptGuide: 'steps block: items array with {id, title, content: Inline[]}. reveal=sequential reveals one at a time.' },
  callout: { schema: CalloutBlockSchema, promptGuide: 'callout block: tone (info|success|warn|danger), content: Inline[].' },
  group: { schema: GroupBlockSchema, promptGuide: 'group block: layout (stack|row|grid), blocks: Block[].' },
  table: { schema: TableBlockSchema, promptGuide: 'table block: columns: {id, label}[], rows: {colId: Inline[]}[]' },
  math: { schema: MathBlockSchema, promptGuide: 'math block: tex is a KaTeX-compatible string. Use \\ce{} for chemical equations.' },
  code: { schema: CodeBlockSchema, promptGuide: 'code block: lang (python|javascript|etc.), source is the code string.' },
};

export function createRegistry(options: RegistryOptions = {}): Registry {
  const plugins = new Map<string, Plugin>();
  const loaders = new Map<string, () => unknown>();

  // Register built-in manifests
  for (const [type, manifest] of Object.entries(BUILTIN_MANIFESTS)) {
    plugins.set(type, { name: type, version: '1.0.0', types: { [type]: manifest } });
  }

  function getManifest(type: string): TypeManifest | undefined {
    return plugins.get(type)?.types[type];
  }

  function registerLoader(type: string, loader: () => unknown): void {
    loaders.set(type, loader);
  }

  function getLoader(type: string): (() => unknown) | undefined {
    return loaders.get(type);
  }

  function resolve(type: string, props: unknown): ResolvedNode {
    const manifest = getManifest(type);
    if (!manifest) {
      const err = createError('unknown-type', `Unknown block type: ${type}`, (props as { id?: string }).id, type);
      options.onError?.(err);
      return { valid: false, error: err };
    }

    const parseResult = manifest.schema.safeParse(props);
    if (!parseResult.success) {
      const err = createError('invalid-node', parseResult.error.message, (props as { id?: string }).id, type);
      options.onError?.(err);
      return { valid: false, error: err };
    }

    const loader = getLoader(type);
    return { valid: true, manifest, loader };
  }

  function getCapabilities(): string[] {
    return Array.from(plugins.keys());
  }

  return { plugins, getManifest, registerLoader, getLoader, resolve, getCapabilities };
}
