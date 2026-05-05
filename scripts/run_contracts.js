#!/usr/bin/env node
// Runs every gameplay contract script with a per-script timeout, captures
// pass/fail/timeout for each, and exits non-zero if ANY failed. Replaces the
// previous `&& && && ...` chain in package.json which aborted on first
// failure (so later contracts went unreported) and had no timeout (so a
// puppeteer hang would stall the whole gate indefinitely).

const { spawn, spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

// On Windows, child.kill('SIGKILL') only terminates the direct Node process —
// any spawned puppeteer/Chromium descendants leak and accumulate across the
// gauntlet, eventually OOMing the box. Use taskkill /T /F to walk the tree.
function killTree(child) {
  if (!child || !child.pid) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      child.kill('SIGKILL');
    } catch {
      // Already exited.
    }
  }
}

const CONTRACTS = [
  'combat_modes_check.js',
  'enemy_pressure_contract_check.js',
  'endless_settings_contract_check.js',
  'terrain_contract_check.js',
  'crouch_pound_enemy_contract_check.js',
  'level_duration_contract_check.js',
  'sound_contract_check.js',
  'pause_ui_contract_check.js',
  'current_objective_contract_check.js',
  'current_objective_runtime_check.js',
  'current_objective_play_loop_check.js',
  'current_tuning_contract_check.js',
  'arcade_gauntlet_contract_check.js',
  'sprite_motion_orientation_contract_check.js',
  'full_art_enemy_roster_contract_check.js',
  'target_kill_completion_smoke.js',
  'android_competitiveness_contract_check.js',
  'polish_pass_contract_check.js',
  'sprite_animation_quality_contract_check.js',
  'menu_controls_and_attack_contract_check.js',
];

const PER_SCRIPT_TIMEOUT_MS = 90_000;

function runOne(scriptName) {
  return new Promise((resolve) => {
    const scriptPath = path.join(projectRoot, 'scripts', scriptName);
    const start = Date.now();
    const child = spawn(process.execPath, [scriptPath], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let resolved = false;
    let spawnErrored = false;

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, PER_SCRIPT_TIMEOUT_MS);

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.on('close', (code, signal) => {
      const elapsed = Date.now() - start;
      // killedByTimeout is driven by our own flag, not by signal name —
      // Node lies about the SIGKILL signal on Windows (it's TerminateProcess
      // under the hood) and a script that self-exited at ~89.9s right before
      // the timer fires would otherwise be misclassified.
      const passed = code === 0 && !timedOut && !spawnErrored;
      finish({ scriptName, passed, code, signal, elapsed, killedByTimeout: timedOut, spawnErrored, stdout, stderr });
    });

    child.on('error', (err) => {
      spawnErrored = true;
      const elapsed = Date.now() - start;
      finish({
        scriptName,
        passed: false,
        code: null,
        signal: null,
        elapsed,
        killedByTimeout: false,
        spawnErrored: true,
        stdout,
        stderr: stderr + '\n' + err.message,
      });
    });
  });
}

(async () => {
  const results = [];
  for (const name of CONTRACTS) {
    process.stdout.write(`> ${name} ... `);
    const r = await runOne(name);
    results.push(r);
    if (r.passed) {
      console.log(`PASS (${(r.elapsed / 1000).toFixed(1)}s)`);
    } else if (r.killedByTimeout) {
      console.log(`TIMEOUT (${(r.elapsed / 1000).toFixed(1)}s)`);
    } else if (r.spawnErrored) {
      console.log(`SPAWN-ERROR (${(r.elapsed / 1000).toFixed(1)}s)`);
    } else {
      console.log(`FAIL (exit ${r.code}, ${(r.elapsed / 1000).toFixed(1)}s)`);
    }
  }

  console.log('\n--- Contract summary ---');
  const failures = results.filter((r) => !r.passed);
  for (const r of results) {
    const status = r.passed
      ? 'PASS'
      : r.killedByTimeout
        ? 'TIMEOUT'
        : r.spawnErrored
          ? 'SPAWN'
          : 'FAIL';
    console.log(`  ${status.padEnd(7)} ${r.scriptName}  ${(r.elapsed / 1000).toFixed(1)}s`);
  }
  if (failures.length === 0) {
    console.log(`\nAll ${results.length} contracts passed.`);
    process.exit(0);
  }
  console.log(`\n${failures.length}/${results.length} contracts failed:`);
  for (const f of failures) {
    const reason = f.killedByTimeout
      ? '(TIMEOUT)'
      : f.spawnErrored
        ? '(SPAWN-ERROR)'
        : `(exit ${f.code})`;
    console.log(`\n=== ${f.scriptName} ${reason} ===`);
    if (f.stdout.trim()) console.log('--- stdout ---\n' + f.stdout.trim());
    if (f.stderr.trim()) console.log('--- stderr ---\n' + f.stderr.trim());
  }
  process.exit(1);
})();
