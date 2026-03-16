const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const escaped = html
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$/g, '\\$');
const out = 'export default `' + escaped + '`;\n';
fs.writeFileSync('../gronk-run-app/assets/gameHtml.js', out);
console.log('gameHtml.js updated, length:', out.length);
