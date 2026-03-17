// Generates gameHtml.js from index.html for Expo WebView embedding
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
// Escape backticks and template literal expressions for embedding in a template literal
const escaped = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const output = 'export default `' + escaped + '`;\n';
fs.writeFileSync('../assets/gameHtml.js', output);
fs.writeFileSync('../gameHtml.js', output); // App.js imports from root
console.log('gameHtml.js regenerated successfully (both locations)!');
