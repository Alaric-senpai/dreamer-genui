#!/usr/bin/env node
/**
 * dg:model-check — verify a glTF binary against a `ModelManifest` (§6.16).
 *
 * Usage:
 *   node tools/model-check.mjs <model.glb> <manifest.json> [--max-bytes N] [--max-triangles N]
 *
 * Dependency-free on purpose: CI and model authors can run it without the
 * library installed. It parses the GLB container and checks that every
 * manifest part names a real node or mesh, that the conventions match, and
 * that the advertised budgets hold.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a;

function usage() {
  console.error('usage: node tools/model-check.mjs <model.glb> <manifest.json> [--max-bytes N] [--max-triangles N]');
  process.exit(2);
}

function readArgs(argv) {
  const positional = [];
  const options = { maxBytes: 2_000_000, maxTriangles: 50_000 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--max-bytes') options.maxBytes = Number(argv[++i]);
    else if (arg === '--max-triangles') options.maxTriangles = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') usage();
    else positional.push(arg);
  }
  if (positional.length !== 2) usage();
  return { modelPath: positional[0], manifestPath: positional[1], options };
}

function parseGlb(buffer, file) {
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error(`${file}: not a glTF binary (bad magic)`);
  }
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw new Error(`${file}: unsupported glTF version ${version}`);
  const total = buffer.readUInt32LE(8);
  if (total > buffer.length) throw new Error(`${file}: truncated GLB (header ${total} > file ${buffer.length})`);

  let offset = 12;
  let json;
  while (offset + 8 <= total) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > buffer.length) throw new Error(`${file}: truncated chunk`);
    if (type === JSON_CHUNK) {
      json = JSON.parse(buffer.toString('utf8', start, end));
    }
    offset = end + ((4 - (length % 4)) % 4);
  }
  if (!json) throw new Error(`${file}: no JSON chunk`);
  return json;
}

function triangleCount(gltf) {
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const indices = primitive.indices !== undefined ? gltf.accessors?.[primitive.indices] : undefined;
      const position = primitive.attributes?.POSITION !== undefined
        ? gltf.accessors?.[primitive.attributes.POSITION]
        : undefined;
      const count = indices?.count ?? position?.count ?? 0;
      const mode = primitive.mode ?? 4; // TRIANGLES
      if (mode === 4) triangles += Math.floor(count / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
    }
  }
  return triangles;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkManifest(manifest) {
  const errors = [];
  const warnings = [];
  if (!isRecord(manifest)) return { errors: ['manifest must be a JSON object'], warnings };

  if (typeof manifest.id !== 'string' || !manifest.id) errors.push('manifest.id must be a non-empty string');
  if (typeof manifest.version !== 'string' || !manifest.version) errors.push('manifest.version must be a non-empty string');
  if (typeof manifest.title !== 'string' || !manifest.title) errors.push('manifest.title must be a non-empty string');

  const conventions = manifest.conventions;
  if (!isRecord(conventions)) errors.push('manifest.conventions is required');
  else {
    if (conventions.upAxis !== 'y') errors.push('conventions.upAxis must be "y"');
    if (conventions.frontAxis !== '+z') errors.push('conventions.frontAxis must be "+z"');
    if (conventions.unit !== 'm' && conventions.unit !== 'normalized') {
      errors.push('conventions.unit must be "m" or "normalized"');
    }
  }

  if (!isRecord(manifest.assets)) errors.push('manifest.assets is required');
  else if (typeof manifest.assets.model !== 'string' && !isRecord(manifest.assets.model)) {
    errors.push('assets.model must be a URL string or { connectorAsset }');
  }

  if (!isRecord(manifest.parts) || Object.keys(manifest.parts).length === 0) {
    errors.push('manifest.parts must be a non-empty record');
  } else {
    for (const [id, part] of Object.entries(manifest.parts)) {
      if (!isRecord(part)) {
        errors.push(`parts.${id} must be an object`);
        continue;
      }
      if (typeof part.label !== 'string' || !part.label) errors.push(`parts.${id}.label is required`);
      if (!Array.isArray(part.nodes) || part.nodes.length === 0) {
        errors.push(`parts.${id}.nodes must list at least one node/mesh name`);
      }
    }
  }

  for (const group of Object.keys(manifest.groups ?? {})) {
    const members = manifest.groups[group]?.parts;
    if (!Array.isArray(members)) {
      errors.push(`groups.${group}.parts must be an array`);
      continue;
    }
    for (const part of members) {
      if (!manifest.parts?.[part]) warnings.push(`groups.${group} references unknown part "${part}"`);
    }
  }

  return { errors, warnings };
}

async function main() {
  const { modelPath, manifestPath, options } = readArgs(process.argv.slice(2));
  const [modelBuffer, manifestText] = await Promise.all([
    readFile(modelPath),
    readFile(manifestPath, 'utf8'),
  ]);
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    console.error(`✗ ${manifestPath}: invalid JSON (${error.message})`);
    process.exit(1);
  }

  let gltf;
  try {
    gltf = parseGlb(modelBuffer, modelPath);
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }

  const { errors, warnings } = checkManifest(manifest);
  const names = new Set();
  for (const node of gltf.nodes ?? []) if (node?.name) names.add(node.name);
  for (const mesh of gltf.meshes ?? []) if (mesh?.name) names.add(mesh.name);

  if (isRecord(manifest.parts)) {
    for (const [id, part] of Object.entries(manifest.parts)) {
      for (const nodeName of part?.nodes ?? []) {
        if (!names.has(nodeName)) errors.push(`parts.${id} names "${nodeName}", which is not a node or mesh in ${path.basename(modelPath)}`);
      }
    }
  }

  const size = modelBuffer.byteLength;
  const triangles = triangleCount(gltf);
  const advertised = manifest.assets ?? {};
  if (typeof advertised.sizeBytes === 'number' && advertised.sizeBytes > options.maxBytes) {
    errors.push(`assets.sizeBytes ${advertised.sizeBytes} exceeds budget ${options.maxBytes}`);
  }
  if (typeof advertised.triangles === 'number' && advertised.triangles > options.maxTriangles) {
    errors.push(`assets.triangles ${advertised.triangles} exceeds budget ${options.maxTriangles}`);
  }
  if (size > options.maxBytes) errors.push(`model is ${size} bytes (budget ${options.maxBytes})`);
  if (triangles > options.maxTriangles) errors.push(`model has ~${triangles} triangles (budget ${options.maxTriangles})`);

  const parts = isRecord(manifest.parts) ? Object.keys(manifest.parts).length : 0;
  console.log(`model:    ${path.basename(modelPath)}  (${size} bytes, ~${triangles} triangles)`);
  console.log(`manifest: ${manifest.id ?? '?'} v${manifest.version ?? '?'} — ${parts} part(s)`);
  console.log(`names:    ${[...names].join(', ') || '(none)'}`);
  for (const warning of warnings) console.log(`! ${warning}`);
  if (errors.length === 0) {
    console.log('✓ manifest and model agree; budgets pass');
    return;
  }
  for (const error of errors) console.error(`✗ ${error}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(`✗ ${error.stack ?? error.message}`);
  process.exit(1);
});
