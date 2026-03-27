const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const indexPath = path.join(rootDir, 'index.html');
const gamePath = path.join(rootDir, 'game.js');
const assetsPath = path.join(rootDir, 'assets.js');
const audioAssetsPath = path.join(rootDir, 'audio_assets.js');
const outputs = [
  path.join(rootDir, 'gameHtml.js'),
  path.join(rootDir, 'assets', 'gameHtml.js'),
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function replaceMainScript(html, scriptContent) {
  const scriptPattern = /<script>\s*[\s\S]*?\s*<\/script>\s*<\/body>/;
  if (!scriptPattern.test(html)) {
    throw new Error('Could not find the main inline <script> block in index.html');
  }

  return html.replace(
    scriptPattern,
    `<script>\n${scriptContent.trim()}\n</script>\n</body>`
  );
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

const indexTemplate = read(indexPath);
const gameSource = read(gamePath);
const assetSource = read(assetsPath);
const audioAssetSource = read(audioAssetsPath);

const repairedIndexHtml = replaceMainScript(indexTemplate, gameSource);
fs.writeFileSync(indexPath, repairedIndexHtml);

let webViewHtml = repairedIndexHtml;
webViewHtml = inlineScript(webViewHtml, 'assets.js', assetSource);
webViewHtml = inlineScript(webViewHtml, 'audio_assets.js', audioAssetSource);

const moduleSource = `export default \`${escapeForTemplateLiteral(webViewHtml)}\`;\n`;
for (const outputPath of outputs) {
  fs.writeFileSync(outputPath, moduleSource);
}

console.log('Rebuilt index.html from game.js and regenerated self-contained gameHtml.js outputs.');
console.log('index.html size:', fs.statSync(indexPath).size, 'bytes');
console.log('gameHtml.js size:', fs.statSync(outputs[0]).size, 'bytes');
