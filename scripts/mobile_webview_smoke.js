const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output');
const screenshotPath = path.join(outputDir, 'batch1-mobile-smoke.png');
const reportPath = path.join(outputDir, 'batch1-mobile-smoke.json');
const requiredAnalyticsEvents = [
  'session_start',
  'menu_view',
  'map_view',
  'char_select_view',
  'tutorial_step',
  'tutorial_complete',
  'level_start',
  'level_complete',
  'death',
  'continue_offer',
  'ad_show',
  'retry',
  'next_level',
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.css': return 'text/css; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
      const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;

      if (normalizedPath === '/favicon.ico') {
        response.writeHead(204);
        response.end();
        return;
      }

      const filePath = path.join(projectRoot, normalizedPath.replace(/^\/+/, ''));

      if (!filePath.startsWith(projectRoot)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (error, content) => {
        if (error) {
          response.writeHead(404);
          response.end('Not found');
          return;
        }

        response.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
        response.end(content);
      });
    });

    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    consoleMessages.push({
      text: message.text(),
      type: message.type(),
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewport({ width: 1280, height: 720, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    window.__rnMessages = [];
    window.ReactNativeWebView = {
      postMessage(payload) {
        try {
          window.__rnMessages.push(JSON.parse(payload));
        } catch (error) {
          window.__rnMessages.push({ type: 'invalid_payload', payload: String(payload) });
        }
      },
    };
  });

  try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 10000 });
    await page.waitForFunction(() => {
      try {
        return JSON.parse(window.render_game_to_text()).phase !== 'LOADING';
      } catch (error) {
        return false;
      }
    }, { timeout: 10000 });
    await delay(500);

    const report = await page.evaluate(async (requiredEvents) => {
      const localDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const snapshot = (label) => {
        const stateText = typeof window.render_game_to_text === 'function'
          ? window.render_game_to_text()
          : null;
        const state = stateText ? JSON.parse(stateText) : null;
        return {
          label,
          phase: state ? state.phase : 'unknown',
          state,
        };
      };

      save.tutorialSeen = true;
      save.highestLevel = 0;
      persistSave();

      const snapshots = [snapshot('boot')];

      G.phase = 'MENU';
      await localDelay(140);
      snapshots.push(snapshot('menu'));

      G.phase = 'LEVEL_MAP';
      await localDelay(140);
      snapshots.push(snapshot('map'));

      G.phase = 'CHAR_SELECT';
      await localDelay(140);
      if (typeof trackPhaseView === 'function') {
        trackPhaseView('CHAR_SELECT');
        await localDelay(40);
      }
      snapshots.push(snapshot('char_select'));

      G.phase = 'TUTORIAL';
      await localDelay(140);
      trackTutorialStep('smoke_step', { tutorial_level: 1 });
      await localDelay(40);
      trackTutorialComplete();
      await localDelay(80);
      snapshots.push(snapshot('tutorial'));

      startLevel(1);
      await localDelay(160);
      G.phase = 'PLAYING';
      await localDelay(160);
      snapshots.push(snapshot('playing'));

      G.phase = 'CONTINUE_PROMPT';
      await localDelay(160);
      snapshots.push(snapshot('continue_prompt_guided'));

      G.phase = 'PLAYING';
      await localDelay(120);

      if (typeof noteGuidedAction === 'function') {
        noteGuidedAction('jump', { smoke: true });
        await localDelay(60);
        noteGuidedAction('dash', { smoke: true });
        await localDelay(80);
        snapshots.push(snapshot('guided_complete'));
      }

      G.phase = 'CONTINUE_PROMPT';
      await localDelay(160);
      snapshots.push(snapshot('continue_prompt'));

      G.phase = 'LEVEL_COMPLETE';
      G.levelCompleteTimer = 3;
      trackLevelComplete(G.levelNum, 4321, 3, G.timeLeft);
      await localDelay(120);
      trackNextLevel(G.levelNum + 1);
      await localDelay(60);
      snapshots.push(snapshot('level_complete'));

      if (typeof checkMissionResets === 'function') {
        checkMissionResets();
      }
      if (save.missions && save.missions.daily && save.missions.daily[0]) {
        save.missions.daily[0].progress = save.missions.daily[0].target;
        save.missions.daily[0].claimed = false;
        persistSave();
      }
      G._nextLevelNum = G.levelNum + 1;
      G.phase = 'LEVEL_MAP';
      await localDelay(120);
      snapshots.push(snapshot('map_reward_ready'));

      G.phase = 'MISSIONS';
      await localDelay(120);
      snapshots.push(snapshot('missions'));

      G.phase = 'SHOP';
      await localDelay(120);
      snapshots.push(snapshot('shop'));

      G.phase = 'STATS';
      await localDelay(120);
      snapshots.push(snapshot('stats'));

      G.phase = 'SETTINGS';
      await localDelay(120);
      snapshots.push(snapshot('settings'));

      save.dailyStreak = Math.max(1, save.dailyStreak || 1);
      G.dailyCalendarDay = 1;
      G.dailyRewardType = DAILY_CALENDAR[0];
      G.dailyRewardClaimed = false;
      G.dailyRewardTimer = 1;
      G.phase = 'DAILY_REWARD';
      await localDelay(120);
      snapshots.push(snapshot('daily_reward'));

      startLevel(11);
      await localDelay(160);
      G.phase = 'PLAYING';
      await localDelay(160);
      snapshots.push(snapshot('scripted_level_11'));

      startLevel(15);
      await localDelay(160);
      boss = new Boss(15);
      G.phase = 'BOSS_FIGHT';
      boss.setCue('SMOKE BOSS', 'Verify boss cue readability.', '#FFAA44', 1.2);
      boss.telegraphs = buildBossTelegraphs(boss, 'GROUND_POUND', G.player, 0.8);
      await localDelay(120);
      snapshots.push(snapshot('boss_fight'));

      G.phase = 'DEAD';
      trackDeath(G.levelNum, 'smoke', 1234);
      await localDelay(120);
      trackRetry('smoke_retry');
      await localDelay(60);
      snapshots.push(snapshot('dead'));

      requestAd('continue');
      await localDelay(120);

      const nativeMessages = Array.isArray(window.__rnMessages) ? window.__rnMessages.slice(0, 200) : [];
      const analyticsEvents = nativeMessages
        .filter((entry) => entry.type === 'analytics')
        .map((entry) => entry.event);

      return {
        analyticsEvents,
        errorOverlayText: window._errDiv ? window._errDiv.textContent : '',
        hasAdvanceTime: typeof window.advanceTime === 'function',
        hasGuidedChunkPlan: !!(snapshots.find((entry) => entry.label === 'playing' && entry.state && entry.state.onboarding && entry.state.onboarding.guided_chunk_cursor >= 5)),
        hasGuidedContinuePrompt: !!(snapshots.find((entry) => entry.label === 'continue_prompt_guided' && entry.state && entry.state.continue_prompt && entry.state.continue_prompt.title === 'SAVE THE LESSON')),
        hasGuidedOnboarding: !!(snapshots.find((entry) => entry.label === 'playing' && entry.state && entry.state.onboarding)),
        hasGuidedCompletion: !!(snapshots.find((entry) => entry.label === 'guided_complete' && entry.state && entry.state.onboarding && entry.state.onboarding.completed)),
        hasMetaPolishScreens: ['missions', 'shop', 'stats', 'settings', 'daily_reward'].every((label) => snapshots.some((entry) => entry.label === label && entry.phase)),
        hasBossCue: !!(snapshots.find((entry) => entry.label === 'boss_fight' && entry.state && entry.state.boss && entry.state.boss.cue)),
        hasBossTelegraph: !!(snapshots.find((entry) => entry.label === 'boss_fight' && entry.state && entry.state.boss && entry.state.boss.telegraphs > 0)),
        hasRewardReadyMapState: !!(snapshots.find((entry) => entry.label === 'map_reward_ready' && entry.state && entry.state.missions && entry.state.missions.rewards_ready > 0)),
        hasRenderGameToText: typeof window.render_game_to_text === 'function',
        hasScriptedMidgame: !!(snapshots.find((entry) => entry.label === 'scripted_level_11' && entry.state && entry.state.level_plan === 'scripted' && entry.state.level === 11)),
        missingEvents: requiredEvents.filter((eventName) => !analyticsEvents.includes(eventName)),
        nativeMessages,
        phase: snapshots[snapshots.length - 1] ? snapshots[snapshots.length - 1].phase : 'unknown',
        snapshots,
        state: snapshots[snapshots.length - 1] ? snapshots[snapshots.length - 1].state : null,
      };
    }, requiredAnalyticsEvents);

    await page.screenshot({ path: screenshotPath });
    fs.writeFileSync(reportPath, JSON.stringify({
      consoleMessages,
      pageErrors,
      report,
      screenshotPath,
      url: `http://127.0.0.1:${port}/index.html`,
    }, null, 2));

    if (!report.hasRenderGameToText) {
      throw new Error('render_game_to_text is not exposed');
    }
    if (!report.hasGuidedOnboarding) {
      throw new Error('Expected guided onboarding state during level 1 smoke flow');
    }
    if (!report.hasGuidedChunkPlan) {
      throw new Error('Expected guided chunk planning state during the level 1 smoke flow');
    }
    if (!report.hasGuidedContinuePrompt) {
      throw new Error('Expected lesson-aware continue prompt copy during the level 1 smoke flow');
    }
    if (!report.hasGuidedCompletion) {
      throw new Error('Expected guided onboarding completion after simulated level 1 lesson actions');
    }
    if (!report.hasRewardReadyMapState) {
      throw new Error('Expected reward-ready mission guidance after the early clear smoke flow');
    }
    if (!report.hasMetaPolishScreens) {
      throw new Error('Expected the polished meta screens to render during smoke coverage');
    }
    if (!report.hasScriptedMidgame) {
      throw new Error('Expected authored scripted coverage for level 11');
    }
    if (!report.hasBossCue || !report.hasBossTelegraph) {
      throw new Error('Expected boss cue and telegraph state during boss smoke coverage');
    }
    if (!report.nativeMessages.some((entry) => entry.type === 'analytics')) {
      throw new Error('Expected at least one analytics message from the WebView bridge');
    }
    if (report.missingEvents.length > 0) {
      throw new Error(`Missing analytics events: ${report.missingEvents.join(', ')}`);
    }
    if (report.phase === 'LOADING') {
      throw new Error('Game never progressed past LOADING during smoke test');
    }
    if (report.errorOverlayText) {
      throw new Error(`Game error overlay detected: ${report.errorOverlayText}`);
    }
    if (pageErrors.length > 0) {
      throw new Error(`Page errors detected: ${pageErrors.join(' | ')}`);
    }
    if (consoleMessages.some((entry) => entry.type === 'error')) {
      throw new Error(`Console errors detected: ${consoleMessages.map((entry) => entry.text).join(' | ')}`);
    }

    console.log('Batch 1 mobile smoke passed.');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
