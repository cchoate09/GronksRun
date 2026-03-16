const fs = require('fs');
const html = fs.readFileSync('../gronk-run/index.html', 'utf8');
const escaped = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
fs.writeFileSync('gameHtml.js', 'export default `' + escaped + '`;\n');
console.log('Created gameHtml.js, length:', fs.statSync('gameHtml.js').size);
