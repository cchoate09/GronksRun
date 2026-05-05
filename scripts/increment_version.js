#!/usr/bin/env node
// Bumps the patch version across package.json, app.json, and android/app/build.gradle
// in lockstep. All paths are anchored with __dirname so this can be run from
// any working directory (or via `npm run version:bump`).

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
  // build.gradle is the source of truth for the AAB versionCode. Refusing to
  // proceed without it prevents app.json/package.json drifting ahead of the
  // gradle file, which has bitten us before.
  fail(`android/app/build.gradle not found at ${gradlePath} — refusing to bump only half the version files.`);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const versionParts = oldVersion.split('.').map(Number);
if (versionParts.length !== 3 || versionParts.some((n) => !Number.isFinite(n))) {
  fail(`package.json version "${oldVersion}" is not in MAJOR.MINOR.PATCH form.`);
}
versionParts[2]++;
const newVersion = versionParts.join('.');
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`package.json: ${oldVersion} -> ${newVersion}`);

const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
app.expo.version = newVersion;
const newCode = (app.expo.android.versionCode || 0) + 1;
app.expo.android.versionCode = newCode;
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
console.log(`app.json: version ${newVersion}, versionCode ${newCode}`);

let gradle = fs.readFileSync(gradlePath, 'utf8');
const beforeCode = gradle;
gradle = gradle.replace(/versionCode \d+/, `versionCode ${newCode}`);
gradle = gradle.replace(/versionName ".*?"/, `versionName "${newVersion}"`);
if (gradle === beforeCode) {
  fail('Failed to find versionCode/versionName lines in build.gradle.');
}
fs.writeFileSync(gradlePath, gradle);
console.log(`build.gradle: versionName "${newVersion}", versionCode ${newCode}`);

console.log(`\nBumped to ${newVersion} (${newCode}).`);
