const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = process.cwd();
const preflightPath = path.join(projectRoot, 'output', 'qa-environment-preflight.json');

function run(command, args) {
  const useShell = process.platform === 'win32' && command === 'npm';
  const executable = command;
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: useShell,
  });
  if (result.error) {
    console.error(`Failed to run ${executable}: ${result.error.message}`);
  }
  return result.status == null ? 1 : result.status;
}

function readPreflight() {
  if (!fs.existsSync(preflightPath)) return null;
  return JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
}

const preflightStatus = run('npm', ['run', 'qa:preflight']);
if (preflightStatus !== 0) {
  process.exit(preflightStatus);
}

const preflight = readPreflight();
if (!preflight) {
  console.error(`Missing preflight report at ${preflightPath}`);
  process.exit(1);
}

if (!preflight.browserLaunchable) {
  console.error('Visual QA blocked: no browser target is launchable in this workspace.');
  console.error(`See ${preflightPath}`);
  process.exit(2);
}

const buildStatus = run('npm', ['run', 'build:webview']);
if (buildStatus !== 0) process.exit(buildStatus);

const bundleStatus = run('npm', ['run', 'verify:webview-bundle']);
if (bundleStatus !== 0) process.exit(bundleStatus);

const mobileSmokeStatus = run('npm', ['run', 'smoke:mobile-webview']);
if (mobileSmokeStatus !== 0) process.exit(mobileSmokeStatus);

const systemicSmokeStatus = run('npm', ['run', 'smoke:systemic-loop']);
if (systemicSmokeStatus !== 0) process.exit(systemicSmokeStatus);

const webGameStatus = run('npm', ['run', 'qa:web-game-client']);
if (webGameStatus !== 0) process.exit(webGameStatus);

console.log('Visual QA gate passed.');
