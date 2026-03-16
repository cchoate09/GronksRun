const fs = require('fs');
const html = fs.readFileSync('../gronk-run/index.html', 'utf8');
// Escape for embedding in a JS template literal
const escaped = html
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');
fs.writeFileSync('gameHtml.js', 'export default `' + escaped + '`;\n');
// Verify it parses
try {
  new Function('return `' + escaped + '`');
  console.log('OK - gameHtml.js generated, size:', fs.statSync('gameHtml.js').size);
} catch(e) {
  console.error('PARSE ERROR:', e.message);
  process.exit(1);
}
