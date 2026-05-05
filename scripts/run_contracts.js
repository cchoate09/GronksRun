#!/usr/bin/env node
// Runs every gameplay contract script with a per-script timeout, captures
// pass/fail/timeout for each, and exits non-zero if ANY failed. Replaces the
// previous `&& && && ...` chain in package.json which aborted on first
// failure (so later contracts went unreported) and had no timeout (so a
// puppeteer hang would stall the whole gate indefinitely).

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

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
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, PER_SCRIPT_TIMEOUT_MS);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const elapsed = Date.now() - start;
      const killedByTimeout = signal === 'SIGKILL' && elapsed >= PER_SCRIPT_TIMEOUT_MS;
      const passed = code === 0 && !killedByTimeout;
      resolve({ scriptName, passed, code, signal, elapsed, killedByTimeout, stdout, stderr });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ scriptName, passed: false, code: -1, signal: null, elapsed: Date.now() - start, killedByTimeout: false, stdout, stderr: stderr + '\n' + err.message });
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
    } else {
      console.log(`FAIL (exit ${r.code}, ${(r.elapsed / 1000).toFixed(1)}s)`);
    }
  }

  console.log('\n--- Contract summary ---');
  const failures = results.filter((r) => !r.passed);
  for (const r of results) {
    const status = r.passed ? 'PASS' : r.killedByTimeout ? 'TIMEOUT' : 'FAIL';
    console.log(`  ${status.padEnd(7)} ${r.scriptName}  ${(r.elapsed / 1000).toFixed(1)}s`);
  }
  if (failures.length === 0) {
    console.log(`\nAll ${results.length} contracts passed.`);
    process.exit(0);
  }
  console.log(`\n${failures.length}/${results.length} contracts failed:`);
  for (const f of failures) {
    console.log(`\n=== ${f.scriptName} ${f.killedByTimeout ? '(TIMEOUT)' : `(exit ${f.code})`} ===`);
    if (f.stdout.trim()) console.log('--- stdout ---\n' + f.stdout.trim());
    if (f.stderr.trim()) console.log('--- stderr ---\n' + f.stderr.trim());
  }
  process.exit(1);
})();
