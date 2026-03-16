const fs = require('fs');
const h = fs.readFileSync('index.html', 'utf8');
const m = h.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.log('No script tag found'); process.exit(1); }
try { new Function(m[1]); console.log('Syntax OK'); }
catch(e) { console.log('Syntax error:', e.message); process.exit(1); }
