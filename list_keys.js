const fs = require('fs');
const content = fs.readFileSync('assets.js', 'utf8');
const matches = content.match(/^\s*([a-z0-9_]+):/gm);
if (matches) {
    console.log('Found keys in assets.js:');
    matches.forEach(m => console.log(m.trim()));
} else {
    console.log('No keys found in assets.js using the regex.');
}
