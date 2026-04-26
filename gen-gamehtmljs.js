const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = __dirname;
const indexPath = path.join(rootDir, 'index.html');
const assetsPath = path.join(rootDir, 'assets.js');
const enemyAssetsPath = path.join(rootDir, 'enemy_assets.js');
const audioAssetsPath = path.join(rootDir, 'audio_assets.js');
const gamePath = path.join(rootDir, 'game.js');
const outputs = [
  path.join(rootDir, 'gameHtml.js'),
  path.join(rootDir, 'assets', 'gameHtml.js'),
];
const standaloneHtmlOutput = path.join(rootDir, 'assets', 'game.html');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function ensureGeneratedFile(filePath, generatorScript) {
  if (fs.existsSync(filePath)) {
    return;
  }

  const generatorPath = path.join(rootDir, generatorScript);
  console.log(`Missing ${path.basename(filePath)}. Regenerating via ${generatorScript}...`);
  execFileSync(process.execPath, [generatorPath], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

function inlineScript(html, scriptFileName, scriptContent) {
  const escapedName = scriptFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scriptTagPattern = new RegExp(`<script\\s+src="${escapedName}"><\\/script>`);
  if (!scriptTagPattern.test(html)) {
    throw new Error(`Could not find <script src="${scriptFileName}"></script> in index.html`);
  }

  return html.replace(scriptTagPattern, `<script>\n${scriptContent.trim()}\n</script>`);
}

function escapeForTemplateLiteral(content) {
  return content
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

ensureGeneratedFile(enemyAssetsPath, 'gen_enemy_assets.js');

const indexTemplate = read(indexPath);
const scriptSources = [
  ['assets.js', read(assetsPath)],
  ['enemy_assets.js', read(enemyAssetsPath)],
  ['audio_assets.js', read(audioAssetsPath)],
  ['game.js', read(gamePath)],
];

let webViewHtml = indexTemplate;
for (const [scriptFileName, scriptContent] of scriptSources) {
  webViewHtml = inlineScript(webViewHtml, scriptFileName, scriptContent);
}

const moduleSource = `const html = \`${escapeForTemplateLiteral(webViewHtml)}\`;\nexport default html;\n`;
for (const outputPath of outputs) {
  fs.writeFileSync(outputPath, moduleSource);
}
fs.writeFileSync(standaloneHtmlOutput, webViewHtml);

console.log('Kept index.html as the external-script template and regenerated self-contained gameHtml.js outputs.');
console.log('index.html size:', fs.statSync(indexPath).size, 'bytes');
console.log('gameHtml.js size:', fs.statSync(outputs[0]).size, 'bytes');
console.log('assets/game.html size:', fs.statSync(standaloneHtmlOutput).size, 'bytes');
