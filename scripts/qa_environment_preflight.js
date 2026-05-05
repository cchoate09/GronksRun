const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output');
const reportPath = path.join(outputDir, 'qa-environment-preflight.json');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: options.timeout || 15000,
    env: { ...process.env, ...options.env },
  });

  return {
    command: [command, ...args].join(' '),
    status: result.status,
    error: result.error ? { code: result.error.code, message: result.error.message } : null,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function existingPaths(paths) {
  return paths.filter((candidate) => fs.existsSync(candidate));
}

async function puppeteerLaunch() {
  const startedAt = Date.now();
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', timeout: 15000 });
    return {
      command: 'puppeteer.launch',
      status: 0,
      error: null,
      executablePath: typeof puppeteer.executablePath === 'function' ? puppeteer.executablePath() : null,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      command: 'puppeteer.launch',
      status: null,
      error: { code: error.code || null, message: error.message },
      executablePath: typeof puppeteer.executablePath === 'function' ? puppeteer.executablePath() : null,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const androidHome = path.join(projectRoot, '.android-home');
  fs.mkdirSync(androidHome, { recursive: true });

  const chromeCandidates = existingPaths([
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]);

  const checks = {
    chromeCandidates,
    chromeVersionChecks: chromeCandidates.map((candidate) => run(candidate, ['--version'])),
    puppeteerLaunch: await puppeteerLaunch(),
    adbDevices: run('adb', ['devices', '-l'], {
      env: {
        ANDROID_USER_HOME: androidHome,
        ANDROID_SDK_HOME: androidHome,
        HOME: androidHome,
        USERPROFILE: androidHome,
      },
    }),
    emulatorList: run('emulator', ['-list-avds'], {
      env: {
        ANDROID_USER_HOME: androidHome,
        ANDROID_SDK_HOME: androidHome,
        HOME: androidHome,
        USERPROFILE: androidHome,
      },
    }),
  };

  const browserLaunchable = checks.chromeVersionChecks.some((check) => check.status === 0) || checks.puppeteerLaunch.status === 0;
  const adbUsable = checks.adbDevices.status === 0 && !/Cannot mkdir|Permission denied/i.test(`${checks.adbDevices.stdout}\n${checks.adbDevices.stderr}`);
  const avds = checks.emulatorList.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const report = {
    timestamp: new Date().toISOString(),
    browserLaunchable,
    adbUsable,
    avds,
    checks,
    recommendation: browserLaunchable || (adbUsable && avds.length)
      ? 'A visual QA target may be available. Run the browser smoke or Android QA flow.'
      : 'No visual QA target is available in this workspace. Use contract/runtime checks only and rerun visual QA in an environment with Chrome/WebView or an Android target.',
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`QA environment preflight written to ${reportPath}`);
  console.log(`browserLaunchable=${browserLaunchable}`);
  console.log(`adbUsable=${adbUsable}`);
  console.log(`avds=${avds.length ? avds.join(',') : 'none'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
