const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const appPath = path.join(projectRoot, 'App.js');
const webviewHtmlPath = path.join(projectRoot, 'assets', 'gameHtml.js');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const appSource = fs.readFileSync(appPath, 'utf8');
const htmlModule = fs.readFileSync(webviewHtmlPath, 'utf8');

if (appSource.includes("require('./dist/index.html')") || appSource.includes('require("./dist/index.html")')) {
  fail('App.js must not require ignored dist/index.html for Android WebView loading.');
}

if (!appSource.includes("from './assets/gameHtml'") && !appSource.includes('from "./assets/gameHtml"')) {
  fail('App.js must import the committed assets/gameHtml module.');
}

if (!appSource.includes('source={{ html: gameHtml }}')) {
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

console.log('WebView bundle wiring is valid.');
