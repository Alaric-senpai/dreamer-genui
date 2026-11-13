#!/usr/bin/env node
/**
 * Capture the M3 showreel with the Chromium that ships in the Playwright cache
 * (no new dependency): CDP screenshot frames -> ffmpeg mp4/gif.
 *
 * The screencast API was tried first and dropped the board's painted
 * background in headless Chromium (dark JPEGs), so frames come from
 * `Page.captureScreenshot` at a fixed cadence instead.
 *
 * Usage:
 *   node scripts/capture-showreel.mjs --mode desktop          # video + axe/AX
 *   node scripts/capture-showreel.mjs --mode mobile           # video + axe/AX + narrow detour fallback
 *   node scripts/capture-showreel.mjs --mode reduced          # video, reduced motion + static ambience
 *   node scripts/capture-showreel.mjs --mode metrics          # no video, fps
 *   node scripts/capture-showreel.mjs --mode metrics-throttled
 *
 * Assumes `next start -p 3100` is already serving the playground.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(REPO, 'docs/showreel');
const WORK_ROOT = path.join(os.tmpdir(), 'showreel-capture');
const URL = 'http://127.0.0.1:3100/showreel?capture=1';

const CHROME =
  process.env.CHROME_PATH ??
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
const FFMPEG = process.env.FFMPEG_PATH ?? '/usr/bin/ffmpeg';

const MODES = {
  desktop: { width: 1280, height: 800, dsf: 1, throttle: 1, reduced: false, limitMs: 0, capture: true, frameMs: 45 },
  mobile: { width: 390, height: 844, dsf: 2, throttle: 1, reduced: false, limitMs: 0, capture: true, frameMs: 60 },
  reduced: { width: 1280, height: 800, dsf: 1, throttle: 1, reduced: true, limitMs: 0, capture: true, frameMs: 60 },
  metrics: { width: 1280, height: 800, dsf: 1, throttle: 1, reduced: false, limitMs: 0, capture: false },
  'metrics-throttled': { width: 1280, height: 800, dsf: 1, throttle: 4, reduced: false, limitMs: 0, capture: false },
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const modeName = arg('mode', 'desktop');
const mode = MODES[modeName];
if (!mode) {
  console.error(`unknown mode ${modeName}; use ${Object.keys(MODES).join(', ')}`);
  process.exit(1);
}

const runDir = path.join(WORK_ROOT, modeName);
const framesDir = path.join(runDir, 'frames');
fs.rmSync(runDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params);
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function waitForHttp(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function run() {
  const profile = path.join(WORK_ROOT, `profile-${modeName}`);
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--remote-debugging-port=9333',
      `--user-data-dir=${profile}`,
      `--window-size=${mode.width},${mode.height}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  try {
    await waitForHttp('http://127.0.0.1:9333/json/version');
    const target = await fetch('http://127.0.0.1:9333/json/new?about:blank', {
      method: 'PUT',
    }).then((r) => r.json());

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Accessibility.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: mode.width,
      height: mode.height,
      deviceScaleFactor: mode.dsf,
      mobile: modeName === 'mobile',
    });
    if (mode.reduced) {
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
    }

    await cdp.send('Page.navigate', { url: URL });
    await waitForEval(cdp, 'document.readyState === "complete"', 20_000);
    await waitForEval(cdp, 'window.__SHOWREEL_READY__ === true', 20_000);
    if (mode.throttle !== 1) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: mode.throttle });
    }

    const frames = [];
    let capturing = true;
    let frameSeq = 0;
    const capLoop = (async () => {
      while (capturing) {
        const t0 = Date.now();
        const { data } = await cdp.send('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 80,
          fromSurface: true,
          captureBeyondViewport: false,
          optimizeForSpeed: true,
        });
        const file = path.join(framesDir, `frame-${String(frameSeq++).padStart(5, '0')}.jpg`);
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
        frames.push({ file, ts: t0 / 1000 });
        const elapsed = Date.now() - t0;
        if (elapsed < mode.frameMs) await sleep(mode.frameMs - elapsed);
      }
    })();

    await cdp.send('Runtime.evaluate', { expression: 'window.__SHOWREEL_START__()' });

    const deadline = Date.now() + (mode.limitMs > 0 ? mode.limitMs + 8_000 : 135_000);
    let done = false;
    let axeMarks = null;
    let axeFinal = null;
    let axMarks = null;
    let cueGate = null;
    let detourCheck = null;
    let recedeCheck = null;
    let cameraCheck = null;
    let ambienceCheck = null;
    let streamCheck = null;
    let marksChecked = false;
    let cueChecked = false;
    let detourChecked = false;
    let recedeChecked = false;
    let cameraChecked = false;
    let ambienceChecked = false;
    let streamChecked = false;

    while (Date.now() < deadline) {
      const scene = await evalValue(cdp, 'window.__SHOWREEL_SCENE__');
      if (!marksChecked && scene === 'marks') {
        marksChecked = true;
        await sleep(2_800);
        axMarks = await axSnapshot(cdp);
        axeMarks = await runAxe(cdp);
        fs.writeFileSync(path.join(runDir, 'ax-marks.json'), JSON.stringify(axMarks, null, 2));
        fs.writeFileSync(path.join(runDir, 'axe-marks.json'), JSON.stringify(axeMarks, null, 2));
        console.log(`axe (marks): ${axeMarks.violations.length} violations`);
      }
      if (!cueChecked && scene === 'cues') {
        cueChecked = true;
        const before = await evalValue(cdp, 'document.querySelectorAll("[data-node-id^=\\"s5-\\"]").length');
        await sleep(7_000);
        const after = await evalValue(cdp, 'document.querySelectorAll("[data-node-id^=\\"s5-\\"]").length');
        cueGate = { before, after };
        fs.writeFileSync(path.join(runDir, 'cue-gate.json'), JSON.stringify(cueGate, null, 2));
        console.log(`cue gate: before=${before} after=${after}`);
      }
      if (!detourChecked && scene === 'detour') {
        detourChecked = true;
        await sleep(2_300);
        detourCheck = await evalJson(cdp, `(() => {
          const region = document.querySelector('.dg-detour');
          if (!region) return { open: false };
          return {
            open: true,
            placement: region.getAttribute('data-dg-placement'),
            floating: Boolean(document.querySelector('.dg-detour-overlay')),
            returnButton: Boolean(document.querySelector('.dg-detour-return')),
            annotated: Boolean(document.querySelector('[data-dg-annotated]')),
            connector: Boolean(document.querySelector('.dg-detour-connector-path')),
            scopedTheme: Boolean((region.getAttribute('style') || '').includes('--dg-color-bg')),
            backdrop: Boolean(document.querySelector('.dg-detour-backdrop')),
          };
        })()`);
        const detourAxe = await runAxe(cdp);
        fs.writeFileSync(path.join(runDir, 'detour-check.json'), JSON.stringify(detourCheck, null, 2));
        fs.writeFileSync(path.join(runDir, 'axe-detour.json'), JSON.stringify(detourAxe, null, 2));
        console.log(`detour: ${JSON.stringify(detourCheck)}; axe ${detourAxe.violations.length}`);
      }
      if (!recedeChecked && scene === 'recede') {
        recedeChecked = true;
        await sleep(6_200);
        const nodes = await evalValue(cdp, 'document.querySelectorAll(".dg-node").length');
        const receded = await evalValue(cdp, 'document.querySelectorAll(\'[data-dg-receded="true"]\').length');
        recedeCheck = { nodes, receded };
        fs.writeFileSync(path.join(runDir, 'recede-check.json'), JSON.stringify(recedeCheck, null, 2));
        console.log(`recede: ${receded}/${nodes} receded`);
      }
      if (!cameraChecked && scene === 'camera') {
        cameraChecked = true;
        await sleep(1_400);
        const pushed = await evalValue(cdp, 'document.querySelector(".dg-camera")?.style.transform ?? null');
        await sleep(1_700);
        const overview = await evalValue(cdp, 'document.querySelector(".dg-camera")?.style.transform ?? null');
        cameraCheck = { pushed, overview };
        fs.writeFileSync(path.join(runDir, 'camera-check.json'), JSON.stringify(cameraCheck, null, 2));
        console.log(`camera: pushed=${pushed} overview=${overview}`);
      }
      if (!ambienceChecked && scene === 'ambience') {
        ambienceChecked = true;
        // Sample across the preset cycle; each theme op lands 1.4 s apart.
        await sleep(1_200);
        const sequence = [];
        let visibility = null;
        for (let i = 0; i < 8; i += 1) {
          const sample = await evalJson(
            cdp,
            `(() => {
              const layer = document.querySelector('.dg-ambience');
              const canvas = layer ? layer.querySelector('canvas') : null;
              return {
                preset: layer ? layer.getAttribute('data-dg-ambience-preset') : null,
                mode: layer ? layer.getAttribute('data-dg-ambience-mode') : null,
                canvas: Boolean(canvas),
                state: canvas ? canvas.getAttribute('data-dg-ambience-state') : null,
              };
            })()`
          );
          sequence.push(sample);
          if (!visibility && sample.canvas) {
            visibility = await evalJsonAsync(
              cdp,
              `(async () => {
                const canvas = document.querySelector('.dg-ambience canvas');
                const before = canvas ? canvas.getAttribute('data-dg-ambience-state') : null;
                let hidden = null;
                let restored = null;
                if (canvas) {
                  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
                  document.dispatchEvent(new Event('visibilitychange'));
                  await new Promise((r) => setTimeout(r, 180));
                  hidden = canvas.getAttribute('data-dg-ambience-state');
                  delete document.visibilityState;
                  document.dispatchEvent(new Event('visibilitychange'));
                  await new Promise((r) => setTimeout(r, 180));
                  restored = canvas.getAttribute('data-dg-ambience-state');
                }
                return { before, hidden, restored };
              })()`
            );
          }
          await sleep(1_300);
        }
        const ambienceAxe = await runAxe(cdp);
        ambienceCheck = { sequence, visibility };
        fs.writeFileSync(path.join(runDir, 'ambience-check.json'), JSON.stringify(ambienceCheck, null, 2));
        fs.writeFileSync(path.join(runDir, 'axe-ambience.json'), JSON.stringify(ambienceAxe, null, 2));
        console.log(`ambience: ${JSON.stringify(ambienceCheck)}; axe ${ambienceAxe.violations.length}`);
      }
      if (!streamChecked && scene === 'stream') {
        streamChecked = true;
        await sleep(2_000);
        const midText = await evalValue(cdp, 'document.querySelectorAll(\'.dg-node[data-node-id="streaming-text"]\').length');
        const midChoices = await evalValue(cdp, 'document.querySelectorAll(\'.dg-node[data-node-id="streaming-choices"]\').length');
        await sleep(2_600);
        const finalText = await evalValue(cdp, 'document.querySelectorAll(\'.dg-node[data-node-id="streaming-text"]\').length');
        const finalChoices = await evalValue(cdp, 'document.querySelectorAll(\'.dg-node[data-node-id="streaming-choices"]\').length');
        streamCheck = { midText, midChoices, finalText, finalChoices };
        fs.writeFileSync(path.join(runDir, 'stream-check.json'), JSON.stringify(streamCheck, null, 2));
        console.log(`stream: ${JSON.stringify(streamCheck)}`);
      }
      const isDone = await evalValue(cdp, 'window.__SHOWREEL_DONE__ === true');
      if (isDone) {
        done = true;
        break;
      }
      if (mode.limitMs > 0 && Date.now() >= deadline - 8_000) break;
      await sleep(400);
    }

    await sleep(700);
    capturing = false;
    await capLoop;

    const metrics = await evalJson(cdp, 'window.__SHOWREEL_METRICS__');
    const ax = await axSnapshot(cdp);
    axeFinal = await runAxe(cdp);
    fs.writeFileSync(
      path.join(runDir, 'metrics.json'),
      JSON.stringify(
        {
          mode: modeName,
          done,
          metrics,
          frames: frames.length,
          cueGate,
          detourCheck,
          recedeCheck,
          cameraCheck,
          ambienceCheck,
          streamCheck,
        },
        null,
        2
      )
    );
    fs.writeFileSync(path.join(runDir, 'ax-final.json'), JSON.stringify(ax, null, 2));
    fs.writeFileSync(path.join(runDir, 'axe-final.json'), JSON.stringify(axeFinal, null, 2));
    console.log(`axe (final): ${axeFinal.violations.length} violations`);

    ws.close();
    await fetch(`http://127.0.0.1:9333/json/close/${target.id}`).catch(() => {});

    if (!mode.capture) {
      console.log(`${modeName} metrics:`, JSON.stringify(metrics));
      return;
    }
    if (frames.length === 0) throw new Error('no frames captured');
    console.log(`${modeName}: ${frames.length} frames, done=${done}`);
    const video = path.join(OUT_DIR, `showreel-${modeName}.mp4`);
    encode(frames, video);
    console.log(`video: ${video}`);

    if (modeName === 'desktop') {
      const gif = path.join(OUT_DIR, 'showreel-hero.gif');
      execFfmpeg([
        '-t', '11',
        '-i', video,
        '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse',
        '-loop', '0',
        gif,
      ]);
      console.log(`gif: ${gif}`);
    }
  } finally {
    chrome.kill('SIGKILL');
  }
}

function execFfmpeg(args) {
  const res = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    stdio: 'inherit',
  });
  if (res.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

function encode(frames, outFile) {
  const concatFile = path.join(path.dirname(outFile), `.concat-${path.basename(outFile)}.txt`);
  const lines = [];
  for (let i = 0; i < frames.length; i += 1) {
    const next = frames[i + 1];
    const duration = next ? Math.max(0.001, next.ts - frames[i].ts) : 0.5;
    lines.push(`file '${frames[i].file}'`, `duration ${duration.toFixed(4)}`);
  }
  lines.push(`file '${frames[frames.length - 1].file}'`);
  fs.writeFileSync(concatFile, lines.join('\n'));
  try {
    execFfmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outFile,
    ]);
  } finally {
    fs.rmSync(concatFile, { force: true });
  }
}

async function waitForEval(cdp, expression, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evalValue(cdp, expression)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for: ${expression}`);
}

async function evalValue(cdp, expression) {
  const { result } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
  return result.value;
}

async function evalJson(cdp, expression) {
  const value = await evalValue(cdp, `JSON.stringify(${expression})`);
  return value ? JSON.parse(value) : null;
}

/** Await a promise-returning expression, then decode its JSON. */
async function evalJsonAsync(cdp, expression) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: `Promise.resolve(${expression}).then((value) => JSON.stringify(value))`,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.value ? JSON.parse(result.value) : null;
}

async function axSnapshot(cdp) {
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  return nodes
    .filter((n) => !n.ignored)
    .map((n) => ({
      role: n.role?.value,
      name: n.name?.value,
      level: n.properties?.find((p) => p.name === 'level')?.value?.value,
    }))
    .filter((n) => n.role && n.role !== 'generic' && n.role !== 'none');
}

async function runAxe(cdp) {
  const source = fs.readFileSync(findAxe(), 'utf8');
  await cdp.send('Runtime.evaluate', { expression: source });
  const { result } = await cdp.send('Runtime.evaluate', {
    expression:
      'axe.run(document).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })))',
    awaitPromise: true,
    returnByValue: true,
  });
  return { violations: result.value ?? [] };
}

function findAxe() {
  const pnpm = path.join(REPO, 'node_modules/.pnpm');
  const dir = fs.readdirSync(pnpm).find((d) => d.startsWith('axe-core@4'));
  if (!dir) throw new Error('axe-core not found in node_modules/.pnpm');
  return path.join(pnpm, dir, 'node_modules/axe-core/axe.min.js');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
