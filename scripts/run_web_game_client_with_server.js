const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const puppeteer = require('puppeteer');
const { launchOptions } = require('./puppeteerLaunchOptions');

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const outputDir = path.join(projectRoot, 'output', 'web-game-current-objective');
const actionsPath = path.join(projectRoot, 'output', 'current-objective-actions.json');
const webGameClientPath = path.join(
  process.env.CODEX_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.codex'),
  'skills',
  'develop-web-game',
  'scripts',
  'web_game_playwright_client.js'
);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const fallbackButtonNameToKey = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  enter: 'Enter',
  space: 'Space',
  a: 'KeyA',
  b: 'KeyB',
};

function writeActionsFile() {
  fs.mkdirSync(path.dirname(actionsPath), { recursive: true });
  fs.writeFileSync(actionsPath, JSON.stringify({
    steps: [
      { buttons: ['enter'], frames: 2 },
      { buttons: ['right'], frames: 18 },
      { buttons: ['right', 'space'], frames: 8 },
      { buttons: ['right', 'up'], frames: 12 },
      { buttons: ['right'], frames: 24 },
    ],
  }, null, 2));
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const normalized = path.normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(distDir, normalized);

    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not resolve local server address.');
  return address.port;
}

async function imageHasSignal(filePath) {
  const image = sharp(filePath).ensureAlpha();
  const metadata = await image.metadata();
  const buffer = await image.raw().toBuffer();
  let nonBlackPixels = 0;
  for (let i = 0; i < buffer.length; i += 4) {
    const r = buffer[i];
    const g = buffer[i + 1];
    const b = buffer[i + 2];
    const a = buffer[i + 3];
    if (a > 0 && (r > 8 || g > 8 || b > 8)) nonBlackPixels++;
  }
  const pixelCount = Math.max(1, (metadata.width || 1) * (metadata.height || 1));
  return nonBlackPixels / pixelCount > 0.01;
}

function readActionsFile() {
  return JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
}

async function snapshot(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function advance(page, ms) {
  await page.evaluate((duration) => window.advanceTime(duration), ms);
}

async function pressFallbackButtons(page, buttons, frames) {
  const keys = [...new Set((buttons || []).map((button) => fallbackButtonNameToKey[button]).filter(Boolean))];
  for (const key of keys) {
    await page.keyboard.down(key);
  }
  await advance(page, Math.max(16, Math.round((frames || 1) * (1000 / 60))));
  for (const key of keys.reverse()) {
    await page.keyboard.up(key);
  }
  await advance(page, 16);
}

function isBenignFallbackConsoleError(text) {
  return /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/.test(text);
}

async function runFallbackWebGameClient(port) {
  const browser = await puppeteer.launch(launchOptions({
    defaultViewport: { width: 960, height: 540, deviceScaleFactor: 1 },
  }));
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message || String(error)));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !isBenignFallbackConsoleError(text)) pageErrors.push(text);
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 10000 });
    const actions = readActionsFile();

    for (let iteration = 0; iteration < 3; iteration++) {
      for (const step of actions.steps || []) {
        await pressFallbackButtons(page, step.buttons, step.frames);
      }
      const state = await snapshot(page);
      fs.writeFileSync(path.join(outputDir, `state-${iteration + 1}.json`), JSON.stringify(state, null, 2));
      await page.screenshot({ path: path.join(outputDir, `shot-${iteration + 1}.png`) });
    }

    if (pageErrors.length) {
      throw new Error(`Repo fallback web game client saw page errors:\n${pageErrors.join('\n')}`);
    }
    console.log('Repo fallback web game client completed with screenshots.');
  } finally {
    await browser.close();
  }
}

async function runWebGameClient(port) {
  const child = spawn(process.execPath, [
    webGameClientPath,
    '--url',
    `http://127.0.0.1:${port}/index.html`,
    '--actions-file',
    actionsPath,
    '--iterations',
    '3',
    '--pause-ms',
    '250',
    '--screenshot-dir',
    outputDir,
  ], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  });

  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Web game client exited with ${signal || code}`));
    });
  });
}

(async () => {
  writeActionsFile();
  fs.mkdirSync(outputDir, { recursive: true });

  const server = createServer();
  const port = await listen(server);
  try {
    if (fs.existsSync(webGameClientPath)) {
      await runWebGameClient(port);
    } else {
      console.warn(`Missing develop-web-game client at ${webGameClientPath}; using repo-owned Puppeteer fallback.`);
      await runFallbackWebGameClient(port);
    }

    const screenshots = fs.readdirSync(outputDir)
      .filter((name) => /^shot-\d+\.png$/.test(name))
      .map((name) => path.join(outputDir, name));
    if (!screenshots.length) throw new Error('Web game client did not create screenshots.');

    for (const screenshot of screenshots) {
      if (!(await imageHasSignal(screenshot))) {
        throw new Error(`Web game client screenshot appears blank: ${screenshot}`);
      }
    }

    console.log('Web game client local-server pass completed with nonblank screenshots.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
