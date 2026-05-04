const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');

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
  if (!fs.existsSync(webGameClientPath)) {
    throw new Error(`Missing develop-web-game client at ${webGameClientPath}`);
  }
  writeActionsFile();
  fs.mkdirSync(outputDir, { recursive: true });

  const server = createServer();
  const port = await listen(server);
  try {
    await runWebGameClient(port);

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
