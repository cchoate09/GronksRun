const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distHtmlPath = path.join(projectRoot, 'dist', 'index.html');
const outputPath = path.join(projectRoot, 'assets', 'gameHtml.js');

if (!fs.existsSync(distHtmlPath)) {
  console.error('dist/index.html is missing. Run webpack before syncing the WebView asset.');
  process.exit(1);
}

const html = fs.readFileSync(distHtmlPath, 'utf8');
const moduleSource = `const html = ${JSON.stringify(html)};\n\nexport default html;\n`;

fs.writeFileSync(outputPath, moduleSource, 'utf8');
console.log(`Synced ${path.relative(projectRoot, outputPath)} from ${path.relative(projectRoot, distHtmlPath)}.`);
