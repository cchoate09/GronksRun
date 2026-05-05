#!/usr/bin/env node
// Bumps the patch version across package.json, app.json, and android/app/build.gradle
// in lockstep. All paths are anchored with __dirname so this can be run from
// any working directory (or via `npm run version:bump`).
//
// Failure mode the first version had: serial write where a mid-sequence throw
// (disk full, EPERM, antivirus lock) left the version files mismatched —
// next run re-bumped from the asymmetric state and the drift compounded.
// This version reads everything, mutates everything in memory, then writes;
// any write failure attempts to restore the originals from the snapshot.

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const pkgPath = path.join(projectRoot, 'package.json');
const appPath = path.join(projectRoot, 'app.json');
const gradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');

function fail(message) {
  console.error(`increment_version: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(pkgPath)) fail(`package.json not found at ${pkgPath}`);
if (!fs.existsSync(appPath)) fail(`app.json not found at ${appPath}`);
if (!fs.existsSync(gradlePath)) {
  fail(`android/app/build.gradle not found at ${gradlePath} — refusing to bump only half the version files.`);
}

// --- Read phase ---
const pkgOriginal = fs.readFileSync(pkgPath, 'utf8');
const appOriginal = fs.readFileSync(appPath, 'utf8');
const gradleOriginal = fs.readFileSync(gradlePath, 'utf8');

const pkg = JSON.parse(pkgOriginal);
const oldVersion = pkg.version;
const versionParts = oldVersion.split('.').map(Number);
if (versionParts.length !== 3 || versionParts.some((n) => !Number.isFinite(n))) {
  fail(`package.json version "${oldVersion}" is not in MAJOR.MINOR.PATCH form.`);
}
versionParts[2]++;
const newVersion = versionParts.join('.');

const app = JSON.parse(appOriginal);
const newCode = (app.expo.android.versionCode || 0) + 1;

// --- Compute new bodies (still no disk writes) ---
pkg.version = newVersion;
const pkgNext = JSON.stringify(pkg, null, 2) + '\n';

app.expo.version = newVersion;
app.expo.android.versionCode = newCode;
const appNext = JSON.stringify(app, null, 2) + '\n';

let gradleNext = gradleOriginal;
gradleNext = gradleNext.replace(/versionCode \d+/, `versionCode ${newCode}`);
gradleNext = gradleNext.replace(/versionName ".*?"/, `versionName "${newVersion}"`);
if (gradleNext === gradleOriginal) {
  fail('Failed to find versionCode/versionName lines in build.gradle.');
}

// --- Write phase with rollback ---
const writes = [
  { path: pkgPath, body: pkgNext, original: pkgOriginal, label: 'package.json' },
  { path: appPath, body: appNext, original: appOriginal, label: 'app.json' },
  { path: gradlePath, body: gradleNext, original: gradleOriginal, label: 'build.gradle' },
];
const completed = [];
try {
  for (const w of writes) {
    fs.writeFileSync(w.path, w.body);
    completed.push(w);
    console.log(`${w.label}: bumped`);
  }
} catch (err) {
  console.error(`\nincrement_version: write failed mid-sequence: ${err.message}`);
  console.error('Attempting rollback of completed writes...');
  let rolledBackAll = true;
  for (const w of completed) {
    try {
      fs.writeFileSync(w.path, w.original);
      console.error(`  restored ${w.label}`);
    } catch (rollbackErr) {
      rolledBackAll = false;
      console.error(`  FAILED to restore ${w.label}: ${rollbackErr.message}`);
    }
  }
  if (rolledBackAll) {
    console.error('Rollback complete. Files unchanged.');
  } else {
    console.error('PARTIAL ROLLBACK — version files are NOT in a consistent state. Manually align package.json / app.json / build.gradle before retrying.');
  }
  process.exit(1);
}

console.log(`\nBumped to ${newVersion} (${newCode}).`);
