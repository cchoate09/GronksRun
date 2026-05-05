const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const appPath = path.join(projectRoot, 'App.js');
const webviewHtmlPath = path.join(projectRoot, 'assets', 'gameHtml.js');
const srcRoot = path.join(projectRoot, 'src');
const webpackConfigPath = path.join(projectRoot, 'webpack.config.js');
const packageLockPath = path.join(projectRoot, 'package-lock.json');

// 200 KB lower bound. The real bundle is multi-MB; anything smaller is a
// truncated/empty rebuild that webpack failed to populate.
const MIN_BUNDLE_BYTES = 200 * 1024;

function fail(message) {
  console.error(`verify_webview_bundle: ${message}`);
  process.exit(1);
}

function newestMtimeMs(dir) {
  let newest = 0;
  function walk(p) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(p)) walk(path.join(p, child));
    } else if (stat.isFile()) {
      if (stat.mtimeMs > newest) newest = stat.mtimeMs;
    }
  }
  walk(dir);
  return newest;
}

if (!fs.existsSync(webviewHtmlPath)) fail(`assets/gameHtml.js is missing — run \`npm run build:webview\`.`);
if (!fs.existsSync(appPath)) fail('App.js is missing.');

const appSource = fs.readFileSync(appPath, 'utf8');
const htmlModule = fs.readFileSync(webviewHtmlPath, 'utf8');
const bundleStat = fs.statSync(webviewHtmlPath);

// Wiring checks (legacy)
if (appSource.includes("require('./dist/index.html')") || appSource.includes('require("./dist/index.html")')) {
  fail('App.js must not require ignored dist/index.html for Android WebView loading.');
}
if (!appSource.includes("from './assets/gameHtml'") && !appSource.includes('from "./assets/gameHtml"')) {
  fail('App.js must import the committed assets/gameHtml module.');
}
if (!/source=\{\{\s*html:\s*gameHtml\b/.test(appSource)) {
  fail('WebView source must use inline committed gameHtml content.');
}
if (!htmlModule.startsWith('const html = ')) {
  fail('assets/gameHtml.js must export a bundled HTML document.');
}
if (!htmlModule.includes('<canvas id=\\"c\\"') && !htmlModule.includes('<canvas id="c"')) {
  fail('assets/gameHtml.js must contain the Pixi canvas with id="c".');
}
if (!htmlModule.includes('export default html;')) {
  fail('assets/gameHtml.js must default-export the HTML string.');
}

// Size sanity
if (bundleStat.size < MIN_BUNDLE_BYTES) {
  fail(`assets/gameHtml.js is ${bundleStat.size} bytes — minimum expected is ${MIN_BUNDLE_BYTES}. Probable truncated build.`);
}

// Freshness: the bundle must be at least as new as the newest source file
// or webpack config. Catches a forgotten `npm run build:webview`.
const sourceMtime = Math.max(
  newestMtimeMs(srcRoot),
  fs.statSync(webpackConfigPath).mtimeMs,
  fs.existsSync(packageLockPath) ? fs.statSync(packageLockPath).mtimeMs : 0,
);
if (bundleStat.mtimeMs + 2000 < sourceMtime) {
  const sourceDate = new Date(sourceMtime).toISOString();
  const bundleDate = new Date(bundleStat.mtimeMs).toISOString();
  fail(`assets/gameHtml.js (${bundleDate}) is older than newest source (${sourceDate}). Run \`npm run build:webview\`.`);
}

// Parse-smoke: decode the inlined HTML the same way the runtime would, then
// extract the <script> bodies and compile each with vm.Script. Compilation
// parses the JS without running it. Safe: never .runInContext()'d.
//
// gameHtml.js shape is:  const html = "<json-stringified HTML>"; export default html;
// We extract the literal via regex, JSON.parse to get the real HTML, then
// match every <script> body. Earlier version used a brittle hand-rolled
// `JSON.parse('"' + ... + '"')` un-escaper that miscategorized escape errors
// as JS syntax errors and only matched the FIRST script tag.
const literalMatch = htmlModule.match(/^const html = (".*");\s*\n\s*export default html;\s*\n?$/s);
if (!literalMatch) {
  fail('assets/gameHtml.js does not match the expected `const html = "..."; export default html;` shape.');
}
let decodedHtml;
try {
  decodedHtml = JSON.parse(literalMatch[1]);
} catch (err) {
  fail(`Could not decode the inlined HTML literal: ${err.message}. The bundler escape contract may have changed.`);
}

// Match all <script> bodies. matchAll() avoids the stateful regex API.
const scriptBodies = Array.from(decodedHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)).map((m) => m[1]);
if (scriptBodies.length === 0) {
  fail('Decoded HTML in assets/gameHtml.js has no <script> tag.');
}
const largest = scriptBodies.reduce((a, b) => (a.length >= b.length ? a : b));
// Sanity floor: anything under 50KB is almost certainly NOT the main bundle
// (probably a small polyfill or shim) and means the bundle is missing.
if (largest.length < 50_000) {
  fail(`Largest <script> body is only ${largest.length} bytes — bundle likely missing.`);
}
for (let i = 0; i < scriptBodies.length; i++) {
  try {
    new vm.Script(scriptBodies[i], { filename: `inlined-script-${i}.js` });
  } catch (err) {
    fail(`Inlined <script> #${i} (${scriptBodies[i].length} bytes) failed to parse: ${err.message}`);
  }
}

console.log(`WebView bundle OK — ${(bundleStat.size / 1024 / 1024).toFixed(2)} MB, mtime ${new Date(bundleStat.mtimeMs).toISOString()}.`);
