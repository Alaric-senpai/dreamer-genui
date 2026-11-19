import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createHttpModelConnector,
  createStaticModelConnector,
  withModelCache,
} from '../../packages/dreamer-genui/src/connectors';
import type { ConnectorContext, ModelConnector } from '../../packages/dreamer-genui/src/schema/connector';
import type { ModelManifest } from '../../packages/dreamer-genui/src/schema/model';

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures/model-manifest.json'), 'utf8'),
) as ModelManifest;

const context = (): ConnectorContext => ({ signal: new AbortController().signal, locale: 'en' });

describe('static model connector', () => {
  test('serves manifests, maps host shapes and resolves assets without network', async () => {
    const connector = createStaticModelConnector(
      { assembly: manifest },
      (_modelId, ref) => `https://assets.example/${String(ref)}`,
      { id: 'demo' },
    );
    const raw = await connector.getManifest('assembly', context());
    expect(raw).toMatchObject({ id: 'assembly', title: 'Demo assembly' });
    expect(await connector.getManifest('ghost', context())).toBeUndefined();
    expect(await connector.getAsset('assembly', 'models/assembly.glb', context())).toBe(
      'https://assets.example/models/assembly.glb',
    );
    const results = await connector.search?.({ text: 'mechanical' }, context());
    expect(results?.[0]?.parts.map((part) => part.id)).toEqual(
      expect.arrayContaining(['housing', 'rotor']),
    );
  });

  test('applies the host map adapter before validation', async () => {
    const connector = createStaticModelConnector(
      {
        assembly: {
          model_uuid: 'assembly',
          display_name: 'Demo assembly',
          mesh: 'models/assembly.glb',
        },
      },
      () => 'https://assets.example/assembly.glb',
      {
        id: 'platform',
        map: raw => ({
          id: (raw as { model_uuid: string }).model_uuid,
          version: '1.0.0',
          title: (raw as { display_name: string }).display_name,
          conventions: { upAxis: 'y', frontAxis: '+z', unit: 'm' },
          assets: { model: (raw as { mesh: string }).mesh },
          parts: { body: { label: 'Body', nodes: ['Body_Mesh'] } },
        }),
      },
    );
    expect(await connector.getManifest('assembly', context())).toMatchObject({
      id: 'assembly',
      parts: { body: { label: 'Body' } },
    });
  });
});

function manifestResponse(): Response {
  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('HTTP model connector', () => {
  test('reads the standard endpoints and maps errors to library codes', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/models/assembly/manifest')) return manifestResponse();
      if (url.endsWith('/models/assembly/version')) {
        return new Response(JSON.stringify({ version: '1.0.0' }), { status: 200 });
      }
      if (url.endsWith('/models/search?text=assembly')) {
        return new Response(JSON.stringify({ models: [{ id: 'assembly' }] }), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch;
    const connector = createHttpModelConnector({
      id: 'http',
      baseUrl: 'https://registry.example',
      fetch: fakeFetch,
    });

    expect(await connector.getManifest('assembly', context())).toMatchObject({ id: 'assembly' });
    await expect(connector.getManifest('ghost', context())).rejects.toMatchObject({
      code: 'model-not-found',
    });
    expect(calls[0]).toBe('https://registry.example/models/assembly/manifest');
    expect(await connector.getVersion?.('assembly', context())).toBe('1.0.0');
  });

  test('rejects asset origins outside the allowlist', async () => {
    const connector = createHttpModelConnector({
      id: 'http',
      baseUrl: 'https://registry.example',
      assetUrl: () => 'https://evil.example/assembly.glb',
      allowedOrigins: ['https://cdn.example'],
      fetch: (async () => manifestResponse()) as typeof fetch,
    });
    await expect(
      connector.getAsset('assembly', 'models/assembly.glb', context()),
    ).rejects.toMatchObject({ code: 'connector-error' });
  });

  test('refreshes an expired signed URL once and returns cached bytes', async () => {
    let refresh = 0;
    const calls: string[] = [];
    const fakeFetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      if (calls.length === 1) return new Response('expired', { status: 403 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;
    const connector = createHttpModelConnector({
      id: 'http',
      baseUrl: 'https://registry.example',
      fetchAssets: true,
      fetch: fakeFetch,
      allowedOrigins: ['https://cdn.example'],
      assetUrl: () => `https://cdn.example/assembly.glb?sig=${++refresh}`,
    });

    const asset = await connector.getAsset('assembly', 'models/assembly.glb', context());
    expect(asset).toBeInstanceOf(Blob);
    expect(calls).toEqual([
      'https://cdn.example/assembly.glb?sig=1',
      'https://cdn.example/assembly.glb?sig=2',
    ]);
  });
});

describe('model cache', () => {
  test('serves the last known manifest and bytes when the network fails', async () => {
    let offline = false;
    const inner: ModelConnector = {
      id: 'platform',
      async getManifest() {
        if (offline) throw new Error('offline');
        return manifest;
      },
      async getAsset() {
        if (offline) throw new Error('offline');
        return new Uint8Array([4, 5, 6]).buffer;
      },
      async getVersion() {
        if (offline) throw new Error('offline');
        return '1.0.0';
      },
    };
    const cached = withModelCache(inner, { name: 'dg-test-cache' });

    expect(await cached.getManifest('assembly', context())).toMatchObject({ id: 'assembly' });
    const first = await cached.getAsset('assembly', 'models/assembly.glb', context());
    expect(first).toBeInstanceOf(ArrayBuffer);

    offline = true;
    expect(await cached.getManifest('assembly', context())).toMatchObject({ id: 'assembly' });
    const second = await cached.getAsset('assembly', 'models/assembly.glb', context());
    expect(second).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(second as ArrayBuffer)).toEqual(new Uint8Array([4, 5, 6]));
  });
});
