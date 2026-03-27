const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const virtualConsole = new VirtualConsole();
let errorLogged = false;

virtualConsole.on("jsdomError", (err) => {
  if (!errorLogged) {
    fs.writeFileSync('js_error.txt', (err.detail && err.detail.stack) || err.stack || err.toString());
    errorLogged = true;
  }
});
virtualConsole.on("error", (err) => {
  if (!errorLogged) {
    fs.writeFileSync('js_error.txt', err.stack || err.toString());
    errorLogged = true;
  }
});

const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole });
setTimeout(() => {
    if (!errorLogged) fs.writeFileSync('js_error.txt', "No js errors caught.");
}, 500);
