const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Regex to find var/const XXX_B64 = { ... };
// This is a bit tricky with nested braces, but usually assets are flat objects.
const spriteRegex = /var\s+SPRITE_B64\s*=\s*{[\s\S]*?};/;
const sfxRegex = /var\s+SFX_B64\s*=\s*{[\s\S]*?};/;

const spriteMatch = content.match(spriteRegex);
const sfxMatch = content.match(sfxRegex);

let assetsJsRows = ['// Automated asset extraction from index.html'];

if (spriteMatch) {
    assetsJsRows.push(spriteMatch[0]);
}
if (sfxMatch) {
    assetsJsRows.push(sfxMatch[0]);
}

fs.writeFileSync('assets.js', assetsJsRows.join('\n\n'));

// Now create a version of index.html WITHOUT these assets
let strippedContent = content;
if (spriteMatch) {
    strippedContent = strippedContent.replace(spriteRegex, 'var SPRITE_B64 = {}; // Moved to assets.js');
}
if (sfxMatch) {
    strippedContent = strippedContent.replace(sfxRegex, 'var SFX_B64 = {}; // Moved to assets.js');
}

// Add script tag for assets.js before the main script or at the start of body
// It's already in a <script> tag in index.html, so we should probably put the script tag in <head>
strippedContent = strippedContent.replace('<script>', '<script src="assets.js"></script>\n<script>');

fs.writeFileSync('index_stripped.html', strippedContent);
console.log('Extraction complete. assets.js and index_stripped.html created.');
