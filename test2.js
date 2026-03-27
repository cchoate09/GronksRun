const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const virtualConsole = new VirtualConsole();
let errorLogged = false;

function logErr(err) {
  if (!errorLogged) {
    fs.writeFileSync('js2_error.txt', (err.detail && err.detail.stack) || err.stack || err.toString());
    errorLogged = true;
  }
}

virtualConsole.on("jsdomError", logErr);
virtualConsole.on("error", logErr);

process.on('uncaughtException', logErr);
process.on('unhandledRejection', logErr);

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  virtualConsole,
  beforeParse(window) {
    window.requestAnimationFrame = (cb) => {
        setTimeout(() => {
            try { cb(performance.now()); }
            catch(e) { logErr(e); }
        }, 16);
    };
  }
});

setTimeout(() => {
    if (!errorLogged) fs.writeFileSync('js2_error.txt', "No js errors caught after RAF.");
    process.exit(0);
}, 500);
