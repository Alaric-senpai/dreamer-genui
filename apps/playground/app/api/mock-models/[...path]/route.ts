/**
 * Mock model registry for the M5b playground route (§6.16).
 *
 * Serves the standard `ModelManifest` plus binary assets so the HTTP reference
 * connector can be exercised without asking the library to host anything.
 * Special ids demos: `overbudget` (budget error) and `malformed` (connector
 * error); everything else follows the default registry shape.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ModelManifest } from 'dreamer-genui/schema';

const FIXTURES = path.join(process.cwd(), '..', '..', 'fixtures');
const MANIFEST = path.join(FIXTURES, 'model-manifest.json');
const MODELS = path.join(FIXTURES, 'models');

const ASSET_TYPES: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function readManifest(): Promise<ModelManifest> {
  return JSON.parse(await readFile(MANIFEST, 'utf8')) as ModelManifest;
}

function summary(manifest: ModelManifest) {
  return {
    id: manifest.id,
    title: manifest.title,
    tags: manifest.tags,
    description: manifest.description,
    parts: Object.entries(manifest.parts).map(([id, part]) => ({
      id,
      label: part.label,
      group: part.group,
    })),
    views: Object.keys(manifest.views ?? {}),
    animations: Object.keys(manifest.animations ?? {}),
    paths: Object.keys(manifest.paths ?? {}),
    cutaways: Object.keys(manifest.cutaways ?? {}),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path: segments = [] } = await params;
  const url = new URL(request.url);

  /* Discovery: /models/search?text=&tags=&limit= */
  if (segments[0] === 'models' && segments[1] === 'search') {
    const manifest = await readManifest();
    const text = url.searchParams.get('text')?.toLowerCase();
    const tags = url.searchParams.get('tags')?.split(',').filter(Boolean) ?? [];
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const matches = [summary(manifest)].filter((model) => {
      if (tags.length && !tags.some((tag) => model.tags?.includes(tag))) return false;
      if (text) {
        const haystack = `${model.id} ${model.title} ${model.description ?? ''} ${model.tags?.join(' ') ?? ''}`;
        if (!haystack.toLowerCase().includes(text)) return false;
      }
      return true;
    });
    return json({ models: matches.slice(0, Number.isFinite(limit) ? limit : 20) });
  }

  /* Manifest: /models/:id/manifest */
  if (segments[0] === 'models' && segments[2] === 'manifest') {
    const id = decodeURIComponent(segments[1] ?? '');
    if (id === 'malformed' || id === 'broken-manifest') {
      return json({ id: 42, title: false, parts: 'not-an-object' });
    }
    const manifest = await readManifest();
    if (id === 'overbudget') {
      return json({ ...manifest, id: 'overbudget', assets: { ...manifest.assets, sizeBytes: 9_000_000 } });
    }
    if (id !== manifest.id) return json({ error: 'model-not-found', id }, 404);
    return json(manifest);
  }

  /* Version: /models/:id/version */
  if (segments[0] === 'models' && segments[2] === 'version') {
    const manifest = await readManifest();
    return json({ version: manifest.version });
  }

  /* Assets: /models/<file> (the default `assetUrl` join) */
  if (segments[0] === 'models' && segments.length === 2) {
    const file = path.basename(decodeURIComponent(segments[1] ?? ''));
    const type = ASSET_TYPES[path.extname(file).toLowerCase()];
    if (!type) return json({ error: 'unsupported-asset', file }, 415);
    try {
      const bytes = await readFile(path.join(MODELS, file));
      return new Response(new Blob([new Uint8Array(bytes)]), {
        headers: {
          'content-type': type,
          'cache-control': 'public, max-age=60',
        },
      });
    } catch {
      return json({ error: 'model-not-found', file }, 404);
    }
  }

  return json({ error: 'not-found', path: segments }, 404);
}
