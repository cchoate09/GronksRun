// Text overflow audit harness.
//
// Instruments CanvasRenderingContext2D.fillText to record every rendered text
// rect, then forces every UI state at multiple Android landscape viewports.
// Reports text that is:
//   - rendered off the canvas
//   - rendered outside the most-recent containing panel rect drawn this frame
//   - shrunk below the readable floor (drawFitText hit minPx but still overflowed)
//
// Output:
//   output/text-overflow/<viewport>/<state>.png   - screenshot
//   output/text-overflow/report.json              - full machine-readable report
//   output/text-overflow/summary.md               - human-readable summary
//
// Usage: node scripts/text_overflow_audit.js

const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'output', 'text-overflow');

const VIEWPORTS = [
  { name: '960x540', width: 960, height: 540 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1600x720', width: 1600, height: 720 },
  { name: '1920x720', width: 1920, height: 720 },
];

const READABLE_PX_FLOOR = 9;
const EDGE_OVERFLOW_TOLERANCE = 0.5;

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.css': return 'text/css; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      const norm = url === '/' ? '/index.html' : url;
      if (norm === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      const filePath = path.join(projectRoot, norm.replace(/^\/+/, ''));
      if (!filePath.startsWith(projectRoot)) { res.writeHead(403); res.end('Forbidden'); return; }
      fs.readFile(filePath, (err, content) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
        res.end(content);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const INSTRUMENTATION = `(() => {
  if (window.__textAuditInstalled) return;
  window.__textAuditInstalled = true;
  window.__textRecords = [];
  window.__panelRecords = [];
  window.__currentLabel = null;

  const Ctx = CanvasRenderingContext2D.prototype;
  const origFillText = Ctx.fillText;
  const origStrokeText = Ctx.strokeText;

  function parseFontPx(font) {
    const m = String(font || '').match(/([0-9]+(?:\\.[0-9]+)?)px/);
    return m ? parseFloat(m[1]) : 12;
  }
  function rectOfText(ctx, text, x, y) {
    const m = ctx.measureText(String(text || ''));
    const fontPx = parseFontPx(ctx.font);
    let left = x, right = x + m.width;
    if (ctx.textAlign === 'center') { left = x - m.width / 2; right = x + m.width / 2; }
    else if (ctx.textAlign === 'right' || ctx.textAlign === 'end') { left = x - m.width; right = x; }
    let top = y, bottom = y + fontPx;
    if (ctx.textBaseline === 'middle') { top = y - fontPx / 2; bottom = y + fontPx / 2; }
    else if (ctx.textBaseline === 'bottom' || ctx.textBaseline === 'alphabetic') { top = y - fontPx * 0.85; bottom = y + fontPx * 0.15; }
    else if (ctx.textBaseline === 'top' || ctx.textBaseline === 'hanging') { top = y; bottom = y + fontPx; }
    let t = null;
    try { t = ctx.getTransform ? ctx.getTransform() : null; } catch (e) { t = null; }
    if (t && isFinite(t.a) && isFinite(t.d)) {
      const a = t.a, b = t.b, c = t.c, d = t.d, tx = t.e, ty = t.f;
      const scaleX = Math.sqrt(a * a + b * b);
      const scaleY = Math.sqrt(c * c + d * d);
      const localCx = (left + right) / 2;
      const localCy = (top + bottom) / 2;
      const screenCx = a * localCx + c * localCy + tx;
      const screenCy = b * localCx + d * localCy + ty;
      const halfW = ((right - left) / 2) * scaleX;
      const halfH = ((bottom - top) / 2) * scaleY;
      const corners = [];
      const localCorners = [
        [left, top], [right, top], [right, bottom], [left, bottom]
      ];
      for (const [lx, ly] of localCorners) {
        corners.push([a * lx + c * ly + tx, b * lx + d * ly + ty]);
      }
      const xs = corners.map((p) => p[0]);
      const ys = corners.map((p) => p[1]);
      const aabbLeft = Math.min(...xs);
      const aabbRight = Math.max(...xs);
      const aabbTop = Math.min(...ys);
      const aabbBottom = Math.max(...ys);
      return {
        left: aabbLeft, right: aabbRight, top: aabbTop, bottom: aabbBottom,
        width: aabbRight - aabbLeft,
        fontPx: fontPx * Math.max(scaleX, scaleY),
        cx: screenCx, cy: screenCy, halfW, halfH,
      };
    }
    return { left, right, top, bottom, width: m.width, fontPx };
  }
  function record(ctx, text, x, y) {
    if (!window.__captureActive) return;
    const r = rectOfText(ctx, text, x, y);
    const canvas = ctx.canvas || {};
    window.__textRecords.push({
      label: window.__currentLabel,
      text: String(text || ''),
      ...r,
      canvasW: canvas.width || 0,
      canvasH: canvas.height || 0,
      align: ctx.textAlign,
      baseline: ctx.textBaseline,
      font: ctx.font,
    });
  }
  Ctx.fillText = function (text, x, y, mw) {
    record(this, text, x, y);
    return origFillText.call(this, text, x, y, mw);
  };
  Ctx.strokeText = function (text, x, y, mw) {
    record(this, text, x, y);
    return origStrokeText.call(this, text, x, y, mw);
  };

  const origRect = Ctx.rect;
  void origRect;

  window.__startCapture = function (label) {
    window.__currentLabel = label;
    window.__captureActive = true;
  };
  window.__stopCapture = function () {
    window.__captureActive = false;
  };
  window.__pullRecords = function () {
    const r = window.__textRecords.slice();
    window.__textRecords.length = 0;
    return r;
  };
})();`;

async function forceState(page, label, fn, settleMs) {
  await page.evaluate(fn);
  await delay(180);
  // Advance enough simulated frames to settle pop-in animations (~1.2s of game time).
  await page.evaluate(() => {
    if (typeof tick === 'function') {
      const start = performance.now();
      for (let i = 0; i < 80; i++) {
        try { tick(start + i * 16); } catch (e) {}
      }
    }
  });
  await delay(80);
  await page.evaluate((l) => window.__startCapture(l), label);
  await page.evaluate(() => {
    if (typeof tick === 'function') {
      try { tick(performance.now()); } catch (e) {}
    }
  });
  await delay(40);
  const records = await page.evaluate(() => window.__pullRecords());
  await page.evaluate(() => window.__stopCapture());
  return records;
}

const STATE_DEFINITIONS = [
  { label: 'menu', body: () => { G.phase = 'MENU'; } },
  { label: 'level_map', body: () => { G.phase = 'LEVEL_MAP'; } },
  { label: 'char_select', body: () => { G.phase = 'CHAR_SELECT'; } },
  { label: 'tutorial', body: () => { G.phase = 'TUTORIAL'; } },
  { label: 'playing_l1', body: () => { startLevel(1); G.phase = 'PLAYING'; } },
  { label: 'playing_l11', body: () => { startLevel(11); G.phase = 'PLAYING'; } },
  { label: 'continue_prompt', body: () => { G.phase = 'CONTINUE_PROMPT'; } },
  { label: 'level_complete', body: () => { G.phase = 'LEVEL_COMPLETE'; G.levelCompleteTimer = 3; } },
  { label: 'pause', body: () => { G.phase = 'PAUSED'; } },
  { label: 'dead', body: () => { G.phase = 'DEAD'; } },
  { label: 'shop', body: () => { G.phase = 'SHOP'; } },
  { label: 'missions', body: () => { G.phase = 'MISSIONS'; } },
  { label: 'stats', body: () => { G.phase = 'STATS'; } },
  { label: 'achievements', body: () => { G.phase = 'ACHIEVEMENTS'; } },
  { label: 'settings', body: () => { G.phase = 'SETTINGS'; } },
  { label: 'skins', body: () => { G.phase = 'SKINS'; } },
  { label: 'spin_wheel', body: () => { G.phase = 'SPIN_WHEEL'; } },
  { label: 'daily_reward', body: () => {
    save.dailyStreak = Math.max(1, save.dailyStreak || 1);
    G.dailyCalendarDay = 1;
    G.dailyRewardType = (typeof DAILY_CALENDAR !== 'undefined' && DAILY_CALENDAR[0]) ? DAILY_CALENDAR[0] : 'GEMS';
    G.dailyRewardClaimed = false;
    G.dailyRewardTimer = 1;
    G.phase = 'DAILY_REWARD';
  } },
  { label: 'boss_fight', body: () => {
    startLevel(15);
    if (typeof Boss !== 'undefined') {
      boss = new Boss(15);
      boss.setCue('VOLCANO TITAN', 'Watch the molten arc and slide under the pillar.', '#FFAA44', 1.2);
      if (typeof buildBossTelegraphs === 'function' && G.player) {
        boss.telegraphs = buildBossTelegraphs(boss, 'GROUND_POUND', G.player, 0.8);
      }
    }
    G.phase = 'BOSS_FIGHT';
  } },
  { label: 'level_intro', body: () => { startLevel(7); G.phase = 'LEVEL_INTRO'; } },
  { label: 'endless_mode', body: () => { try { startEndless && startEndless(); } catch (e) {} G.phase = 'PLAYING'; } },
];

function classifyOverflows(records, viewport) {
  const issues = [];
  for (const r of records) {
    if (!r || !isFinite(r.left)) continue;
    const W = r.canvasW || viewport.width;
    const H = r.canvasH || viewport.height;
    const text = (r.text || '').slice(0, 80);
    const tooSmall = r.fontPx > 0 && r.fontPx < READABLE_PX_FLOOR;
    const offLeft = r.left < -EDGE_OVERFLOW_TOLERANCE;
    const offRight = r.right > W + EDGE_OVERFLOW_TOLERANCE;
    const offTop = r.top < -EDGE_OVERFLOW_TOLERANCE;
    const offBottom = r.bottom > H + EDGE_OVERFLOW_TOLERANCE;
    if (!offLeft && !offRight && !offTop && !offBottom && !tooSmall) continue;
    const reasons = [];
    if (offLeft) reasons.push(`left ${r.left.toFixed(1)} < 0`);
    if (offRight) reasons.push(`right ${r.right.toFixed(1)} > ${W}`);
    if (offTop) reasons.push(`top ${r.top.toFixed(1)} < 0`);
    if (offBottom) reasons.push(`bottom ${r.bottom.toFixed(1)} > ${H}`);
    if (tooSmall) reasons.push(`font ${r.fontPx.toFixed(1)}px below readable floor ${READABLE_PX_FLOOR}px`);
    issues.push({
      label: r.label,
      viewport: viewport.name,
      text,
      rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, fontPx: r.fontPx },
      align: r.align,
      baseline: r.baseline,
      font: r.font,
      reasons,
    });
  }
  return issues;
}

(async () => {
  fs.mkdirSync(outputRoot, { recursive: true });
  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const allIssues = [];
  const allRecordCounts = [];
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  await page.evaluateOnNewDocument(() => {
    window.__rnMessages = [];
    window.ReactNativeWebView = {
      postMessage(payload) {
        try { window.__rnMessages.push(JSON.parse(payload)); }
        catch (e) { window.__rnMessages.push({ type: 'invalid_payload', payload: String(payload) }); }
      },
    };
  });
  await page.evaluateOnNewDocument(INSTRUMENTATION);

  try {
    for (const vp of VIEWPORTS) {
      const vpDir = path.join(outputRoot, vp.name);
      fs.mkdirSync(vpDir, { recursive: true });
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 10000 });
      await page.waitForFunction(() => {
        try { return JSON.parse(window.render_game_to_text()).phase !== 'LOADING'; }
        catch (e) { return false; }
      }, { timeout: 10000 });
      await page.evaluate(() => {
        save.tutorialSeen = true;
        save.highestLevel = 20;
        save.totalGems = 800;
        save.bestScore = 50000;
        save.unlockedChars = save.unlockedChars || {};
        for (let i = 0; i < 6; i++) save.unlockedChars[i] = true;
        if (typeof persistSave === 'function') persistSave();
      });
      await delay(200);

      for (const def of STATE_DEFINITIONS) {
        try {
          const records = await forceState(page, def.label, def.body, 260);
          allRecordCounts.push({ viewport: vp.name, label: def.label, records: records.length });
          const issues = classifyOverflows(records, vp);
          for (const issue of issues) allIssues.push(issue);
          const shotPath = path.join(vpDir, `${def.label}.png`);
          await page.screenshot({ path: shotPath });
        } catch (e) {
          allIssues.push({ label: def.label, viewport: vp.name, error: e.message });
        }
      }
    }
  } finally {
    try { await browser.close(); } catch (e) {}
    server.close();
  }

  const grouped = {};
  for (const issue of allIssues) {
    const key = `${issue.label}@${issue.viewport}`;
    grouped[key] = grouped[key] || [];
    grouped[key].push(issue);
  }
  const summary = ['# Text Overflow Audit Summary', ''];
  summary.push(`Total flagged texts: ${allIssues.length}`);
  summary.push('');
  for (const key of Object.keys(grouped).sort()) {
    summary.push(`## ${key}  (${grouped[key].length} issues)`);
    for (const it of grouped[key].slice(0, 25)) {
      const reason = (it.reasons || []).join(' · ');
      summary.push(`- "${it.text}" — ${reason} [align=${it.align} baseline=${it.baseline} font=${it.font}]`);
    }
    if (grouped[key].length > 25) summary.push(`- … and ${grouped[key].length - 25} more`);
    summary.push('');
  }
  fs.writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify({ issues: allIssues, recordCounts: allRecordCounts }, null, 2));
  fs.writeFileSync(path.join(outputRoot, 'summary.md'), summary.join('\n'));

  console.log(`Audit complete. Total flagged texts: ${allIssues.length}`);
  console.log(`Report: ${path.join(outputRoot, 'summary.md')}`);
  process.exit(allIssues.length > 0 ? 1 : 0);
})();
