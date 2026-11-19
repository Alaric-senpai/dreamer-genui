#!/usr/bin/env node
/**
 * M5b capture script: headless Chromium over raw CDP.
 *
 * Captures the 3D showcase route in its connector modes and fallback states so
 * the milestone gate has durable evidence in docs/showreel/.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = process.cwd();
const OUT_DIR = path.join(REPO, 'docs/showreel');
const WORK_ROOT = path.join(os.tmpdir(), 'm5b-capture');
const URL = 'http://127.0.0.1:3100/m5b';

const CHROME =
  process.env.CHROME_PATH ??
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');

const VIEW = { width: 1440, height: 1000, dsf: 1 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg.result);
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

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'evaluation failed');
  }
  return result.result?.value;
}

async function waitForEval(cdp, expression, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return true;
    await sleep(200);
  }
  return false;
}

function setSelect(value) {
  return `(() => {
    const el = document.querySelector('select[aria-label="3d fixture"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  })()`;
}

function setMode(value) {
  return `(() => {
    const el = document.querySelector('select[aria-label="model connector"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  })()`;
}

function clickButton(label) {
  return `(() => {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent.trim() === ${JSON.stringify(label)},
    );
    if (!button) return false;
    button.click();
    return true;
  })()`;
}

function toggleOffline() {
  return `(() => {
    const input = [...document.querySelectorAll('input[type="checkbox"]')].find(
      (candidate) => candidate.parentElement?.textContent.includes('simulate offline'),
    );
    if (!input) return false;
    input.click();
    return input.checked;
  })()`;
}

async function screenshot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`wrote ${file}`);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const profile = path.join(WORK_ROOT, 'profile');
  fs.rmSync(WORK_ROOT, { recursive: true, force: true });
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  fs.mkdirSync(profile, { recursive: true });

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
      '--remote-debugging-port=9334',
      `--user-data-dir=${profile}`,
      `--window-size=${VIEW.width},${VIEW.height}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  try {
    await waitForHttp('http://127.0.0.1:9334/json/version');
    const target = await fetch('http://127.0.0.1:9334/json/new?about:blank', {
      method: 'PUT',
    }).then((response) => response.json());
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEW.width,
      height: VIEW.height,
      deviceScaleFactor: VIEW.dsf,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url: URL });
    await sleep(2500);

    const ready = `Boolean(document.querySelector('[data-dg-figure="figure3d"]'))`;

    // 1) static connector, basic fixture.
    await evaluate(cdp, setMode('static'));
    await evaluate(cdp, setSelect('basic'));
    const basicReady = await waitForEval(cdp, `document.querySelector('[data-dg-ready="true"]') !== null`, 30_000);
    console.log(`basic ready: ${basicReady}`);
    await sleep(1200);
    await screenshot(cdp, 'm5b-basic.png');

    // 2) cue-driven tour: fire every cue the fixture listens for.
    await evaluate(cdp, setSelect('tour'));
    await waitForEval(cdp, ready, 30_000);
    await sleep(800);
    for (const cue of ['view-top', 'show-rotor', 'cutaway', 'wrap']) {
      const clicked = await evaluate(cdp, clickButton(cue));
      console.log(`cue ${cue}: ${clicked}`);
      await sleep(900);
    }
    await evaluate(cdp, clickButton('view top-down'));
    await sleep(1200);
    await screenshot(cdp, 'm5b-tour.png');

    // 3) scene3d without any connector.
    await evaluate(cdp, setSelect('scene'));
    await waitForEval(cdp, ready, 30_000);
    await sleep(1200);
    await screenshot(cdp, 'm5b-scene3d.png');

    // 4) HTTP connector against the mock registry.
    await evaluate(cdp, setMode('http'));
    await evaluate(cdp, setSelect('basic'));
    const httpReady = await waitForEval(cdp, `document.querySelector('[data-dg-ready="true"]') !== null`, 30_000);
    console.log(`http ready: ${httpReady}`);
    await sleep(1200);
    await screenshot(cdp, 'm5b-http.png');

    // 5) cached connector with the network switched off after the first load.
    await evaluate(cdp, setMode('http-cache'));
    await evaluate(cdp, setSelect('basic'));
    await waitForEval(cdp, `document.querySelector('[data-dg-ready="true"]') !== null`, 30_000);
    await sleep(600);
    console.log(`offline toggled: ${await evaluate(cdp, toggleOffline())}`);
    await sleep(1800);
    const cachedReady = await evaluate(cdp, `document.querySelector('[data-dg-ready="true"]') !== null`);
    console.log(`cached ready while offline: ${cachedReady}`);
    await screenshot(cdp, 'm5b-cache-offline.png');

    // 6) missing model: poster-less alt + parts fallback.
    await evaluate(cdp, setMode('static'));
    await evaluate(cdp, setSelect('missing'));
    await sleep(1800);
    await screenshot(cdp, 'm5b-missing.png');

    // 7) phone-width container.
    await evaluate(cdp, setSelect('basic'));
    await waitForEval(cdp, ready, 30_000);
    await evaluate(
      cdp,
      `(() => {
        const box = [...document.querySelectorAll('input[type="checkbox"]')].find(
          (candidate) => candidate.parentElement?.textContent.includes('phone-width'),
        );
        if (!box) return false;
        box.click();
        return box.checked;
      })()`,
    );
    await sleep(1500);
    await screenshot(cdp, 'm5b-narrow.png');
  } finally {
    chrome.kill('SIGTERM');
  }
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
